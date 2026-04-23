import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, getSubscription } from '@/lib/paypal';
import { sendBillingEmail } from '@/lib/billing-emails';

/**
 * POST /api/paypal/webhook
 * Handles PayPal webhook events for subscription lifecycle:
 *   - BILLING.SUBSCRIPTION.ACTIVATED   → mark active, clear suspension
 *   - BILLING.SUBSCRIPTION.SUSPENDED   → mark paused, start grace period
 *   - BILLING.SUBSCRIPTION.CANCELLED   → mark cancelled, suspend account
 *   - BILLING.SUBSCRIPTION.EXPIRED     → mark expired, suspend account
 *   - BILLING.SUBSCRIPTION.RENEWED     → update nextPaymentDue
 *   - PAYMENT.SALE.COMPLETED           → payment received, update nextPaymentDue
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
        // Fetch the subscription to get next billing date
        let nextBilling: Date | null = null;
        try {
          if (subscriptionId) {
            const sub = await getSubscription(subscriptionId);
            if (sub.billing_info?.next_billing_time) {
              nextBilling = new Date(sub.billing_info.next_billing_time);
            }
          }
        } catch { /* non-critical */ }

        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'ACTIVE',
              "suspended" = false,
              "suspendedAt" = NULL,
              "subscriptionPausedAt" = NULL,
              "subscriptionResumedAt" = ${now},
              "nextPaymentDue" = ${nextBilling}
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
        await scheduleGracePeriodSuspend(companyId);
        // Notify tenant
        await sendBillingEmail(companyId, 'payment_failed');
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'CANCELLED',
              "suspended" = true,
              "suspendedAt" = ${now},
              "subscriptionPausedAt" = ${now},
              "nextPaymentDue" = NULL
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'CANCELLED', 'Subscription cancelled');
        await sendBillingEmail(companyId, 'account_suspended');
        break;
      }

      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'EXPIRED',
              "suspended" = true,
              "suspendedAt" = ${now},
              "subscriptionPausedAt" = ${now},
              "nextPaymentDue" = NULL
          WHERE "id" = ${companyId}
        `;
        await logEvent(companyId, 'EXPIRED', 'Subscription expired');
        await sendBillingEmail(companyId, 'account_suspended');
        break;
      }

      case 'BILLING.SUBSCRIPTION.RENEWED': {
        // Subscription renewed — fetch updated next billing date
        let nextBilling: Date | null = null;
        try {
          if (subscriptionId) {
            const sub = await getSubscription(subscriptionId);
            if (sub.billing_info?.next_billing_time) {
              nextBilling = new Date(sub.billing_info.next_billing_time);
            }
          }
        } catch { /* non-critical */ }

        if (nextBilling) {
          await prisma.$executeRaw`
            UPDATE "Company"
            SET "nextPaymentDue" = ${nextBilling}
            WHERE "id" = ${companyId}
          `;
        }
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        // Successful payment — clear any suspension or pause
        const amountValue = resource?.amount?.total || resource?.amount?.value || '0';
        const amountCents = Math.round(parseFloat(amountValue) * 100);
        const transactionId = resource?.id || null;
        const payerEmail = resource?.payer?.email_address || null;

        // Fetch updated next billing date from the subscription
        let nextBilling: Date | null = null;
        const billingSubId = resource?.billing_agreement_id || subscriptionId;
        try {
          if (billingSubId) {
            const sub = await getSubscription(billingSubId);
            if (sub.billing_info?.next_billing_time) {
              nextBilling = new Date(sub.billing_info.next_billing_time);
            }
          }
        } catch { /* non-critical */ }

        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = 'ACTIVE',
              "suspended" = false,
              "suspendedAt" = NULL,
              "subscriptionPausedAt" = NULL,
              "subscriptionResumedAt" = ${now},
              "nextPaymentDue" = ${nextBilling}
          WHERE "id" = ${companyId}
        `;

        await logEvent(
          companyId,
          'ACTIVE',
          `Payment received: $${(amountCents / 100).toFixed(2)} (PayPal txn: ${transactionId || 'N/A'})`,
          amountCents,
          transactionId,
        );

        // Notify tenant of successful payment
        await sendBillingEmail(companyId, 'payment_received', {
          amountCents,
          transactionId,
          nextPaymentDue: nextBilling,
        });
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
        // Notify tenant
        await sendBillingEmail(companyId, 'payment_failed');
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

async function logEvent(
  companyId: string,
  status: string,
  description: string,
  amountCents = 0,
  transactionId?: string | null,
) {
  try {
    const note = transactionId ? `PayPal txn: ${transactionId}` : undefined;
    await prisma.billingEvent.create({
      data: {
        companyId,
        type: amountCents > 0 ? 'PAYMENT' : 'PLAN_CHANGE',
        subscriptionStatus: status as any,
        paymentMethod: 'PayPal',
        description,
        amountCents,
        actor: 'PayPal Webhook',
        note,
      } as any,
    });
  } catch (err) {
    console.error('[paypal/webhook] Failed to log billing event:', err);
  }
}

/**
 * After a payment failure, check grace period and auto-suspend if overdue.
 * This runs inline for now — the layout also checks on every page load.
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
      await sendBillingEmail(companyId, 'account_suspended');
    }
  } catch (err) {
    console.error('[paypal/webhook] Grace period check error:', err);
  }
}
