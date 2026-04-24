import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { safePage } from '@/lib/server-error';
import { ReportsCharts } from './charts';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const session = await requireSession();
  const lang = getServerLang();
  const range = searchParams.range || '30'; // days
  const days = Math.min(Math.max(parseInt(range, 10) || 30, 7), 365);
  const now = new Date();
  const rangeStart = startOfDay(subDays(now, days));
  const rangeEnd = endOfDay(now);

  // All report queries wrapped for user-friendly error handling
  const reportData = await safePage(async () => {

  // 1) Tickets by status (pie)
  const statusCounts = await prisma.ticket.groupBy({
    by: ['status'],
    where: { companyId: session.companyId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    _count: true,
  });

  // 2) Completed tickets per day (bar chart)
  const completedTickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      completedAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: { completedAt: true, quantity: true, ratePerUnit: true },
  });

  // Bucket by day
  const dayLabels = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const dailyMap = new Map<string, { tickets: number; loads: number; revenue: number }>();
  for (const d of dayLabels) {
    dailyMap.set(format(d, 'yyyy-MM-dd'), { tickets: 0, loads: 0, revenue: 0 });
  }
  for (const t of completedTickets) {
    if (!t.completedAt) continue;
    const key = format(t.completedAt, 'yyyy-MM-dd');
    const entry = dailyMap.get(key);
    if (entry) {
      entry.tickets++;
      entry.loads += Number(t.quantity);
      const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
      entry.revenue += rate * Number(t.quantity);
    }
  }
  const dailyData = dayLabels.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    const entry = dailyMap.get(key) ?? { tickets: 0, loads: 0, revenue: 0 };
    return { date: format(d, days <= 14 ? 'EEE MMM d' : 'MMM d'), ...entry };
  });

  // 3) Revenue by customer (top 10)
  const customerTickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      completedAt: { gte: rangeStart, lte: rangeEnd },
      customerId: { not: null },
    },
    select: { customerId: true, quantity: true, ratePerUnit: true },
  });

  const custRevMap = new Map<string, number>();
  for (const t of customerTickets) {
    if (!t.customerId) continue;
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    custRevMap.set(t.customerId, (custRevMap.get(t.customerId) ?? 0) + rate * Number(t.quantity));
  }

  const customerIds = Array.from(custRevMap.keys());
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const custNameMap = new Map(customers.map((c) => [c.id, c.name]));

  const customerData = Array.from(custRevMap.entries())
    .map(([id, revenue]) => ({ name: custNameMap.get(id) ?? 'Unknown', revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // 4) Driver leaderboard
  const driverTickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      completedAt: { gte: rangeStart, lte: rangeEnd },
      driverId: { not: null },
    },
    select: { driverId: true },
  });

  const driverLoadsMap = new Map<string, { loads: number }>();
  for (const t of driverTickets) {
    if (!t.driverId) continue;
    const entry = driverLoadsMap.get(t.driverId) ?? { loads: 0 };
    entry.loads++;
    driverLoadsMap.set(t.driverId, entry);
  }

  const driverIds = Array.from(driverLoadsMap.keys());
  const driversDb = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, name: true, assignedTruck: { select: { truckNumber: true } } },
  });
  const driverNameMap = new Map(driversDb.map((d) => [d.id, d]));

  const driverData = Array.from(driverLoadsMap.entries())
    .map(([id, stats]) => {
      const d = driverNameMap.get(id);
      return { name: d?.name ?? 'Unknown', truck: d?.assignedTruck?.truckNumber ?? '', ...stats };
    })
    .sort((a, b) => b.loads - a.loads);

  // 5) Summary stats
  const totalTickets = statusCounts.reduce((sum, s) => sum + s._count, 0);
  const totalCompleted = completedTickets.length;
  const totalLoads = completedTickets.length;
  const totalRevenue = completedTickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  // 6) Invoice stats
  const [invoiceStats, paidInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        companyId: session.companyId,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: {
        companyId: session.companyId,
        status: 'PAID',
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  // 7) Job stats
  const [totalJobs, completedJobsCount, activeJobsCount, cancelledJobsCount] = await Promise.all([
    prisma.job.count({
      where: { companyId: session.companyId, createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.job.count({
      where: { companyId: session.companyId, status: 'COMPLETED', completedAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.job.count({
      where: { companyId: session.companyId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    }),
    prisma.job.count({
      where: { companyId: session.companyId, status: 'CANCELLED', createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);

  // 8) Driver time tracking — total hours worked
  const driverTimeJobs = await prisma.job.findMany({
    where: {
      companyId: session.companyId,
      completedAt: { gte: rangeStart, lte: rangeEnd },
      driverId: { not: null },
      driverTimeSeconds: { gt: 0 },
    },
    select: { driverId: true, driverTimeSeconds: true },
  });

  const driverTimeMap = new Map<string, number>();
  for (const j of driverTimeJobs) {
    if (!j.driverId) continue;
    driverTimeMap.set(j.driverId, (driverTimeMap.get(j.driverId) ?? 0) + (j.driverTimeSeconds || 0));
  }
  const driverTimeData = Array.from(driverTimeMap.entries())
    .map(([id, seconds]) => {
      const d = driverNameMap.get(id);
      return { name: d?.name ?? 'Unknown', truck: d?.assignedTruck?.truckNumber ?? '', hours: Math.round((seconds / 3600) * 10) / 10 };
    })
    .sort((a, b) => b.hours - a.hours);

  const totalDriverHours = driverTimeData.reduce((sum, d) => sum + d.hours, 0);

  // 9) Payroll overview
  const driverPayroll = await prisma.driver.findMany({
    where: { companyId: session.companyId, active: true },
    select: { id: true, name: true, workerType: true, payType: true, payRate: true },
  });
  const employeeCount = driverPayroll.filter((d) => d.workerType === 'EMPLOYEE').length;
  const contractorCount = driverPayroll.filter((d) => d.workerType === 'CONTRACTOR').length;

  // 10) Issues reported in period
  const issueCount = await prisma.notification.count({
    where: {
      companyId: session.companyId,
      type: { in: ['TICKET_ISSUE', 'JOB_ISSUE'] },
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
  });

  // 11) Document compliance
  const allDrivers = await prisma.driver.count({ where: { companyId: session.companyId, active: true } });
  const driversWithAllDocs = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(DISTINCT d."id") as cnt
    FROM "Driver" d
    WHERE d."companyId" = ${session.companyId} AND d."active" = true
      AND (SELECT COUNT(DISTINCT dd."docType") FROM "DriverDocument" dd WHERE dd."driverId" = d."id" AND dd."docType" IN ('LICENSE_FRONT','LICENSE_BACK','MEDICAL_CERT','VOID_CHECK')) = 4
  `;
  const compliantDrivers = Number(driversWithAllDocs[0]?.cnt ?? 0);

  return {
    statusCounts, dailyData, customerData, driverData, totalTickets, totalCompleted,
    totalLoads, totalRevenue, invoiceStats, paidInvoices, totalJobs, completedJobsCount,
    activeJobsCount, cancelledJobsCount, driverTimeData, totalDriverHours,
    employeeCount, contractorCount, issueCount, allDrivers, compliantDrivers,
  };
  }, 'Unable to load reports. Please try again.');

  const {
    statusCounts, dailyData, customerData, driverData, totalTickets, totalCompleted,
    totalLoads, totalRevenue, invoiceStats, paidInvoices, totalJobs, completedJobsCount,
    activeJobsCount, cancelledJobsCount, driverTimeData, totalDriverHours,
    employeeCount, contractorCount, issueCount, allDrivers, compliantDrivers,
  } = reportData;

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('reports.analytics', lang)}</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('reports.title', lang)}</h1>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <a
              key={d}
              href={`/reports?range=${d}`}
              className={`px-3 py-1.5 rounded border text-sm ${
                days === d ? 'bg-diesel text-white border-diesel' : 'border-steel-300 bg-white hover:bg-steel-50'
              }`}
            >
              {d}d
            </a>
          ))}
        </div>
      </header>

      {/* Summary cards — Row 1: Tickets & Revenue */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        <SummaryCard label={t('reports.ticketsCreated', lang)} value={totalTickets} />
        <SummaryCard label={t('reports.completed', lang)} value={totalCompleted} />
        <SummaryCard label="Total Qty" value={totalLoads} />
        <SummaryCard label="Revenue" value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} accent />
        <SummaryCard label="Invoices" value={invoiceStats._count} subtle={`$${Number(invoiceStats._sum.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <SummaryCard label="Paid" value={paidInvoices._count} subtle={`$${Number(paidInvoices._sum.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
      </div>

      {/* Summary cards — Row 2: Jobs, Drivers, Compliance */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <SummaryCard label="Jobs Created" value={totalJobs} />
        <SummaryCard label="Jobs Completed" value={completedJobsCount} />
        <SummaryCard label="Active Jobs" value={activeJobsCount} subtle={`${cancelledJobsCount} cancelled`} />
        <SummaryCard label="Driver Hours" value={`${totalDriverHours.toFixed(1)}h`} />
        <SummaryCard label="Issues Reported" value={issueCount} />
        <SummaryCard label="Doc Compliance" value={`${compliantDrivers}/${allDrivers}`} subtle={allDrivers > 0 ? `${Math.round((compliantDrivers / allDrivers) * 100)}%` : '—'} />
      </div>

      {/* Charts — client component */}
      <ReportsCharts
        dailyData={dailyData}
        statusCounts={statusCounts.map((s) => ({ status: s.status, count: s._count }))}
        customerData={customerData}
        driverData={driverData}
        driverTimeData={driverTimeData}
        payrollBreakdown={{ employees: employeeCount, contractors: contractorCount }}
      />
    </div>
  );
}

function SummaryCard({ label, value, subtle, accent }: { label: string; value: string | number; subtle?: string; accent?: boolean }) {
  return (
    <div className={`panel p-4 ${accent ? 'ring-2 ring-safety' : ''}`}>
      <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {subtle && <div className="text-xs text-steel-500 mt-0.5">{subtle}</div>}
    </div>
  );
}
