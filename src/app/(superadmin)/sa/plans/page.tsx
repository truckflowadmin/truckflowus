import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { formatPrice } from '@/lib/features';
import { getServerLang, t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  await requireSuperadmin();
  const lang = getServerLang();

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { companies: true } } },
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-white">{t('sa.subscriptionPlans', lang)}</h1>
        <p className="text-purple-300 text-sm">
          {t('sa.plansSubtitle', lang)}
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="panel-sa flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-purple-400 text-xs uppercase tracking-wider">{p.key}</div>
                <h2 className="text-xl font-bold text-white">{p.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {formatPrice(p.priceMonthlyCents)}
                </div>
                {!p.active && <div className="text-xs text-red-400">{t('common.inactive', lang)}</div>}
              </div>
            </div>
            {p.description && (
              <p className="text-sm text-purple-200 mb-3">{p.description}</p>
            )}
            <ul className="text-xs text-purple-300 space-y-1 mb-3">
              <li>
                {t('sa.drivers', lang)}: <span className="text-white">{p.maxDrivers ?? t('sa.unlimited', lang)}</span>
              </li>
              <li>
                {t('sa.ticketsPerMonth', lang)}:{' '}
                <span className="text-white">{p.maxTicketsPerMonth ?? t('sa.unlimited', lang)}</span>
              </li>
              <li>
                {t('sa.features', lang)}: <span className="text-white">{p.features.length}</span>
              </li>
              <li>
                {t('sa.tenantsOnPlan', lang)}: <span className="text-white">{p._count.companies}</span>
              </li>
            </ul>
            <div className="mt-auto pt-2">
              <Link href={`/sa/plans/${p.id}/edit`} className="btn-purple w-full">
                {t('common.edit', lang)}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
