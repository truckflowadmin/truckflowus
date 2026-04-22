import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import Link from 'next/link';
import { format } from 'date-fns';

export default async function SuperadminMessagingPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await requireSuperadmin();
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const pageSize = 50;

  // Stats across all tenants
  const [smsTotal, smsFailed] = await Promise.all([
    prisma.smsLog.count(),
    prisma.smsLog.count({ where: { success: false } }),
  ]);

  // Paginated SMS logs
  const [logs, total] = await Promise.all([
    prisma.smsLog.findMany({
      include: {
        driver: { select: { name: true } },
        broker: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.smsLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Platform</div>
        <h1 className="text-3xl font-bold tracking-tight">SMS Log — All Tenants</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold">{smsTotal}</div>
          <div className="text-xs text-steel-500 uppercase">Total SMS</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{smsFailed}</div>
          <div className="text-xs text-steel-500 uppercase">SMS Failed</div>
        </div>
      </div>

      {/* SMS Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Dir</th>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="text-left px-4 py-2">Message</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-b border-steel-100 align-top hover:bg-steel-50">
                  <td className="px-4 py-3 text-xs text-steel-500 whitespace-nowrap">{format(l.createdAt, 'MMM d h:mm a')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${l.direction === 'OUTBOUND' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {l.direction === 'OUTBOUND' ? 'OUT' : 'IN'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{l.driver?.name || l.broker?.name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{l.phone}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <pre className="whitespace-pre-wrap text-xs">{l.message?.slice(0, 200)}</pre>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.success ? <span className="text-green-700">✓</span> : <span className="text-red-600">✗ {l.error?.slice(0, 30)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-steel-500">Page {page} of {totalPages}</div>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={`/sa/messaging?page=${page - 1}`} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/sa/messaging?page=${page + 1}`} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
