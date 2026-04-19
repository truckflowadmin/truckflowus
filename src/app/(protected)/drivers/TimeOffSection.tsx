import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createNotification } from '@/lib/notifications';
import TimeOffActions from '../time-off/TimeOffActions';

// ---------------------------------------------------------------------------
// Server action (must be at module level for 'use server')
// ---------------------------------------------------------------------------
async function reviewAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const requestId = String(formData.get('requestId') || '');
  const action = String(formData.get('action') || ''); // 'approve' | 'deny'
  const reviewNote = String(formData.get('reviewNote') || '').trim();
  if (!requestId || !['approve', 'deny'].includes(action)) throw new Error('Invalid');

  const req = await prisma.timeOffRequest.findFirst({
    where: { id: requestId, companyId: session.companyId, status: 'PENDING' },
    include: { driver: { select: { name: true, accessToken: true } } },
  });
  if (!req) throw new Error('Request not found');

  const status = action === 'approve' ? 'APPROVED' : 'DENIED';

  await prisma.timeOffRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
      reviewedBy: session.userId,
    },
  });

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const range = req.startDate.getTime() === req.endDate.getTime()
    ? fmtDate(req.startDate)
    : `${fmtDate(req.startDate)} – ${fmtDate(req.endDate)}`;

  createNotification({
    companyId: session.companyId,
    type: action === 'approve' ? 'TIME_OFF_APPROVED' as any : 'TIME_OFF_DENIED' as any,
    title: `${req.driver.name}'s time off (${range}) was ${status.toLowerCase()}`,
    body: reviewNote || undefined,
    link: '/drivers?tab=timeoff',
  });

  revalidatePath('/drivers');
  revalidatePath(`/d/${req.driver.accessToken}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default async function TimeOffSection() {
  const session = await requireSession();

  const requests = await prisma.timeOffRequest.findMany({
    where: { companyId: session.companyId },
    include: { driver: { select: { name: true, assignedTruck: { select: { truckNumber: true } } } } },
    orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
    take: 200,
  });

  const pending = requests.filter((r) => r.status === 'PENDING');
  const history = requests.filter((r) => r.status !== 'PENDING');

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const statusBadge: Record<string, string> = {
    APPROVED: 'bg-green-100 text-green-800',
    DENIED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-steel-200 text-steel-600',
    PENDING: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="max-w-4xl">
      {/* Pending section */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm uppercase tracking-widest text-steel-500 font-semibold mb-3">
            Pending Approval ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((r) => {
              const range = r.startDate.getTime() === r.endDate.getTime()
                ? fmtDate(r.startDate)
                : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
              const days = Math.round(
                (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)
              ) + 1;

              return (
                <div key={r.id} className="panel p-4 border-l-4 border-amber-400">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-steel-900">
                        {r.driver.name}
                        {(r.driver as any).assignedTruck?.truckNumber && (
                          <span className="text-sm text-steel-500 font-normal ml-2">
                            Truck {(r.driver as any).assignedTruck.truckNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-steel-700 mt-1">
                        {range} · {days} day{days === 1 ? '' : 's'}
                      </div>
                      {r.reason && (
                        <div className="text-sm text-steel-500 mt-1">Reason: {r.reason}</div>
                      )}
                    </div>
                    <span className={`badge ${statusBadge.PENDING}`}>Pending</span>
                  </div>
                  <TimeOffActions requestId={r.id} reviewAction={reviewAction} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="panel p-8 text-center mb-8">
          <div className="text-4xl mb-2">✓</div>
          <h2 className="font-bold text-lg mb-1">All caught up</h2>
          <p className="text-sm text-steel-500">No pending time-off requests.</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-widest text-steel-500 font-semibold mb-3">
            History
          </h2>
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-steel-50 text-left text-xs uppercase tracking-wider text-steel-500">
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => {
                  const range = r.startDate.getTime() === r.endDate.getTime()
                    ? fmtDate(r.startDate)
                    : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
                  return (
                    <tr key={r.id} className="border-t border-steel-100">
                      <td className="px-4 py-3 font-medium">{r.driver.name}</td>
                      <td className="px-4 py-3">{range}</td>
                      <td className="px-4 py-3 text-steel-500">{r.reason || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[10px] ${statusBadge[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-steel-500">{r.reviewNote || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
