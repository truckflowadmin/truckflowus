import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { requirePlan } from '@/lib/plan-gate';
import { fmtQty, qtyUnit } from '@/lib/format';
import InspectionAlerts from '../fleet/InspectionAlerts';
import { getServerLang, t, statusLabel } from '@/lib/i18n';
import { safePage } from '@/lib/server-error';
import DashboardStats from '@/components/DashboardStats';
import DriverTrackingMap from '@/components/DriverTrackingMap';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await requireSession();
  await requirePlan(session.companyId);
  const lang = getServerLang();

  const recent = await safePage(async () => {
    return prisma.ticket.findMany({
      where: { companyId: session.companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { driver: true, customer: true },
    });
  }, 'Unable to load the dashboard. Please try again.');

  const trackingLabels = {
    title: t('dashboard.liveTracking', lang),
    noDrivers: t('dashboard.noActiveDrivers', lang),
    speed: t('dashboard.trackingSpeed', lang),
    lastUpdate: t('dashboard.trackingLastUpdate', lang),
    destination: t('dashboard.trackingDestination', lang),
    job: t('dashboard.trackingJob', lang),
    truck: t('dashboard.trackingTruck', lang),
  };

  const statsLabels = {
    pending: t('dashboard.pending', lang),
    inProgress: t('dashboard.inProgress', lang),
    doneToday: t('dashboard.doneToday', lang),
    doneThisWeek: t('dashboard.doneThisWeek', lang),
    activeDrivers: t('dashboard.activeDrivers', lang),
    openAR: t('dashboard.openAR', lang),
    invoice: lang === 'es' ? t('dashboard.invoice', lang) : 'invoice',
    invoices: lang === 'es' ? t('dashboard.invoices', lang) : 'invoices',
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-6 md:mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('nav.dispatch', lang)}</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('dashboard.title', lang)}</h1>
        </div>
        <a href="/tickets/new" className="btn-accent self-start">{t('dashboard.newTicket', lang)}</a>
      </header>

      <InspectionAlerts />

      <DashboardStats labels={statsLabels} />

      <DriverTrackingMap labels={trackingLabels} />

      <section className="panel">
        <div className="flex items-center justify-between px-5 py-4 border-b border-steel-200">
          <h2 className="font-semibold">{t('dashboard.recentTickets', lang)}</h2>
          <a href="/tickets" className="text-sm text-steel-600 hover:text-steel-900">{t('common.viewAll', lang)} →</a>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center text-steel-500">
            {t('dashboard.noTickets', lang)} <a href="/tickets/new" className="text-safety-dark font-medium">{t('dashboard.createFirst', lang)}</a>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                <tr>
                  <th className="text-left px-3 md:px-5 py-2">#</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.customer', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.driver', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.material', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.quantity', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.status', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tk) => (
                  <tr key={tk.id} className="border-b border-steel-100 hover:bg-steel-50">
                    <td className="px-3 md:px-5 py-3 font-mono">
                      <a href={`/tickets/${tk.id}`} className="text-steel-900 hover:text-safety-dark">
                        #{String(tk.ticketNumber).padStart(4, '0')}
                      </a>
                    </td>
                    <td className="px-3 md:px-5 py-3">{tk.customer?.name ?? '—'}</td>
                    <td className="px-3 md:px-5 py-3">{tk.driver?.name ?? <span className="text-steel-400">{t('tickets.unassigned', lang)}</span>}</td>
                    <td className="px-3 md:px-5 py-3">{tk.material ?? '—'}</td>
                    <td className="px-3 md:px-5 py-3">{fmtQty(tk.quantity, tk.quantityType)} {qtyUnit(tk.quantityType)}</td>
                    <td className="px-3 md:px-5 py-3"><StatusBadge status={tk.status} lang={lang} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

function StatusBadge({ status, lang }: { status: string; lang: 'en' | 'es' }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? ''}`}>{statusLabel(status, lang)}</span>;
}
