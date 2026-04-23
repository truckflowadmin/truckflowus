import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/billing/history
 * Returns billing events for the current user's company (most recent first).
 * Only returns PAYMENT events with amounts for the receipt view.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const events = await prisma.billingEvent.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        amountCents: true,
        subscriptionStatus: true,
        paymentMethod: true,
        description: true,
        note: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error('[billing/history] Error:', err);
    return NextResponse.json({ events: [] });
  }
}
