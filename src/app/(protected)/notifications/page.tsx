import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TYPE_STYLE: Record<string, { icon: string; color: string; label: string }> = {
  JOB_STARTED: { icon: '▶', color: 'text-green-600', label: 'Job Started' },
  JOB_PAUSED: { icon: '⏸', color: 'text-amber-600', label: 'Job Paused' },
  JOB_COMPLETED: { icon: '✓', color: 'text-green-700', label: 'Job Completed' },
  JOB_CANCELLED: { icon: '✕', color: 'text-red-600', label: 'Job Cancelled' },
  JOB_CLAIMED: { icon: '✋', color: 'text-blue-600', label: 'Job Claimed' },
  JOB_ISSUE: { icon: '⚠', color: 'text-red-600', label: 'Job Issue' },
  TICKET_STARTED: { icon: '▶', color: 'text-green-600', label: 'Ticket Started' },
  TICKET_COMPLETED: { icon: '✓', color: 'text-green-700', label: 'Ticket Completed' },
  TICKET_ISSUE: { icon: '⚠', color: 'text-red-600', label: 'Ticket Issue' },
  TICKET_UPDATED: { icon: '✎', color: 'text-blue-600', label: 'Ticket Updated' },
  TICKET_PHOTO_UPLOADED: { icon: '📷', color: 'text-purple-600', label: 'Photo Uploaded' },
  TICKET_PHOTOS_UPLOADED: { icon: '📷', color: 'text-purple-600', label: 'Photos Uploaded' },
  TIME_OFF_REQUEST: { icon: '🗓', color: 'text-amber-600', label: 'Time Off Request' },
  TIME_OFF_CANCELLED: { icon: '✕', color: 'text-red-500', label: 'Time Off Cancelled' },
  TIME_OFF_APPROVED: { icon: '✓', color: 'text-green-600', label: 'Time Off Approved' },
  TIME_OFF_DENIED: { icon: '✕', color: 'text-red-600', label: 'Time Off Denied' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { page?: string; type?: string };
}) {
  const session = await requireSession();
  const page = Math.max(1, parseInt(searchParams.page || '1', 10));
  const pageSize = 50;
  const typeFilter = searchParams.type || '';

  const where: any = { companyId: session.companyId };
  if (typeFilter) where.type = typeFilter;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  // Get unique types for the filter
  const allTypes = Object.keys(TYPE_STYLE);

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Audit</div>
        <h1 className="text-3xl font-bold tracking-tight">Notification History</h1>
        <p className="text-sm text-steel-500 mt-1">{total.toLocaleString()} total notifications</p>
      </header>

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Link
          href="/notifications"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !typeFilter ? 'bg-diesel text-white' : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
          }`}
        >
          All
        </Link>
        {allTypes.map((t) => {
          const s = TYPE_STYLE[t];
          return (
            <Link
              key={t}
              href={`/notifications?type=${t}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-diesel text-white' : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
              }`}
            >
              {s.icon} {s.label}
            </Link>
          );
        })}
      </div>

      {/* Notification list */}
      <div className="panel overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-steel-500">No notifications found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-5 py-2 w-8"></th>
                <th className="text-left px-5 py-2">Type</th>
                <th className="text-left px-5 py-2">Details</th>
                <th className="text-left px-5 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const s = TYPE_STYLE[n.type] || { icon: '●', color: 'text-steel-500', label: n.type };
                return (
                  <tr key={n.id} className="border-b border-steel-100 hover:bg-steel-50">
                    <td className={`px-5 py-3 text-base ${s.color}`}>{s.icon}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-steel-100 text-steel-700">
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {n.link ? (
                        <Link href={n.link} className="font-medium text-steel-900 hover:text-safety-dark">
                          {n.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-steel-900">{n.title}</span>
                      )}
                      {n.body && (
                        <div className="text-xs text-steel-500 mt-0.5">{n.body}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-steel-500 whitespace-nowrap">
                      {formatDate(n.createdAt.toISOString())}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-steel-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/notifications?page=${page - 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
                className="px-3 py-1.5 rounded-lg text-sm bg-steel-100 text-steel-700 hover:bg-steel-200"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/notifications?page=${page + 1}${typeFilter ? `&type=${typeFilter}` : ''}`}
                className="px-3 py-1.5 rounded-lg text-sm bg-steel-100 text-steel-700 hover:bg-steel-200"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
