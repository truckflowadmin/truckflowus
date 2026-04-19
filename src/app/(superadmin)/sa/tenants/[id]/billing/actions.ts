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
  ]);
}
