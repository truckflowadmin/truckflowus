import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSubscription } from '@/lib/paypal';

/**
 * GET /api/paypal/callback?action=success|cancel&companyId=xxx
 * PayPal redirects the dispatcher here after approval/cancellation.
 * On success: confirms subscription, assigns the selected plan, activates account.
 * On cancel: clears pending state, redirects back to subscribe page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const companyId = url.searchParams.get('companyId');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!companyId) {
    return NextResponse.redirect(`${appUrl}/subscribe?billing=error`);
  }

  if (action === 'cancel') {
    // User cancelled at PayPal — clear pending state
    await prisma.$executeRaw`
      UPDATE "Company"
      SET "subscriptionStatus" = NULL,
          "paypalSubscriptionId" = NULL,
          "paypalPlanId" = NULL,
          "pendingPlanId" = NULL
      WHERE "id" = ${companyId}
        AND "subscriptionStatus" = 'APPROVAL_PENDING'
    `;
    return NextResponse.redirect(`${appUrl}/subscribe?billing=cancelled`);
  }

  if (action === 'success') {
    try {
      // Fetch pending subscription ID and target plan
      const rows = await prisma.$queryRaw<{
        paypalSubscriptionId: string | null;
        pendingPlanId: string | null;
      }[]>`
        SELECT "paypalSubscriptionId", "pendingPlanId"
        FROM "Company" WHERE "id" = ${companyId} LIMIT 1
      `;
      const subId = rows[0]?.paypalSubscriptionId;
      const pendingPlanId = rows[0]?.pendingPlanId;

      if (subId) {
        const sub = await getSubscription(subId);
        const payerEmail = sub.subscriber?.email_address || null;

        // Activate subscription AND assign the plan in one update
        await prisma.$executeRaw`
          UPDATE "Company"
          SET "subscriptionStatus" = ${sub.status || 'ACTIVE'},
              "paypalPayerEmail" = ${payerEmail},
              "subscriptionPausedAt" = NULL,
              "subscriptionResumedAt" = NOW(),
              "suspended" = false,
              "suspendedAt" = NULL,
              "pendingPlanId" = NULL,
              "nextPaymentDue" = ${sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : null}
          WHERE "id" = ${companyId}
        `;

        // Assign the plan if one was pending
        if (pendingPlanId) {
          await prisma.company.update({
            where: { id: companyId },
            data: { planId: pendingPlanId },
          });
        }

        // Log billing event
        const plan = pendingPlanId
          ? await prisma.plan.findUnique({ where: { id: pendingPlanId }, select: { name: true } })
          : null;

        await prisma.billingEvent.create({
          data: {
            companyId,
            subscriptionStatus: 'ACTIVE' as any,
            paymentMethod: 'PayPal',
            description: `PayPal subscription activated — ${plan?.name || 'plan'} (${subId})`,
            amountCents: 0,
          } as any,
        });
      }

      return NextResponse.redirect(`${appUrl}/subscribe?billing=success`);
    } catch (err) {
      console.error('[paypal/callback] Error confirming subscription:', err);
      return NextResponse.redirect(`${appUrl}/subscribe?billing=error`);
    }
  }

  return NextResponse.redirect(`${appUrl}/subscribe`);
}
