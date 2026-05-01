import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { requirePlan } from '@/lib/plan-gate';
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

  // Current work week: Monday–Sunday
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun,1=Mon,...
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekJobs = await safePage(async () => {
    return prisma.job.findMany({
      where: {
        companyId: session.companyId,
        deletedAt: null,
        OR: [
          { date: { gte: weekStart, lte: weekEnd } },
          { date: null, createdAt: { gte: weekStart, lte: weekEnd } },
        ],
      },
      orderBy: [{ status: 'asc' }, { date: 'asc' }],
      take: 15,
      include: { customer: true, broker: true, assignments: { include: { driver: true } } },
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
          <div>
            <h2 className="font-semibold">{t('dashboard.thisWeeksJobs', lang)}</h2>
            <p className="text-xs text-steel-400 mt-0.5">
              {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <a href="/jobs" className="text-sm text-steel-600 hover:text-steel-900">{t('common.viewAll', lang)} →</a>
        </div>
        {weekJobs.length === 0 ? (
          <div className="p-10 text-center text-steel-500">
            {lang === 'es' ? 'No hay trabajos esta semana.' : 'No jobs this week.'}{' '}
            <a href="/jobs/new" className="text-safety-dark font-medium">{lang === 'es' ? 'Crear uno' : 'Create one'}</a>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                <tr>
                  <th className="text-left px-3 md:px-5 py-2">#</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.name', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.customer', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.driver', lang)}</th>
                  <th className="text-left px-3 md:px-5 py-2 hidden md:table-cell">{lang === 'es' ? 'Ruta' : 'Route'}</th>
                  <th className="text-left px-3 md:px-5 py-2">{lang === 'es' ? 'Fecha' : 'Date'}</th>
                  <th className="text-left px-3 md:px-5 py-2">{t('common.status', lang)}</th>
                </tr>
              </thead>
              <tbody>
                {weekJobs.map((job) => {
                  const drivers = job.assignments?.map((a: any) => a.driver?.name).filter(Boolean);
                  const driverLabel = drivers?.length ? drivers.join(', ') : null;
                  return (
                    <tr key={job.id} className="border-b border-steel-100 hover:bg-steel-50">
                      <td className="px-3 md:px-5 py-3 font-mono">
                        <a href={`/jobs/${job.id}`} className="text-steel-900 hover:text-safety-dark">
                          #{String(job.jobNumber).padStart(4, '0')}
                        </a>
                      </td>
                      <td className="px-3 md:px-5 py-3 font-medium max-w-[180px] truncate">{job.name}</td>
                      <td className="px-3 md:px-5 py-3">{job.customer?.name ?? job.broker?.name ?? '—'}</td>
                      <td className="px-3 md:px-5 py-3">
                        {driverLabel ?? <span className="text-steel-400">{t('tickets.unassigned', lang)}</span>}
                      </td>
                      <td className="px-3 md:px-5 py-3 hidden md:table-cell text-steel-500 text-xs max-w-[200px] truncate">
                        {job.hauledFrom} → {job.hauledTo}
                      </td>
                      <td className="px-3 md:px-5 py-3 whitespace-nowrap text-xs">
                        {job.date ? new Date(job.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-3 md:px-5 py-3"><JobStatusBadge status={job.status} lang={lang} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const JOB_STATUS_STYLES: Record<string, string> = {
  CREATED: 'bg-steel-200 text-steel-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-safety text-diesel',
  PARTIALLY_COMPLETED: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-steel-100 text-steel-500',
};

function JobStatusBadge({ status, lang }: { status: string; lang: 'en' | 'es' }) {
  return <span className={`badge ${JOB_STATUS_STYLES[status] ?? ''}`}>{statusLabel(status, lang)}</span>;
}
