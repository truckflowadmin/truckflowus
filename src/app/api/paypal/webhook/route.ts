import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/paypal';

/**
 * POST /api/paypal/webhook
 * Handles PayPal webhook events for subscription lifecycle:
 *   - BILLING.SUBSCRIPTION.ACTIVATED   → mark active, clear suspension
 *   - BILLING.SUBSCRIPTION.SUSPENDED   → mark paused, start grace period
 *   - BILLING.SUBSCRIPTION.CANCELLED   → mark cancelled, suspend account
 *   - BILLING.SUBSCRIPTION.EXPIRED     → mark expired, suspend account
 *   - PAYMENT.SALE.COMPLETED           → payment received, clear overdue flags
 *   - BILLING.SUBSCRIPTION.PAYMENT.FAILED → payment failed, start grace period
 */
export async function POST(req: Request) {
  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  // Verify webhook signature
  const valid = await verifyWebhookSignature({ headers, body });
  if (!valid) {
    console.error('[paypal/webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.event_type;
  const resource = event.resource;
  const subscriptionId = resource?.id || resource?.billing_agreement_id;
  const customId = resource?.custom_id; // our companyId

  console.log(`[paypal/webhook] ${eventType} sub=${subscriptionId} company=${customId}`);

  if (!subscriptionId && !customId) {
    return NextResponse.json({ ok: true }); // irrelevant event
  }

  // Find the company by PayPal subscription ID or custom_id
  let companyId = customId;
  if (!companyId && subscriptionId) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Company" WHERE "paypalSubscriptionId" = ${subscriptionId} LIMIT 1
    `;
    companyId = rows[0]?.id;
  }

  if (!companyId) {
    console.warn('[paypal/webhook] No company found for subscription:', subscriptionId);
    return NextResponse.json({ ok: true });
  }

  const now = new Date();

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'ACTIVE',
              "suspended" = false,
              "suspendedAt" = NULL,
              "subscriptionPausedAt" = NULL,
              "subscriptionResumedAt" = ${now}
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'ACTIVE', 'Subscription activated via PayPal');
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        // PayPal suspended the subscription (usually payment failure)
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'SUSPENDED',
              "subscriptionPausedAt" = ${now}
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'SUSPENDED', 'Subscription suspended by PayPal (payment issue)');
        // Grace period — don't suspend the account immediately
        // The auto-suspend check will handle it after gracePeriodDays
        await scheduleGracePeriodSuspend(companyId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'CANCELLED',
              "suspended" = true,
              "suspendedAt" = ${now},
              "subscriptionPausedAt" = ${now}
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'CANCELLED', 'Subscription cancelled');
        break;
      }

      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'EXPIRED',
              "suspended" = true,
              "suspendedAt" = ${now},
              "subscriptionPausedAt" = ${now}
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'EXPIRED', 'Subscription expired');
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        // Successful payment — clear any suspension or pause
        const amountValue = resource?.amount?.total || resource?.amount?.value || '0';
        const amountCents = Math.round(parseFloat(amountValue) * 100);

        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'ACTIVE',
              "suspended" = false,
              "suspendedAt" = NULL,
              "subscriptionPausedAt" = NULL,
              "subscriptionResumedAt" = ${now},
              "nextPaymentDue" = NULL
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'ACTIVE', `Payment received: $${(amountCents / 100).toFixed(2)}`, amountCents);
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        // Payment failed — start grace period
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'PAYMENT_FAILED',
              "nextPaymentDue" = ${now}
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'SUSPENDED', 'Payment failed — grace period started');
        await scheduleGracePeriodSuspend(companyId);
        break;
      }

      default:
        console.log(`[paypal/webhook] Unhandled event: ${eventType}`);
    }
  } catch (err) {
    console.error('[paypal/webhook] Error processing event:', err);
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logEvent(companyId: string, status: string, description: string, amountCents = 0) {
  try {
    await prisma.billingEvent.create({
      data: {
        companyId,
        subscriptionStatus: status as any,
        paymentMethod: 'PayPal',
        description,
        amountCents,
      } as any,
    });
  } catch (err) {
    console.error('[paypal/webhook] Failed to log billing event:', err);
  }
}

/**
 * After a payment failure, check grace period and auto-suspend if overdue.
 * This runs inline for now — a cron job would be better for production.
 */
async function scheduleGracePeriodSuspend(companyId: string) {
  try {
    const rows = await prisma.$queryRaw<{
      gracePeriodDays: number;
      autoSuspendOnOverdue: boolean;
      nextPaymentDue: Date | null;
    }[]>`
      SELECT "gracePeriodDays", "autoSuspendOnOverdue", "nextPaymentDue"
      FROM "Company" WHERE "id" = ${companyId} LIMIT 1
    `;
    const co = rows[0];
    if (!co || !co.autoSuspendOnOverdue || !co.nextPaymentDue) return;

    const graceEnd = new Date(co.nextPaymentDue);
    graceEnd.setDate(graceEnd.getDate() + co.gracePeriodDays);

    if (new Date() >= graceEnd) {
      // Grace period already expired — suspend now
      const now = new Date();
      await prisma.$executeRaw`
        UPDATE "Company"
        SET "suspended" = true,
            "suspendedAt" = ${now},
            "subscriptionPausedAt" = ${now}
        WHERE "id" = ${companyId}
      `;
      await logEvent(companyId, 'SUSPENDED', `Auto-suspended: payment overdue past ${co.gracePeriodDays}-day grace period`);
    }
    // If grace period hasn't expired yet, the next webhook event or a cron check will handle it
  } catch (err) {
    console.error('[paypal/webhook] Grace period check error:', err);
  }
}
