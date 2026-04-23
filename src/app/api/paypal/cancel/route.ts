import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelSubscription } from '@/lib/paypal';

/**
 * POST /api/paypal/cancel
 * Dispatcher cancels their PayPal subscription.
 */
export async function POST() {
  try {
    const session = await requireSession();
    if (!session.companyId) {
      return NextResponse.json({ error: 'No company linked' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<{ paypalSubscriptionId: string | null }[]>`
      SELECT "paypalSubscriptionId" FROM "Company" WHERE "id" = ${session.companyId} LIMIT 1
    `;
    const subId = rows[0]?.paypalSubscriptionId;

    if (!subId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    await cancelSubscription(subId, 'Cancelled by dispatcher');

    const now = new Date();
    await prisma.$executeRaw`
      UPDATE "Company"
      SET "subscriptionStatus" = 'CANCELLED',
          "subscriptionPausedAt" = ${now}
      WHERE "id" = ${session.companyId}
    `;

    await prisma.billingEvent.create({
      data: {
        companyId: session.companyId,
        subscriptionStatus: 'CANCELLED' as any,
        paymentMethod: 'PayPal',
        description: 'Subscription cancelled by dispatcher',
        amountCents: 0,
      } as any,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[paypal/cancel]', err);
    return NextResponse.json({ error: err.message || 'Failed to cancel' }, { status: 500 });
  }
}
