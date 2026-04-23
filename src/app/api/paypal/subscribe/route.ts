import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSubscription } from '@/lib/paypal';

/**
 * POST /api/paypal/subscribe
 * Dispatcher initiates a PayPal subscription checkout.
 * Returns a redirect URL to PayPal's hosted approval page.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.companyId) {
      return NextResponse.json({ error: 'No company linked' }, { status: 400 });
    }

    const body = await req.json();
    const planId = body.planId as string;
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Look up the plan and its PayPal plan ID
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get paypalPlanId via raw query (field may not be in generated client)
    const rows = await prisma.$queryRaw<{ paypalPlanId: string | null }[]>`
      SELECT "paypalPlanId" FROM "Plan" WHERE "id" = ${planId} LIMIT 1
    `;
    const paypalPlanId = rows[0]?.paypalPlanId;
    if (!paypalPlanId) {
      return NextResponse.json(
        { error: 'This plan is not configured for PayPal payments. Contact support.' },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { name: true, email: true },
    });

    const { subscriptionId, approvalUrl } = await createSubscription({
      paypalPlanId,
      companyId: session.companyId,
      companyName: company?.name || 'Customer',
      email: company?.email || session.email,
    });

    // Store the pending subscription ID
    await prisma.$executeRaw`
      UPDATE "Company"
      SET "paypalSubscriptionId" = ${subscriptionId},
          "paypalPlanId" = ${paypalPlanId},
          "subscriptionStatus" = 'APPROVAL_PENDING'
      WHERE "id" = ${session.companyId}
    `;

    return NextResponse.json({ approvalUrl });
  } catch (err: any) {
    console.error('[paypal/subscribe]', err);
    return NextResponse.json({ error: err.message || 'Failed to create subscription' }, { status: 500 });
  }
}
