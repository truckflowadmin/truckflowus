import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';

export default async function SmsLogPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await requireSession();
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const pageSize = 50;

  const drivers = await prisma.driver.findMany({ where: { companyId: session.companyId }, select: { id: true } });
  const driverIds = drivers.map(d => d.id);

  const where = { OR: [{ driverId: { in: driverIds } }] };

  const [logs, total] = await Promise.all([
    prisma.smsLog.findMany({
      where,
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.smsLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Activity</div>
        <h1 className="text-3xl font-bold tracking-tight">SMS Log</h1>
        <p className="text-sm text-steel-500 mt-1">{total} message{total === 1 ? '' : 's'} total</p>
      </header>

      <div className="panel overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-steel-500">No SMS activity yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-5 py-2">Time</th>
                <th className="text-left px-5 py-2">Dir</th>
                <th className="text-left px-5 py-2">Driver</th>
                <th className="text-left px-5 py-2">Phone</th>
                <th className="text-left px-5 py-2">Message</th>
                <th className="text-left px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-steel-100 align-top">
                  <td className="px-5 py-3 text-xs text-steel-500 whitespace-nowrap">{format(l.createdAt, 'MMM d h:mm a')}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${l.direction === 'OUTBOUND' ? 'bg-safety text-diesel' : 'bg-steel-200 text-steel-800'}`}>
                      {l.direction === 'OUTBOUND' ? 'OUT' : 'IN'}
                    </span>
                  </td>
                  <td className="px-5 py-3">{l.driver?.name ?? <span className="text-steel-400">—</span>}</td>
                  <td className="px-5 py-3 font-mono text-xs">{l.phone}</td>
                  <td className="px-5 py-3 max-w-md">
                    <pre className="whitespace-pre-wrap text-xs">{l.message}</pre>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {l.success ? (
                      <span className="text-green-700">OK</span>
                    ) : (
                      <span className="text-red-600">{l.error ?? 'Failed'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-steel-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={`/sms?page=${page - 1}`} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/sms?page=${page + 1}`} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
