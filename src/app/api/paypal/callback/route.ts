import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSubscription } from '@/lib/paypal';

/**
 * GET /api/paypal/callback?action=success|cancel&companyId=xxx
 * PayPal redirects the dispatcher here after approval/cancellation.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const companyId = url.searchParams.get('companyId');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!companyId) {
    return NextResponse.redirect(`${appUrl}/settings?billing=error`);
  }

  if (action === 'cancel') {
    // User cancelled at PayPal — clear pending state
    await prisma.$executeRaw`
      UPDATE "Company"
      SET "subscriptionStatus" = NULL,
          "paypalSubscriptionId" = NULL,
          "paypalPlanId" = NULL
      WHERE "id" = ${companyId}
        AND "subscriptionStatus" = 'APPROVAL_PENDING'
    `;
    return NextResponse.redirect(`${appUrl}/settings?billing=cancelled`);
  }

  if (action === 'success') {
    // User approved — fetch subscription details from PayPal to confirm
    try {
      const rows = await prisma.$queryRaw<{ paypalSubscriptionId: string | null }[]>`
        SELECT "paypalSubscriptionId" FROM "Company" WHERE "id" = ${companyId} LIMIT 1
      `;
      const subId = rows[0]?.paypalSubscriptionId;

      if (subId) {
        const sub = await getSubscription(subId);
        const payerEmail = sub.subscriber?.email_address || null;

        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = ${sub.status || 'ACTIVE'},
              "paypalPayerEmail" = ${payerEmail},
              "subscriptionPausedAt" = NULL,
              "subscriptionResumedAt" = NOW(),
              "suspended" = false,
              "suspendedAt" = NULL,
              "nextPaymentDue" = ${sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : null}
          WHERE "id" = ${companyId}
        `;

        // Log billing event
        await prisma.billingEvent.create({
          data: {
            companyId,
            subscriptionStatus: 'ACTIVE' as any,
            paymentMethod: 'PayPal',
            description: `PayPal subscription activated (${subId})`,
            amountCents: 0,
          } as any,
        });
      }

      return NextResponse.redirect(`${appUrl}/settings?billing=success`);
    } catch (err) {
      console.error('[paypal/callback] Error confirming subscription:', err);
      return NextResponse.redirect(`${appUrl}/settings?billing=error`);
    }
  }

  return NextResponse.redirect(`${appUrl}/settings`);
}
