import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import Link from 'next/link';
import { format } from 'date-fns';

export default async function SuperadminMessagingPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string };
}) {
  await requireSuperadmin();
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const type = searchParams.type || 'sms'; // sms or fax
  const pageSize = 50;

  // Stats across all tenants
  const [smsTotal, faxTotal, smsFailed, faxFailed] = await Promise.all([
    prisma.smsLog.count(),
    prisma.faxLog.count(),
    prisma.smsLog.count({ where: { success: false } }),
    prisma.faxLog.count({ where: { status: 'FAILED' } }),
  ]);

  // Paginated logs
  let logs: any[] = [];
  let total = 0;

  if (type === 'sms') {
    [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        include: {
          company: { select: { name: true } },
          driver: { select: { name: true } },
          broker: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsLog.count(),
    ]);
  } else {
    [logs, total] = await Promise.all([
      prisma.faxLog.findMany({
        include: {
          company: { select: { name: true } },
          driver: { select: { name: true } },
          broker: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.faxLog.count(),
    ]);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Platform</div>
        <h1 className="text-3xl font-bold tracking-tight">SMS &amp; Fax — All Tenants</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold">{smsTotal}</div>
          <div className="text-xs text-steel-500 uppercase">Total SMS</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold">{faxTotal}</div>
          <div className="text-xs text-steel-500 uppercase">Total Faxes</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{smsFailed}</div>
          <div className="text-xs text-steel-500 uppercase">SMS Failed</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{faxFailed}</div>
          <div className="text-xs text-steel-500 uppercase">Fax Failed</div>
        </div>
      </div>

      {/* Toggle SMS / Fax */}
      <div className="flex gap-2 mb-4">
        <Link
          href="/sa/messaging?type=sms"
          className={`px-4 py-2 rounded text-sm font-medium border ${type === 'sms' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-steel-600 border-steel-300 hover:bg-steel-50'}`}
        >
          SMS Log ({smsTotal})
        </Link>
        <Link
          href="/sa/messaging?type=fax"
          className={`px-4 py-2 rounded text-sm font-medium border ${type === 'fax' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-steel-600 border-steel-300 hover:bg-steel-50'}`}
        >
          Fax Log ({faxTotal})
        </Link>
      </div>

      {/* SMS Table */}
      {type === 'sms' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Company</th>
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
                    <td className="px-4 py-3 text-xs font-medium">{l.company?.name || <span className="text-steel-400">—</span>}</td>
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
      )}

      {/* Fax Table */}
      {type === 'fax' && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Company</th>
                  <th className="text-left px-4 py-2">Dir</th>
                  <th className="text-left px-4 py-2">Fax Number</th>
                  <th className="text-left px-4 py-2">Pages</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Doc</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-steel-500">No fax activity yet.</td></tr>
                ) : logs.map((f: any) => (
                  <tr key={f.id} className="border-b border-steel-100 align-top hover:bg-steel-50">
                    <td className="px-4 py-3 text-xs text-steel-500 whitespace-nowrap">{format(f.createdAt, 'MMM d h:mm a')}</td>
                    <td className="px-4 py-3 text-xs font-medium">{f.company?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${f.direction === 'OUTBOUND' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {f.direction === 'OUTBOUND' ? 'OUT' : 'IN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{f.faxNumber}</td>
                    <td className="px-4 py-3 text-xs">{f.pages ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`font-medium ${f.status === 'DELIVERED' || f.status === 'RECEIVED' ? 'text-green-700' : f.status === 'FAILED' ? 'text-red-600' : 'text-amber-600'}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {f.mediaUrl ? <a href={f.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-steel-500">Page {page} of {totalPages}</div>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={`/sa/messaging?type=${type}&page=${page - 1}`} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/sa/messaging?type=${type}&page=${page + 1}`} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
