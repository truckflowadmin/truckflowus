import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { formatPrice } from '@/lib/features';
import { getServerLang, t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  await requireSuperadmin();
  const lang = getServerLang();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [
    companyCount,
    activeCount,
    suspendedCount,
    plans,
    recent,
    companies,
    recentPayments,
    overdueEvents,
    trialEndingSoon,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { suspended: false } }),
    prisma.company.count({ where: { suspended: true } }),
    prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { companies: true } } },
    }),
    prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { plan: true },
    }),
    prisma.company.findMany({ include: { plan: true } }),
    // Revenue collected in last 30 days
    prisma.billingEvent.aggregate({
      _sum: { amountCents: true },
      where: {
        type: 'PAYMENT',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    // Overdue tenants in last 7 days
    prisma.billingEvent.findMany({
      where: {
        type: 'OVERDUE',
        createdAt: { gte: sevenDaysAgo },
      },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Trials ending within 7 days
    prisma.company.findMany({
      where: {
        trialEndsAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 86400000),
        },
        suspended: false,
      },
      select: { id: true, name: true, trialEndsAt: true },
    }),
  ]);

  // MRR = sum of each active company's effective price (custom override or plan price).
  const mrrCents = companies
    .filter((c) => !c.suspended)
    .reduce((sum, c) => sum + (c.customPriceCents ?? c.plan?.priceMonthlyCents ?? 0), 0);

  const collectedCents = recentPayments._sum.amountCents ?? 0;

  // Build billing alerts
  const billingAlerts: { type: 'error' | 'warning'; message: string; link?: string }[] = [];

  for (const oe of overdueEvents) {
    billingAlerts.push({
      type: 'error',
      message: `Overdue: ${oe.company.name} — ${oe.description}`,
      link: `/sa/tenants/${oe.company.id}/billing`,
    });
  }

  for (const te of trialEndingSoon) {
    const daysLeft = Math.ceil(
      (te.trialEndsAt!.getTime() - Date.now()) / 86400000,
    );
    billingAlerts.push({
      type: 'warning',
      message: `${te.name}'s trial ends in ${daysLeft} day(s)`,
      link: `/sa/tenants/${te.id}/billing`,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-white">{t('sa.platformOverview', lang)}</h1>
        <p className="text-purple-300 text-sm">{t('sa.tenantsSubtitle', lang)}</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        <StatCard label={t('sa.tenants', lang)} value={companyCount} />
        <StatCard label={t('sa.active', lang)} value={activeCount} />
        <StatCard label={t('sa.suspended', lang)} value={suspendedCount} />
        <StatCard label={t('sa.mrr', lang)} value={`$${(mrrCents / 100).toFixed(0)}`} />
        <StatCard label={t('sa.collected30d', lang)} value={`$${(collectedCents / 100).toFixed(0)}`} />
      </div>

      {/* ── Billing Alerts ── */}
      {billingAlerts.length > 0 && (
        <section className="panel-sa">
          <h2 className="font-semibold text-white mb-3">{t('sa.billingAlerts', lang)}</h2>
          <ul className="space-y-2">
            {billingAlerts.map((alert, i) => (
              <li
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
                  alert.type === 'error'
                    ? 'bg-red-900/30 border border-red-800 text-red-300'
                    : 'bg-yellow-900/20 border border-yellow-800 text-yellow-300'
                }`}
              >
                <span>
                  {alert.type === 'error' ? '⚠ ' : '⏳ '}
                  {alert.message}
                </span>
                {alert.link && (
                  <Link
                    href={alert.link}
                    className="text-xs underline hover:no-underline ml-3 whitespace-nowrap"
                  >
                    {t('sa.view', lang)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel-sa">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">{t('sa.planDistribution', lang)}</h2>
          <Link href="/sa/plans" className="text-sm text-purple-400 hover:text-purple-200">
            {t('sa.managePlans', lang)} →
          </Link>
        </header>
        <table className="w-full text-sm">
          <thead className="text-purple-400 text-left">
            <tr>
              <th className="py-2">{t('sa.plan', lang)}</th>
              <th className="py-2">{t('common.price', lang)}</th>
              <th className="py-2">{t('sa.tenants', lang)}</th>
            </tr>
          </thead>
          <tbody className="text-steel-100">
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-purple-900/40">
                <td className="py-2 font-medium">{p.name}</td>
                <td className="py-2">{formatPrice(p.priceMonthlyCents)}</td>
                <td className="py-2">{p._count.companies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel-sa">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">{t('sa.recentSignups', lang)}</h2>
          <Link href="/sa/tenants" className="text-sm text-purple-400 hover:text-purple-200">
            {t('sa.allTenants', lang)} →
          </Link>
        </header>
        <ul className="divide-y divide-purple-900/40 text-sm">
          {recent.map((c) => (
            <li key={c.id} className="py-2 flex items-center justify-between">
              <Link href={`/sa/tenants/${c.id}`} className="text-white hover:text-purple-300">
                {c.name}
              </Link>
              <span className="text-purple-300">
                {c.plan?.name ?? '—'}
                {c.suspended && <span className="ml-2 text-red-400">· suspended</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel-sa">
      <div className="text-xs uppercase tracking-wider text-purple-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}
