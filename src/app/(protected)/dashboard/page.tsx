import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { requirePlan } from '@/lib/plan-gate';
import { fmtQty, qtyUnit } from '@/lib/format';
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import InspectionAlerts from '../fleet/InspectionAlerts';

export default async function DashboardPage() {
  const session = await requireSession();
  await requirePlan(session.companyId);
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [pending, inProgress, completedToday, completedWeek, driversActive, openInvoiceAgg] =
    await Promise.all([
      prisma.ticket.count({ where: { companyId: session.companyId, status: 'PENDING' } }),
      prisma.ticket.count({ where: { companyId: session.companyId, status: { in: ['DISPATCHED', 'IN_PROGRESS'] } } }),
      prisma.ticket.count({
        where: { companyId: session.companyId, status: 'COMPLETED', completedAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.ticket.count({
        where: { companyId: session.companyId, status: 'COMPLETED', completedAt: { gte: weekStart, lte: weekEnd } },
      }),
      prisma.driver.count({ where: { companyId: session.companyId, active: true } }),
      prisma.invoice.aggregate({
        where: { companyId: session.companyId, status: { in: ['SENT', 'OVERDUE'] } },
        _sum: { total: true },
        _count: true,
      }),
    ]);

  const recent = await prisma.ticket.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { driver: true, customer: true },
  });

  return (
    <div className="p-8 max-w-7xl">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Dispatch</div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <a href="/tickets/new" className="btn-accent">+ New Ticket</a>
      </header>

      <InspectionAlerts />

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Pending" value={pending} accent />
        <StatCard label="In Progress" value={inProgress} />
        <StatCard label="Done Today" value={completedToday} />
        <StatCard label="Done This Week" value={completedWeek} />
        <StatCard label="Active Drivers" value={driversActive} />
        <StatCard
          label="Open A/R"
          value={`$${Number(openInvoiceAgg._sum.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtle={`${openInvoiceAgg._count} invoice${openInvoiceAgg._count === 1 ? '' : 's'}`}
        />
      </section>

      <section className="panel">
        <div className="flex items-center justify-between px-5 py-4 border-b border-steel-200">
          <h2 className="font-semibold">Recent Tickets</h2>
          <a href="/tickets" className="text-sm text-steel-600 hover:text-steel-900">View all →</a>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center text-steel-500">
            No tickets yet. <a href="/tickets/new" className="text-safety-dark font-medium">Create your first</a>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
              <tr>
                <th className="text-left px-5 py-2">#</th>
                <th className="text-left px-5 py-2">Customer</th>
                <th className="text-left px-5 py-2">Driver</th>
                <th className="text-left px-5 py-2">Material</th>
                <th className="text-left px-5 py-2">Qty</th>
                <th className="text-left px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-5 py-3 font-mono">
                    <a href={`/tickets/${t.id}`} className="text-steel-900 hover:text-safety-dark">
                      #{String(t.ticketNumber).padStart(4, '0')}
                    </a>
                  </td>
                  <td className="px-5 py-3">{t.customer?.name ?? '—'}</td>
                  <td className="px-5 py-3">{t.driver?.name ?? <span className="text-steel-400">unassigned</span>}</td>
                  <td className="px-5 py-3">{t.material ?? '—'}</td>
                  <td className="px-5 py-3">{fmtQty(t.quantity, t.quantityType)} {qtyUnit(t.quantityType)}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, subtle, accent }: { label: string; value: string | number; subtle?: string; accent?: boolean }) {
  return (
    <div className={`panel p-4 ${accent ? 'ring-2 ring-safety' : ''}`}>
      <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {subtle && <div className="text-xs text-steel-500 mt-0.5">{subtle}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-steel-200 text-steel-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-safety text-diesel',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-steel-100 text-steel-500',
  ISSUE: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? ''}`}>{status.replace('_', ' ')}</span>;
}
