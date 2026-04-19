import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TenantsPage() {
  await requireSuperadmin();

  const tenants = await prisma.company.findMany({
    orderBy: [{ suspended: 'asc' }, { name: 'asc' }],
    include: {
      plan: true,
      _count: { select: { users: true, drivers: true } },
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="text-purple-300 text-sm">
          {tenants.length} compan{tenants.length === 1 ? 'y' : 'ies'} on the platform.
        </p>
      </header>

      <div className="panel-sa p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-purple-400 text-left">
            <tr className="border-b border-purple-900/40">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Dispatchers</th>
              <th className="px-4 py-3">Drivers</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="text-steel-100">
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-purple-900/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{t.name}</div>
                  <div className="text-xs text-purple-300">
                    {[t.city, t.state].filter(Boolean).join(', ') || '—'}
                  </div>
                </td>
                <td className="px-4 py-3">{t.plan?.name ?? '—'}</td>
                <td className="px-4 py-3">{t._count.users}</td>
                <td className="px-4 py-3">{t._count.drivers}</td>
                <td className="px-4 py-3">
                  {t.suspended ? (
                    <span className="badge bg-red-900 text-red-200">Suspended</span>
                  ) : (
                    <span className="badge bg-emerald-900 text-emerald-200">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/sa/tenants/${t.id}`}
                    className="text-purple-400 hover:text-purple-200"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-purple-300">
                  No tenants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
