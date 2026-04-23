import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { formatPrice } from '@/lib/features';
import TenantNav from '@/components/TenantNav';
import { BillingActions } from './BillingActions';
import { BillingControls } from './BillingControls';

export const dynamic = 'force-dynamic';

export default async function BillingPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSuperadmin();
  const { id } = params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      plan: true,
      billingEvents: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!company) notFound();

  // Fetch all active plans for the plan change dropdown
  const allPlansRaw = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, priceMonthlyCents: true, maxDrivers: true, maxTicketsPerMonth: true },
  });

  // Fetch limit overrides and usage counts
  let limitInfo = { maxDriversOverride: null as number | null, maxTicketsPerMonthOverride: null as number | null };
  try {
    const limitRows = await prisma.$queryRaw<typeof limitInfo[]>`
      SELECT "maxDriversOverride", "maxTicketsPerMonthOverride"
      FROM "Company" WHERE "id" = ${id} LIMIT 1
    `;
    if (limitRows[0]) limitInfo = limitRows[0];
  } catch { /* fields may not exist yet */ }

  const currentDriverCount = await prisma.driver.count({ where: { companyId: id } });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const currentMonthTicketCount = await prisma.ticket.count({
    where: { companyId: id, createdAt: { gte: monthStart, lt: monthEnd } },
  });

  // Cast to include new billing fields not yet in generated Prisma types
  const c = company as typeof company & {
    nextPaymentDue: Date | null;
    gracePeriodDays: number;
    autoSuspendOnOverdue: boolean;
    subscriptionPausedAt: Date | null;
    subscriptionResumedAt: Date | null;
    paypalSubscriptionId: string | null;
    paypalPlanId: string | null;
    paypalPayerEmail: string | null;
    subscriptionStatus: string | null;
  };

  // Fetch PayPal fields via raw query (may not be in generated types)
  let paypalInfo = { paypalSubscriptionId: null as string | null, paypalPlanId: null as string | null, paypalPayerEmail: null as string | null, subscriptionStatus: null as string | null };
  try {
    const ppRows = await prisma.$queryRaw<typeof paypalInfo[]>`
      SELECT "paypalSubscriptionId", "paypalPlanId", "paypalPayerEmail", "subscriptionStatus"
      FROM "Company" WHERE "id" = ${id} LIMIT 1
    `;
    if (ppRows[0]) paypalInfo = ppRows[0];
  } catch { /* fields may not exist yet */ }

  const now = new Date();

  // Payment stats
  const payments = company.billingEvents.filter((e) => e.type === 'PAYMENT');
  const totalCollected = payments.reduce((sum, e) => sum + e.amountCents, 0);
  const overdueEvents = company.billingEvents.filter((e) => e.type === 'OVERDUE');

  // Determine current status from most recent status event
  const lastStatusEvent = company.billingEvents.find(
    (e) => e.subscriptionStatus !== null,
  );
  const currentStatus = lastStatusEvent?.subscriptionStatus ?? 'ACTIVE';

  // Last payment date
  const lastPayment = payments[0];
  const lastPaymentDate = lastPayment
    ? lastPayment.createdAt.toLocaleDateString()
    : 'Never';

  // Alerts
  const alerts: { type: 'error' | 'warning' | 'info'; message: string }[] = [];

  if (currentStatus === 'PAST_DUE') {
    alerts.push({ type: 'error', message: 'Account is past due — payment needed' });
  }

  if (overdueEvents.length > 0) {
    const latest = overdueEvents[0];
    alerts.push({
      type: 'error',
      message: `Overdue: ${latest.description}`,
    });
  }

  if (company.trialEndsAt) {
    const daysLeft = Math.ceil(
      (company.trialEndsAt.getTime() - now.getTime()) / 86400000,
    );
    if (daysLeft > 0 && daysLeft <= 7) {
      alerts.push({ type: 'warning', message: `Trial ends in ${daysLeft} day(s)` });
    } else if (daysLeft <= 0) {
      alerts.push({ type: 'info', message: 'Trial has ended' });
    }
  }

  // Check if payment is overdue based on plan price and last payment
  const effectivePrice = company.customPriceCents ?? company.plan?.priceMonthlyCents ?? 0;
  if (effectivePrice > 0 && lastPayment) {
    const daysSincePayment = Math.floor(
      (now.getTime() - lastPayment.createdAt.getTime()) / 86400000,
    );
    if (daysSincePayment > 35) {
      alerts.push({
        type: 'warning',
        message: `Last payment was ${daysSincePayment} days ago`,
      });
    }
  } else if (effectivePrice > 0 && !lastPayment) {
    alerts.push({ type: 'warning', message: 'No payments recorded yet for this tenant' });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <header>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-purple-300 text-sm">
          Payment tracking for {company.name}
        </p>
      </header>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`px-4 py-3 rounded-lg text-sm font-medium ${
                alert.type === 'error'
                  ? 'bg-red-900/40 border border-red-700 text-red-300'
                  : alert.type === 'warning'
                    ? 'bg-yellow-900/30 border border-yellow-700 text-yellow-300'
                    : 'bg-blue-900/30 border border-blue-700 text-blue-300'
              }`}
            >
              {alert.type === 'error' && '⚠ '}
              {alert.type === 'warning' && '⏳ '}
              {alert.type === 'info' && 'ℹ '}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Overview Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Plan" value={company.plan?.name ?? 'None'} />
        <StatCard
          label="Monthly Price"
          value={
            company.customPriceCents !== null
              ? `${formatCentsDisplay(company.customPriceCents)} (custom)`
              : formatPrice(company.plan?.priceMonthlyCents ?? 0)
          }
        />
        <StatCard label="Total Collected" value={formatCentsDisplay(totalCollected)} />
        <StatCard label="Last Payment" value={lastPaymentDate} />
      </div>

      {/* ── Details ── */}
      <div className="panel-sa">
        <h2 className="font-semibold text-white mb-4">Billing Details</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-purple-400">Status:</span>{' '}
            <StatusBadge status={currentStatus} />
          </div>
          <div>
            <span className="text-purple-400">Trial Ends:</span>{' '}
            <span className="text-white">
              {company.trialEndsAt ? company.trialEndsAt.toLocaleDateString() : '—'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Custom Price Override:</span>{' '}
            <span className="text-white">
              {company.customPriceCents !== null
                ? formatCentsDisplay(company.customPriceCents)
                : 'None (using plan price)'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Plan Base Price:</span>{' '}
            <span className="text-white">
              {formatPrice(company.plan?.priceMonthlyCents ?? 0)}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Next Payment Due:</span>{' '}
            <span className="text-white">
              {c.nextPaymentDue ? c.nextPaymentDue.toLocaleDateString() : '—'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Grace Period:</span>{' '}
            <span className="text-white">{c.gracePeriodDays} days</span>
          </div>
          <div>
            <span className="text-purple-400">Auto-Suspend:</span>{' '}
            <span className={c.autoSuspendOnOverdue ? 'text-red-400' : 'text-white'}>
              {c.autoSuspendOnOverdue ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Total Payments:</span>{' '}
            <span className="text-white">{payments.length}</span>
          </div>
          <div>
            <span className="text-purple-400">Company Email:</span>{' '}
            <span className="text-white">{company.email || '—'}</span>
          </div>
          <div>
            <span className="text-purple-400">Account State:</span>{' '}
            <span className={company.suspended ? 'text-red-400 font-medium' : 'text-green-400'}>
              {company.suspended ? 'SUSPENDED' : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* ── PayPal Subscription ── */}
      <div className="panel-sa">
        <h2 className="font-semibold text-white mb-4">PayPal Subscription</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-purple-400">PayPal Status:</span>{' '}
            <span className={`font-medium ${
              paypalInfo.subscriptionStatus === 'ACTIVE' ? 'text-green-400'
                : paypalInfo.subscriptionStatus === 'SUSPENDED' || paypalInfo.subscriptionStatus === 'PAYMENT_FAILED' ? 'text-red-400'
                : paypalInfo.subscriptionStatus === 'CANCELLED' || paypalInfo.subscriptionStatus === 'EXPIRED' ? 'text-steel-400'
                : paypalInfo.subscriptionStatus === 'APPROVAL_PENDING' ? 'text-yellow-400'
                : 'text-steel-500'
            }`}>
              {paypalInfo.subscriptionStatus?.replace('_', ' ') || 'Not Connected'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Subscription ID:</span>{' '}
            <span className="text-white font-mono text-xs">
              {paypalInfo.paypalSubscriptionId || '—'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">PayPal Plan ID:</span>{' '}
            <span className="text-white font-mono text-xs">
              {paypalInfo.paypalPlanId || '—'}
            </span>
          </div>
          <div>
            <span className="text-purple-400">Payer Email:</span>{' '}
            <span className="text-white">
              {paypalInfo.paypalPayerEmail || '—'}
            </span>
          </div>
        </div>
        {!paypalInfo.paypalSubscriptionId && (
          <p className="text-purple-500 text-xs mt-3">
            This tenant has not set up PayPal payments. The dispatcher can subscribe from their Settings page.
          </p>
        )}
      </div>

      {/* ── Tenant Controls ── */}
      <BillingControls
        companyId={company.id}
        companyName={company.name}
        actorEmail={session.email}
        trialEndsAt={company.trialEndsAt?.toISOString() ?? null}
        nextPaymentDue={c.nextPaymentDue?.toISOString() ?? null}
        gracePeriodDays={c.gracePeriodDays ?? 7}
        autoSuspendOnOverdue={c.autoSuspendOnOverdue ?? false}
        suspended={company.suspended}
        subscriptionPausedAt={c.subscriptionPausedAt?.toISOString() ?? null}
        lastPaymentDate={lastPayment?.createdAt.toISOString() ?? null}
        currentStatus={currentStatus}
        planMaxDrivers={company.plan?.maxDrivers ?? null}
        planMaxTicketsPerMonth={company.plan?.maxTicketsPerMonth ?? null}
        maxDriversOverride={limitInfo.maxDriversOverride}
        maxTicketsPerMonthOverride={limitInfo.maxTicketsPerMonthOverride}
        currentDriverCount={currentDriverCount}
        currentMonthTicketCount={currentMonthTicketCount}
        currentPlanId={company.planId}
        allPlans={allPlansRaw}
      />

      {/* ── Actions ── */}
      <BillingActions
        companyId={company.id}
        companyName={company.name}
        currentStatus={currentStatus}
        customPriceCents={company.customPriceCents}
        actorEmail={session.email}
        paypalSubscriptionId={paypalInfo.paypalSubscriptionId}
        paypalSubscriptionStatus={paypalInfo.subscriptionStatus}
      />

      {/* ── Payment History ── */}
      <div className="panel-sa">
        <h2 className="font-semibold text-white mb-4">Payment History</h2>
        {company.billingEvents.length === 0 ? (
          <p className="text-purple-400 text-sm">No billing events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-purple-400 text-left">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2">Recorded By</th>
                </tr>
              </thead>
              <tbody className="text-steel-100">
                {company.billingEvents.map((event) => (
                  <tr key={event.id} className="border-t border-purple-900/40">
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {event.createdAt.toLocaleDateString()}{' '}
                      <span className="text-purple-500 text-xs">
                        {event.createdAt.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <EventBadge type={event.type} />
                    </td>
                    <td className="py-2.5 pr-4">
                      {event.description}
                      {event.note && (
                        <span className="block text-xs text-purple-400 mt-0.5">
                          Note: {event.note}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-purple-300">
                      {event.paymentMethod || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono">
                      {event.amountCents > 0
                        ? formatCentsDisplay(event.amountCents)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-purple-400 text-xs">
                      {event.actor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-sa">
      <div className="text-xs uppercase tracking-wider text-purple-400">{label}</div>
      <div className="text-lg font-bold text-white mt-1 truncate">{value}</div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    PAYMENT: 'bg-green-900/50 text-green-300 border-green-700',
    ADJUSTMENT: 'bg-purple-900/50 text-purple-300 border-purple-700',
    PLAN_CHANGE: 'bg-blue-900/50 text-blue-300 border-blue-700',
    TRIAL_STARTED: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
    OVERDUE: 'bg-red-900/50 text-red-300 border-red-700',
    REMINDER: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    SUSPENSION: 'bg-red-900/60 text-red-200 border-red-600',
    REACTIVATION: 'bg-green-900/50 text-green-300 border-green-700',
  };
  const labels: Record<string, string> = {
    PAYMENT: 'Payment',
    ADJUSTMENT: 'Adjustment',
    PLAN_CHANGE: 'Plan Change',
    TRIAL_STARTED: 'Trial',
    OVERDUE: 'Overdue',
    REMINDER: 'Reminder',
    SUSPENSION: 'Suspension',
    REACTIVATION: 'Reactivated',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colors[type] ?? 'bg-steel-800 text-steel-300 border-steel-600'}`}
    >
      {labels[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'text-green-400',
    TRIALING: 'text-cyan-400',
    PAST_DUE: 'text-red-400',
    CANCELLED: 'text-red-400',
    PAUSED: 'text-yellow-400',
    SUSPENDED: 'text-orange-400',
    PAYMENT_FAILED: 'text-red-400',
    EXPIRED: 'text-steel-400',
    APPROVAL_PENDING: 'text-yellow-400',
  };
  return (
    <span className={`text-sm font-medium ${colors[status] ?? 'text-steel-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function formatCentsDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
