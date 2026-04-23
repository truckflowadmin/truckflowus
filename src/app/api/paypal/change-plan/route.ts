import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelSubscription, createSubscription } from '@/lib/paypal';

/**
 * POST /api/paypal/change-plan
 * Dispatcher changes their plan (upgrade or downgrade).
 * Cancels the existing PayPal subscription, then creates a new one.
 * Blocks downgrade to the Free plan.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.companyId) {
      return NextResponse.json({ error: 'No company linked' }, { status: 400 });
    }

    const body = await req.json();
    const newPlanId = body.planId as string;
    if (!newPlanId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Look up the target plan
    const newPlan = await prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!newPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Block downgrade to free plan
    if (newPlan.priceMonthlyCents === 0) {
      return NextResponse.json(
        { error: 'Downgrading to the Free plan is not permitted. Please contact support if you need to cancel your subscription.' },
        { status: 400 },
      );
    }

    // Get PayPal plan ID for the target plan
    const planRows = await prisma.$queryRaw<{ paypalPlanId: string | null }[]>`
      SELECT "paypalPlanId" FROM "Plan" WHERE "id" = ${newPlanId} LIMIT 1
    `;
    const newPaypalPlanId = planRows[0]?.paypalPlanId;
    if (!newPaypalPlanId) {
      return NextResponse.json(
        { error: 'This plan is not configured for PayPal payments. Contact support.' },
        { status: 400 },
      );
    }

    // Get current subscription info
    const companyRows = await prisma.$queryRaw<{
      paypalSubscriptionId: string | null;
      subscriptionStatus: string | null;
      planId: string | null;
    }[]>`
      SELECT "paypalSubscriptionId", "subscriptionStatus", "planId"
      FROM "Company" WHERE "id" = ${session.companyId} LIMIT 1
    `;
    const currentSubId = companyRows[0]?.paypalSubscriptionId;
    const currentStatus = companyRows[0]?.subscriptionStatus;
    const currentPlanId = companyRows[0]?.planId;

    // If same plan, reject
    if (currentPlanId === newPlanId) {
      return NextResponse.json({ error: 'You are already on this plan.' }, { status: 400 });
    }

    // Cancel existing PayPal subscription if active
    if (currentSubId && currentStatus && !['CANCELLED', 'EXPIRED'].includes(currentStatus)) {
      try {
        await cancelSubscription(currentSubId, `Plan change to ${newPlan.name}`);
      } catch (err: any) {
        console.error('[change-plan] Failed to cancel existing subscription:', err.message);
        // Continue anyway — the old sub might already be cancelled
      }
    }

    // Get company info for new subscription
    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { name: true, email: true },
    });

    // Create new PayPal subscription
    const { subscriptionId, approvalUrl } = await createSubscription({
      paypalPlanId: newPaypalPlanId,
      companyId: session.companyId,
      companyName: company?.name || 'Customer',
      email: company?.email || session.email,
    });

    // Store the pending subscription and target plan
    await prisma.$executeRaw`
      UPDATE "Company"
      SET "paypalSubscriptionId" = ${subscriptionId},
          "paypalPlanId" = ${newPaypalPlanId},
          "subscriptionStatus" = 'APPROVAL_PENDING',
          "pendingPlanId" = ${newPlanId}
      WHERE "id" = ${session.companyId}
    `;

    // Log the plan change attempt
    await prisma.auditLog.create({
      data: {
        companyId: session.companyId,
        entityType: 'billing',
        action: 'plan_change_initiated',
        actor: session.email,
        actorRole: 'DISPATCHER',
        summary: `Plan change initiated to ${newPlan.name}`,
        details: JSON.stringify({
          fromPlanId: currentPlanId,
          toPlanId: newPlanId,
          newPaypalSubscriptionId: subscriptionId,
          oldPaypalSubscriptionId: currentSubId,
        }),
      },
    });

    return NextResponse.json({ approvalUrl });
  } catch (err: any) {
    console.error('[paypal/change-plan]', err);
    return NextResponse.json({ error: err.message || 'Failed to change plan' }, { status: 500 });
  }
}
