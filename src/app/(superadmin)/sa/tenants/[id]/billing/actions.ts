'use server';

import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';

// ── Record a payment (Zelle, cash, check, etc.) ───────────────────────────

interface RecordPaymentOpts {
  companyId: string;
  amountCents: number;
  paymentMethod: string;
  description: string;
  note?: string;
  actor: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export async function recordPaymentAction(opts: RecordPaymentOpts) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.billingEvent.create({
      data: {
        companyId: opts.companyId,
        type: 'PAYMENT',
        amountCents: opts.amountCents,
        paymentMethod: opts.paymentMethod,
        description: opts.description,
        note: opts.note,
        actor: opts.actor,
        subscriptionStatus: 'ACTIVE', // payment received → active
        periodStart: opts.periodStart,
        periodEnd: opts.periodEnd,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId: opts.companyId,
        entityType: 'billing',
        action: 'payment_recorded',
        actor: opts.actor,
        actorRole: 'SUPERADMIN',
        summary: `Recorded ${opts.paymentMethod} payment of $${(opts.amountCents / 100).toFixed(2)}`,
        details: JSON.stringify({
          amountCents: opts.amountCents,
          method: opts.paymentMethod,
          description: opts.description,
          note: opts.note,
        }),
      },
    }),
  ]);
}

// ── Record an adjustment (credit, discount, write-off) ────────────────────

interface RecordAdjustmentOpts {
  companyId: string;
  amountCents: number;
  description: string;
  note?: string;
  actor: string;
}

export async function recordAdjustmentAction(opts: RecordAdjustmentOpts) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.billingEvent.create({
      data: {
        companyId: opts.companyId,
        type: 'ADJUSTMENT',
        amountCents: opts.amountCents,
        description: opts.description,
        note: opts.note,
        actor: opts.actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId: opts.companyId,
        entityType: 'billing',
        action: 'adjustment_recorded',
        actor: opts.actor,
        actorRole: 'SUPERADMIN',
        summary: `Recorded adjustment of $${(opts.amountCents / 100).toFixed(2)}: ${opts.description}`,
        details: JSON.stringify({
          amountCents: opts.amountCents,
          description: opts.description,
          note: opts.note,
        }),
      },
    }),
  ]);
}

// ── Set or clear custom price override ────────────────────────────────────

export async function updateCustomPriceAction(
  companyId: string,
  customPriceCents: number | null,
) {
  const session = await requireSuperadmin();

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { customPriceCents: true },
  });

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { customPriceCents },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'custom_price_change',
        actor: session.email,
        actorRole: 'SUPERADMIN',
        summary:
          customPriceCents !== null
            ? `Set custom price to $${(customPriceCents / 100).toFixed(2)}/mo`
            : 'Removed custom price override',
        details: JSON.stringify({
          previous: company.customPriceCents,
          new: customPriceCents,
        }),
      },
    }),
  ]);
}

// ── Mark tenant as overdue ────────────────────────────────────────────────

export async function markOverdueAction(companyId: string, actor: string) {
  await requireSuperadmin();

  await prisma.billingEvent.create({
    data: {
      companyId,
      type: 'OVERDUE',
      description: 'Payment marked as overdue',
      subscriptionStatus: 'PAST_DUE',
      actor,
    },
  });
}

// ── Update subscription status ────────────────────────────────────────────

export async function updateStatusAction(
  companyId: string,
  status: string,
  actor: string,
) {
  await requireSuperadmin();

  // Validate status
  const validStatuses = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  const updateData: Record<string, unknown> = {};
  if (status === 'PAUSED') {
    updateData.subscriptionPausedAt = new Date();
  }
  if (status === 'ACTIVE') {
    updateData.subscriptionResumedAt = new Date();
    updateData.suspended = false;
    updateData.suspendedAt = null;
  }

  await prisma.$transaction([
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'PLAN_CHANGE',
        description: `Status changed to ${status}`,
        subscriptionStatus: status as 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED',
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'status_change',
        actor,
        actorRole: 'SUPERADMIN',
        summary: `Billing status changed to ${status}`,
      },
    }),
    ...(Object.keys(updateData).length > 0
      ? [prisma.company.update({ where: { id: companyId }, data: updateData as any })]
      : []),
  ]);
}

// ── Set trial end date ───────────────────────────────────────────────────

export async function setTrialEndDateAction(
  companyId: string,
  trialEndsAt: Date | null,
  actor: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { trialEndsAt },
    }),
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'TRIAL_STARTED',
        description: trialEndsAt
          ? `Trial end date set to ${trialEndsAt.toLocaleDateString()}`
          : 'Trial end date cleared',
        subscriptionStatus: trialEndsAt ? 'TRIALING' : undefined,
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'trial_date_change',
        actor,
        actorRole: 'SUPERADMIN',
        summary: trialEndsAt
          ? `Set trial end date to ${trialEndsAt.toLocaleDateString()}`
          : 'Cleared trial end date',
      },
    }),
  ]);
}

// ── Set next payment due date ────────────────────────────────────────────

export async function setNextPaymentDueAction(
  companyId: string,
  nextPaymentDue: Date | null,
  actor: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { nextPaymentDue } as any,
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'next_payment_due_change',
        actor,
        actorRole: 'SUPERADMIN',
        summary: nextPaymentDue
          ? `Set next payment due to ${nextPaymentDue.toLocaleDateString()}`
          : 'Cleared next payment due date',
      },
    }),
  ]);
}

// ── Set grace period days ────────────────────────────────────────────────

export async function setGracePeriodAction(
  companyId: string,
  gracePeriodDays: number,
  actor: string,
) {
  await requireSuperadmin();

  if (gracePeriodDays < 0 || gracePeriodDays > 90) {
    throw new Error('Grace period must be between 0 and 90 days');
  }

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { gracePeriodDays } as any,
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'grace_period_change',
        actor,
        actorRole: 'SUPERADMIN',
        summary: `Set grace period to ${gracePeriodDays} days`,
      },
    }),
  ]);
}

// ── Toggle auto-suspend on overdue ───────────────────────────────────────

export async function toggleAutoSuspendAction(
  companyId: string,
  enabled: boolean,
  actor: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { autoSuspendOnOverdue: enabled } as any,
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'auto_suspend_toggle',
        actor,
        actorRole: 'SUPERADMIN',
        summary: `Auto-suspend on overdue ${enabled ? 'enabled' : 'disabled'}`,
      },
    }),
  ]);
}

// ── Suspend tenant for non-payment ───────────────────────────────────────

export async function suspendForNonPaymentAction(
  companyId: string,
  actor: string,
  note?: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { suspended: true, suspendedAt: new Date() },
    }),
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'SUSPENSION' as any,
        description: 'Account suspended for non-payment',
        subscriptionStatus: 'CANCELLED',
        note,
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'suspended_non_payment',
        actor,
        actorRole: 'SUPERADMIN',
        summary: 'Account suspended for non-payment',
        details: note ? JSON.stringify({ note }) : undefined,
      },
    }),
  ]);
}

// ── Reactivate a suspended tenant ────────────────────────────────────────

export async function reactivateAccountAction(
  companyId: string,
  actor: string,
  note?: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        suspended: false,
        suspendedAt: null,
        subscriptionResumedAt: new Date(),
      } as any,
    }),
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'REACTIVATION' as any,
        description: 'Account reactivated',
        subscriptionStatus: 'ACTIVE',
        note,
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'account_reactivated',
        actor,
        actorRole: 'SUPERADMIN',
        summary: 'Account reactivated after suspension',
        details: note ? JSON.stringify({ note }) : undefined,
      },
    }),
  ]);
}

// ── Log a payment reminder ───────────────────────────────────────────────

export async function logPaymentReminderAction(
  companyId: string,
  method: string,
  actor: string,
  note?: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'REMINDER' as any,
        description: `Payment reminder sent via ${method}`,
        note,
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'payment_reminder',
        actor,
        actorRole: 'SUPERADMIN',
        summary: `Payment reminder sent via ${method}`,
      },
    }),
  ]);
}

// ── Pause subscription ───────────────────────────────────────────────────

export async function pauseSubscriptionAction(
  companyId: string,
  actor: string,
  note?: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { subscriptionPausedAt: new Date() } as any,
    }),
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'PLAN_CHANGE',
        description: 'Subscription paused',
        subscriptionStatus: 'PAUSED',
        note,
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'subscription_paused',
        actor,
        actorRole: 'SUPERADMIN',
        summary: 'Subscription paused',
      },
    }),
  ]);
}

// ── Resume subscription ──────────────────────────────────────────────────

export async function resumeSubscriptionAction(
  companyId: string,
  actor: string,
  note?: string,
) {
  await requireSuperadmin();

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        subscriptionPausedAt: null,
        subscriptionResumedAt: new Date(),
      } as any,
    }),
    prisma.billingEvent.create({
      data: {
        companyId,
        type: 'PLAN_CHANGE',
        description: 'Subscription resumed',
        subscriptionStatus: 'ACTIVE',
        note,
        actor,
      },
    }),
    prisma.auditLog.create({
      data: {
        companyId,
        entityType: 'billing',
        action: 'subscription_resumed',
        actor,
        actorRole: 'SUPERADMIN',
        summary: 'Subscription resumed',
      },
    }),
  ]);
}
