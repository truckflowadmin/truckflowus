import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { formatPrice } from '@/lib/features';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

async function approveRequest(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const requestId = String(formData.get('requestId') || '');
  const reviewNote = String(formData.get('reviewNote') || '').trim() || null;

  const req = await prisma.subscriptionRequest.findUnique({
    where: { id: requestId },
    include: { plan: true, company: true },
  });
  if (!req || req.status !== 'PENDING') return;

  // Prevent duplicate subscription — if company already has this plan, reject it automatically
  if (req.company.planId === req.planId) {
    await prisma.subscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewNote: reviewNote || 'Already subscribed to this plan',
        reviewedAt: new Date(),
        reviewedBy: 'Platform Admin',
      },
    });
    revalidatePath('/sa/requests');
    return;
  }

  // Approve the request and assign the plan to the company
  await prisma.$transaction([
    prisma.subscriptionRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewNote,
        reviewedAt: new Date(),
        reviewedBy: 'Platform Admin',
      },
    }),
    prisma.company.update({
      where: { id: req.companyId },
      data: { planId: req.planId },
    }),
  ]);

  await audit({
    companyId: req.companyId,
    entityType: 'company',
    entityId: req.companyId,
    action: 'plan_change',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Approved subscription request — assigned "${req.plan.name}" plan`,
    details: { requestId, planId: req.planId, reviewNote },
  });

  revalidatePath('/sa/requests');
  revalidatePath(`/sa/tenants/${req.companyId}`);
  revalidatePath('/', 'layout');
}

async function rejectRequest(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const requestId = String(formData.get('requestId') || '');
  const reviewNote = String(formData.get('reviewNote') || '').trim() || null;

  const req = await prisma.subscriptionRequest.findUnique({
    where: { id: requestId },
    include: { plan: true, company: true },
  });
  if (!req || req.status !== 'PENDING') return;

  await prisma.subscriptionRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      reviewNote,
      reviewedAt: new Date(),
      reviewedBy: 'Platform Admin',
    },
  });

  await audit({
    companyId: req.companyId,
    entityType: 'company',
    entityId: req.companyId,
    action: 'update',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Rejected subscription request for "${req.plan.name}" plan`,
    details: { requestId, planId: req.planId, reviewNote },
  });

  revalidatePath('/sa/requests');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RequestsPage() {
  await requireSuperadmin();

  const [pendingRequests, recentRequests] = await Promise.all([
    prisma.subscriptionRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        company: { select: { id: true, name: true, city: true, state: true, planId: true, plan: true } },
        plan: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.subscriptionRequest.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      include: {
        company: { select: { id: true, name: true } },
        plan: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Subscription Requests</h1>
        <p className="text-purple-300 text-sm mt-1">
          Review and approve plan subscription requests from dispatchers.
        </p>
      </header>

      {/* Pending requests */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-purple-400 font-semibold mb-3">
          Pending ({pendingRequests.length})
        </h2>

        {pendingRequests.length === 0 ? (
          <div className="panel-sa text-center py-8">
            <p className="text-purple-300">No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div key={req.id} className="panel-sa">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <Link
                      href={`/sa/tenants/${req.company.id}`}
                      className="text-white font-semibold hover:text-purple-200"
                    >
                      {req.company.name}
                    </Link>
                    <div className="text-xs text-purple-300 mt-0.5">
                      {[req.company.city, req.company.state].filter(Boolean).join(', ') || 'No location'}
                      {req.company.plan && (
                        <> · Currently on <span className="text-purple-200">{req.company.plan.name}</span></>
                      )}
                      {!req.company.planId && (
                        <> · <span className="text-amber-400">No plan assigned</span></>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-purple-400">Requested</div>
                    <div className="text-xs text-purple-200">{req.createdAt.toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Requested plan */}
                <div className="bg-purple-950/50 rounded-lg p-3 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-purple-400 uppercase tracking-wider">Requesting</div>
                    <div className="text-white font-semibold">{req.plan.name}</div>
                    <div className="text-xs text-purple-300">{req.plan.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      {formatPrice(req.plan.priceMonthlyCents)}
                    </div>
                    <div className="text-[10px] text-purple-400">
                      {req.plan.maxDrivers ?? '∞'} drivers · {req.plan.maxTicketsPerMonth ?? '∞'} tickets/mo
                    </div>
                  </div>
                </div>

                {/* Dispatcher's message */}
                {req.message && (
                  <div className="bg-purple-950/30 rounded p-2 mb-3 text-sm text-purple-200 italic">
                    "{req.message}"
                  </div>
                )}

                {/* Duplicate warning */}
                {req.company.planId === req.planId && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-3 text-sm text-amber-300">
                    ⚠️ This company is already on the <span className="font-semibold">{req.plan.name}</span> plan. Approving will have no effect.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 flex-wrap">
                  <form action={approveRequest} className="flex-1 min-w-[200px]">
                    <input type="hidden" name="requestId" value={req.id} />
                    <div className="flex gap-2">
                      <input
                        name="reviewNote"
                        placeholder="Note (optional)"
                        className="input-sa text-xs flex-1"
                      />
                      <button type="submit" className="btn-purple text-xs whitespace-nowrap">
                        Approve
                      </button>
                    </div>
                  </form>
                  <form action={rejectRequest}>
                    <input type="hidden" name="requestId" value={req.id} />
                    <details>
                      <summary className="btn-ghost text-xs cursor-pointer text-red-300 hover:text-red-200">
                        Reject
                      </summary>
                      <div className="mt-2 flex gap-2">
                        <input
                          name="reviewNote"
                          placeholder="Reason..."
                          className="input-sa text-xs flex-1"
                        />
                        <button type="submit" className="btn-danger text-xs whitespace-nowrap">
                          Confirm Reject
                        </button>
                      </div>
                    </details>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity */}
      {recentRequests.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-purple-400 font-semibold mb-3">
            Recent Activity
          </h2>
          <div className="panel-sa overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
                <tr>
                  <th className="text-left py-2 pr-4">Company</th>
                  <th className="text-left py-2 pr-4">Plan</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Note</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/40">
                {recentRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/sa/tenants/${req.company.id}`}
                        className="text-white hover:text-purple-200"
                      >
                        {req.company.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-purple-200">{req.plan.name}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          req.status === 'APPROVED'
                            ? 'bg-green-900 text-green-200'
                            : 'bg-red-900 text-red-200'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-purple-300 max-w-[200px] truncate">
                      {req.reviewNote || '—'}
                    </td>
                    <td className="py-2 text-xs text-purple-300">
                      {req.reviewedAt?.toLocaleDateString() ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
