import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function TenantsPage() {
  await requireSuperadmin();
  const lang = getServerLang();

  const tenants = await prisma.company.findMany({
    orderBy: [{ suspended: 'asc' }, { name: 'asc' }],
    include: {
      plan: true,
      _count: { select: { users: true, drivers: true } },
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-white">{t('sa.tenants', lang)}</h1>
        <p className="text-purple-300 text-sm">
          {tenants.length} {t('sa.companies', lang)} {t('sa.onPlatform', lang)}
        </p>
      </header>

      <div className="panel-sa p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="text-purple-400 text-left">
            <tr className="border-b border-purple-900/40">
              <th className="px-4 py-3">{t('common.company', lang)}</th>
              <th className="px-4 py-3">{t('sa.plan', lang)}</th>
              <th className="px-4 py-3">{t('sa.dispatchers', lang)}</th>
              <th className="px-4 py-3">{t('sa.drivers', lang)}</th>
              <th className="px-4 py-3">{t('common.status', lang)}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="text-steel-100">
            {tenants.map((tn) => (
              <tr key={tn.id} className="border-t border-purple-900/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{tn.name}</div>
                  <div className="text-xs text-purple-300">
                    {[tn.city, tn.state].filter(Boolean).join(', ') || '—'}
                  </div>
                </td>
                <td className="px-4 py-3">{tn.plan?.name ?? '—'}</td>
                <td className="px-4 py-3">{tn._count.users}</td>
                <td className="px-4 py-3">{tn._count.drivers}</td>
                <td className="px-4 py-3">
                  {tn.suspended ? (
                    <span className="badge bg-red-900 text-red-200">{t('sa.suspended', lang)}</span>
                  ) : (
                    <span className="badge bg-emerald-900 text-emerald-200">{t('common.active', lang)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/sa/tenants/${tn.id}`}
                    className="text-purple-400 hover:text-purple-200"
                  >
                    {t('sa.manage', lang)} →
                  </Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-purple-300">
                  {t('sa.noTenants', lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
