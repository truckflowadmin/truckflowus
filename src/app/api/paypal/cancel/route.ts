import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelSubscription } from '@/lib/paypal';

/**
 * POST /api/paypal/cancel
 * Dispatcher cancels their PayPal subscription.
 * - Cancels the subscription on PayPal
 * - Updates Company status to CANCELLED
 * - Suspends the account (blocks access until they resubscribe)
 * - Logs billing event and audit trail
 */
export async function POST() {
  try {
    const session = await requireSession();
    if (!session.companyId) {
      return NextResponse.json({ error: 'No company linked' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<{
      paypalSubscriptionId: string | null;
      subscriptionStatus: string | null;
    }[]>`
      SELECT "paypalSubscriptionId", "subscriptionStatus"
      FROM "Company" WHERE "id" = ${session.companyId} LIMIT 1
    `;
    const subId = rows[0]?.paypalSubscriptionId;
    const currentStatus = rows[0]?.subscriptionStatus;

    if (!subId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    if (currentStatus === 'CANCELLED') {
      return NextResponse.json({ error: 'Subscription is already cancelled' }, { status: 400 });
    }

    // Cancel on PayPal
    await cancelSubscription(subId, 'Cancelled by dispatcher');

    const now = new Date();

    // Update Company: mark cancelled and suspended
    await prisma.$executeRaw`
      UPDATE "Company"
      SET "subscriptionStatus" = 'CANCELLED',
          "subscriptionPausedAt" = ${now},
          "suspended" = true,
          "suspendedAt" = ${now},
          "nextPaymentDue" = NULL
      WHERE "id" = ${session.companyId}
    `;

    // Log billing event
    await prisma.billingEvent.create({
      data: {
        companyId: session.companyId,
        type: 'PLAN_CHANGE',
        subscriptionStatus: 'CANCELLED' as any,
        paymentMethod: 'PayPal',
        description: 'PayPal subscription cancelled by dispatcher',
        amountCents: 0,
        actor: session.email,
      } as any,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        companyId: session.companyId,
        entityType: 'billing',
        action: 'subscription_cancelled',
        actor: session.email,
        actorRole: session.role,
        summary: `Dispatcher cancelled PayPal subscription (${subId})`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[paypal/cancel]', err);
    return NextResponse.json({ error: err.message || 'Failed to cancel' }, { status: 500 });
  }
}
