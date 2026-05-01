export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import JobDashboard from './JobDashboard';

export default async function JobsPage() {
  const session = await requireSession();
  const lang = getServerLang();
  const companyId = session.companyId;
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  const [allJobs, customersList, driversList, brokersList, invoicedJobGroups] = await Promise.all([
    prisma.job.findMany({
      where: { companyId },
      include: {
        customer: { select: { id: true, name: true } },
        broker: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        assignments: { select: { id: true } },
        _count: { select: { tickets: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    }),
    prisma.driver.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.broker.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    }),
    prisma.ticket.groupBy({
      by: ['jobId'],
      where: { companyId, jobId: { not: null }, invoiceId: { not: null } },
    }),
  ]);

  const invoicedJobIds = new Set(invoicedJobGroups.map(g => g.jobId).filter(Boolean));

  const serializedJobs = allJobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    name: j.name,
    status: j.status,
    dateRaw: j.date ? format(j.date, 'yyyy-MM-dd') : null,
    dateDisplay: j.date ? format(j.date, 'MMM d, yyyy') : null,
    customerName: j.customer?.name ?? null,
    brokerName: j.broker?.name ?? null,
    driverName: j.driver?.name ?? null,
    hauledFrom: j.hauledFrom,
    hauledTo: j.hauledTo,
    material: j.material ?? null,
    truckNumber: j.truckNumber ?? null,
    quantityType: j.quantityType,
    totalLoads: j.totalLoads,
    completedLoads: j.completedLoads,
    ticketCount: j._count.tickets,
    ratePerUnit: j.ratePerUnit ? Number(j.ratePerUnit) : null,
    openForDrivers: j.openForDrivers,
    requiredTruckCount: j.requiredTruckCount ?? 1,
    assignmentCount: j.assignments?.length ?? (j.driverId ? 1 : 0),
    invoiced: invoicedJobIds.has(j.id),
  }));

  // ── Compute job stats from already-fetched data ──
  const jobStats = {
    created: allJobs.filter(j => j.status === 'CREATED').length,
    assigned: allJobs.filter(j => j.status === 'ASSIGNED').length,
    inProgress: allJobs.filter(j => j.status === 'IN_PROGRESS').length,
    completed: allJobs.filter(j => j.status === 'COMPLETED').length,
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('jobs.operations', lang)}</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('jobs.title', lang)}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/jobs/new" className="btn-accent">{t('jobs.newJob', lang)}</Link>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4 ring-2 ring-safety">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Creados' : 'Created'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{jobStats.created}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Asignados' : 'Assigned'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{jobStats.assigned}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'En Progreso' : 'In Progress'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{jobStats.inProgress}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Completados' : 'Completed'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{jobStats.completed}</div>
        </div>
      </section>

      <JobDashboard
        jobs={serializedJobs}
        customers={customersList.map(c => ({ id: c.id, name: c.name }))}
        drivers={driversList.map(d => ({ id: d.id, name: d.name }))}
        brokers={brokersList.map(b => ({ id: b.id, name: b.name }))}
        defaultPeriodStart={format(lastWeekStart, 'yyyy-MM-dd')}
        defaultPeriodEnd={format(lastWeekEnd, 'yyyy-MM-dd')}
      />
    </div>
  );
}
