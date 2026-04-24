import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { format, subDays, subMonths, subQuarters, subYears, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { safePage } from '@/lib/server-error';
import { FinancialReports } from './FinancialReports';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string; tab?: string };
}) {
  const session = await requireSession();
  const lang = getServerLang();

  // Flexible period: preset or custom
  const range = searchParams.range || '30';
  const now = new Date();
  let rangeStart: Date;
  let rangeEnd = endOfDay(now);
  let periodLabel = '';

  if (searchParams.from && searchParams.to) {
    rangeStart = startOfDay(new Date(searchParams.from));
    rangeEnd = endOfDay(new Date(searchParams.to));
    periodLabel = `${format(rangeStart, 'MMM d, yyyy')} – ${format(rangeEnd, 'MMM d, yyyy')}`;
  } else {
    switch (range) {
      case '7':
        rangeStart = startOfDay(subDays(now, 7));
        periodLabel = 'Last 7 Days';
        break;
      case '14':
        rangeStart = startOfDay(subDays(now, 14));
        periodLabel = 'Last 14 Days';
        break;
      case '30':
        rangeStart = startOfDay(subDays(now, 30));
        periodLabel = 'Last 30 Days';
        break;
      case '90':
        rangeStart = startOfDay(subDays(now, 90));
        periodLabel = 'Last 90 Days';
        break;
      case 'week':
        rangeStart = startOfWeek(now, { weekStartsOn: 1 });
        periodLabel = 'This Week';
        break;
      case 'month':
        rangeStart = startOfMonth(now);
        periodLabel = 'This Month';
        break;
      case 'quarter':
        rangeStart = startOfQuarter(now);
        periodLabel = 'This Quarter';
        break;
      case 'year':
        rangeStart = startOfYear(now);
        periodLabel = 'This Year';
        break;
      default:
        const days = Math.min(Math.max(parseInt(range, 10) || 30, 7), 365);
        rangeStart = startOfDay(subDays(now, days));
        periodLabel = `Last ${days} Days`;
    }
  }

  const reportData = await safePage(async () => {

  // ═══════════════════════════════════════════════════════════════════
  // REVENUE QUERIES
  // ═══════════════════════════════════════════════════════════════════

  // All completed tickets in range with full details
  const completedTickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      completedAt: { gte: rangeStart, lte: rangeEnd },
      deletedAt: null,
    },
    select: {
      id: true,
      completedAt: true,
      quantity: true,
      ratePerUnit: true,
      customerId: true,
      brokerId: true,
      driverId: true,
      jobId: true,
      quantityType: true,
      material: true,
    },
  });

  // Revenue by customer
  const custRevMap = new Map<string, { revenue: number; loads: number; tons: number; yards: number }>();
  for (const tk of completedTickets) {
    if (!tk.customerId) continue;
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    const qty = Number(tk.quantity);
    const rev = rate * qty;
    const entry = custRevMap.get(tk.customerId) ?? { revenue: 0, loads: 0, tons: 0, yards: 0 };
    entry.revenue += rev;
    if (tk.quantityType === 'LOADS') entry.loads += qty;
    else if (tk.quantityType === 'TONS') entry.tons += qty;
    else if (tk.quantityType === 'YARDS') entry.yards += qty;
    custRevMap.set(tk.customerId, entry);
  }

  // Revenue by broker
  const brokerRevMap = new Map<string, { revenue: number; loads: number; tons: number; yards: number }>();
  for (const tk of completedTickets) {
    if (!tk.brokerId) continue;
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    const qty = Number(tk.quantity);
    const rev = rate * qty;
    const entry = brokerRevMap.get(tk.brokerId) ?? { revenue: 0, loads: 0, tons: 0, yards: 0 };
    entry.revenue += rev;
    if (tk.quantityType === 'LOADS') entry.loads += qty;
    else if (tk.quantityType === 'TONS') entry.tons += qty;
    else if (tk.quantityType === 'YARDS') entry.yards += qty;
    brokerRevMap.set(tk.brokerId, entry);
  }

  // Revenue by driver
  const driverRevMap = new Map<string, { revenue: number; tickets: number; loads: number }>();
  for (const tk of completedTickets) {
    if (!tk.driverId) continue;
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    const qty = Number(tk.quantity);
    const entry = driverRevMap.get(tk.driverId) ?? { revenue: 0, tickets: 0, loads: 0 };
    entry.revenue += rate * qty;
    entry.tickets++;
    entry.loads += qty;
    driverRevMap.set(tk.driverId, entry);
  }

  // Revenue by job
  const jobRevMap = new Map<string, { revenue: number; tickets: number }>();
  for (const tk of completedTickets) {
    if (!tk.jobId) continue;
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    const qty = Number(tk.quantity);
    const entry = jobRevMap.get(tk.jobId) ?? { revenue: 0, tickets: 0 };
    entry.revenue += rate * qty;
    entry.tickets++;
    jobRevMap.set(tk.jobId, entry);
  }

  // Revenue over time (daily/weekly/monthly buckets)
  const dayLabels = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const dailyRevenueMap = new Map<string, number>();
  for (const d of dayLabels) dailyRevenueMap.set(format(d, 'yyyy-MM-dd'), 0);
  for (const tk of completedTickets) {
    if (!tk.completedAt) continue;
    const key = format(tk.completedAt, 'yyyy-MM-dd');
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    dailyRevenueMap.set(key, (dailyRevenueMap.get(key) ?? 0) + rate * Number(tk.quantity));
  }
  const revenueOverTime = dayLabels.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { date: format(d, dayLabels.length <= 14 ? 'EEE MMM d' : dayLabels.length <= 45 ? 'MMM d' : 'M/d'), revenue: Math.round((dailyRevenueMap.get(key) ?? 0) * 100) / 100 };
  });

  // Fetch names
  const allCustomerIds = Array.from(new Set([...custRevMap.keys()]));
  const allBrokerIds = Array.from(new Set([...brokerRevMap.keys()]));
  const allDriverIds = Array.from(new Set([...driverRevMap.keys()]));
  const allJobIds = Array.from(new Set([...jobRevMap.keys()]));

  const [customers, brokers, drivers, jobs] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: allCustomerIds } }, select: { id: true, name: true } }),
    prisma.broker.findMany({ where: { id: { in: allBrokerIds } }, select: { id: true, name: true } }),
    prisma.driver.findMany({
      where: { id: { in: allDriverIds } },
      select: { id: true, name: true, workerType: true, payType: true, payRate: true, assignedTruck: { select: { truckNumber: true } } },
    }),
    prisma.job.findMany({ where: { id: { in: allJobIds } }, select: { id: true, jobNumber: true, name: true } }),
  ]);

  const custNameMap = new Map(customers.map(c => [c.id, c.name]));
  const brokerNameMap = new Map(brokers.map(b => [b.id, b.name]));
  const driverInfoMap = new Map(drivers.map(d => [d.id, d]));
  const jobInfoMap = new Map(jobs.map(j => [j.id, j]));

  const customerRevenue = Array.from(custRevMap.entries())
    .map(([id, stats]) => ({ name: custNameMap.get(id) ?? 'Unknown', ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  const brokerRevenue = Array.from(brokerRevMap.entries())
    .map(([id, stats]) => ({ name: brokerNameMap.get(id) ?? 'Unknown', ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  const driverRevenue = Array.from(driverRevMap.entries())
    .map(([id, stats]) => {
      const d = driverInfoMap.get(id);
      return { name: d?.name ?? 'Unknown', truck: d?.assignedTruck?.truckNumber ?? '', ...stats };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const jobRevenue = Array.from(jobRevMap.entries())
    .map(([id, stats]) => {
      const j = jobInfoMap.get(id);
      return { jobNumber: j?.jobNumber ?? 0, name: j?.name ?? 'Unknown', ...stats };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const totalRevenue = completedTickets.reduce((sum, tk) => {
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    return sum + rate * Number(tk.quantity);
  }, 0);

  // ═══════════════════════════════════════════════════════════════════
  // EXPENSE QUERIES
  // ═══════════════════════════════════════════════════════════════════

  const expenses = await prisma.expense.findMany({
    where: {
      companyId: session.companyId,
      date: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      id: true,
      amount: true,
      category: true,
      description: true,
      vendor: true,
      date: true,
      truckId: true,
      driverId: true,
    },
  });

  // Expenses by category
  const catExpMap = new Map<string, number>();
  for (const e of expenses) {
    catExpMap.set(e.category, (catExpMap.get(e.category) ?? 0) + Number(e.amount));
  }
  const expensesByCategory = Array.from(catExpMap.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // Expenses by truck
  const truckExpMap = new Map<string, { amount: number; count: number }>();
  for (const e of expenses) {
    if (!e.truckId) continue;
    const entry = truckExpMap.get(e.truckId) ?? { amount: 0, count: 0 };
    entry.amount += Number(e.amount);
    entry.count++;
    truckExpMap.set(e.truckId, entry);
  }
  const truckIds = Array.from(truckExpMap.keys());
  const trucksDb = truckIds.length > 0
    ? await prisma.truck.findMany({ where: { id: { in: truckIds } }, select: { id: true, truckNumber: true } })
    : [];
  const truckNameMap = new Map(trucksDb.map(t => [t.id, t.truckNumber]));

  const expensesByTruck = Array.from(truckExpMap.entries())
    .map(([id, stats]) => ({ truck: truckNameMap.get(id) ?? 'Unknown', ...stats, amount: Math.round(stats.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  // Expenses by driver
  const driverExpMap = new Map<string, { amount: number; count: number }>();
  for (const e of expenses) {
    if (!e.driverId) continue;
    const entry = driverExpMap.get(e.driverId) ?? { amount: 0, count: 0 };
    entry.amount += Number(e.amount);
    entry.count++;
    driverExpMap.set(e.driverId, entry);
  }
  const expensesByDriver = Array.from(driverExpMap.entries())
    .map(([id, stats]) => {
      const d = driverInfoMap.get(id);
      return { name: d?.name ?? 'Unknown', ...stats, amount: Math.round(stats.amount * 100) / 100 };
    })
    .sort((a, b) => b.amount - a.amount);

  // Expenses over time
  const dailyExpenseMap = new Map<string, number>();
  for (const d of dayLabels) dailyExpenseMap.set(format(d, 'yyyy-MM-dd'), 0);
  for (const e of expenses) {
    const key = format(e.date, 'yyyy-MM-dd');
    dailyExpenseMap.set(key, (dailyExpenseMap.get(key) ?? 0) + Number(e.amount));
  }
  const expensesOverTime = dayLabels.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { date: format(d, dayLabels.length <= 14 ? 'EEE MMM d' : dayLabels.length <= 45 ? 'MMM d' : 'M/d'), amount: Math.round((dailyExpenseMap.get(key) ?? 0) * 100) / 100 };
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // ═══════════════════════════════════════════════════════════════════
  // PAYROLL / DRIVER PAYOUT QUERIES
  // ═══════════════════════════════════════════════════════════════════

  let driverPayments: any[] = [];
  try {
    driverPayments = await prisma.driverPayment.findMany({
      where: {
        companyId: session.companyId,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        driverId: true,
        payType: true,
        payRate: true,
        hoursWorked: true,
        jobsCompleted: true,
        ticketsCompleted: true,
        calculatedAmount: true,
        adjustedAmount: true,
        finalAmount: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
    });
  } catch {
    // Table may not exist yet
  }

  // Aggregate payouts per driver
  const driverPayoutMap = new Map<string, { totalPaid: number; totalPending: number; payments: number }>();
  for (const p of driverPayments) {
    if (!p.driverId) continue;
    const entry = driverPayoutMap.get(p.driverId) ?? { totalPaid: 0, totalPending: 0, payments: 0 };
    const amt = Number(p.finalAmount ?? p.calculatedAmount ?? 0);
    if (p.status === 'PAID') entry.totalPaid += amt;
    else entry.totalPending += amt;
    entry.payments++;
    driverPayoutMap.set(p.driverId, entry);
  }

  const driverPayouts = Array.from(driverPayoutMap.entries())
    .map(([id, stats]) => {
      const d = driverInfoMap.get(id);
      return {
        name: d?.name ?? 'Unknown',
        truck: d?.assignedTruck?.truckNumber ?? '',
        workerType: d?.workerType ?? 'CONTRACTOR',
        payType: d?.payType ?? 'PERCENTAGE',
        ...stats,
        totalPaid: Math.round(stats.totalPaid * 100) / 100,
        totalPending: Math.round(stats.totalPending * 100) / 100,
      };
    })
    .sort((a, b) => b.totalPaid - a.totalPaid);

  const totalPayroll = driverPayments.reduce((sum, p) => {
    if (p.status === 'PAID') return sum + Number(p.finalAmount ?? p.calculatedAmount ?? 0);
    return sum;
  }, 0);
  const totalPendingPayroll = driverPayments.reduce((sum, p) => {
    if (p.status !== 'PAID') return sum + Number(p.finalAmount ?? p.calculatedAmount ?? 0);
    return sum;
  }, 0);

  // ═══════════════════════════════════════════════════════════════════
  // INVOICE QUERIES
  // ═══════════════════════════════════════════════════════════════════

  const [invoiceStats, paidInvoices, overdueInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId: session.companyId, createdAt: { gte: rangeStart, lte: rangeEnd } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { companyId: session.companyId, status: 'PAID', createdAt: { gte: rangeStart, lte: rangeEnd } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { companyId: session.companyId, status: 'OVERDUE', createdAt: { gte: rangeStart, lte: rangeEnd } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // OVERVIEW / SUMMARY QUERIES
  // ═══════════════════════════════════════════════════════════════════

  const statusCounts = await prisma.ticket.groupBy({
    by: ['status'],
    where: { companyId: session.companyId, createdAt: { gte: rangeStart, lte: rangeEnd }, deletedAt: null },
    _count: true,
  });

  const totalTickets = statusCounts.reduce((sum, s) => sum + s._count, 0);

  const [totalJobs, completedJobsCount, activeJobsCount] = await Promise.all([
    prisma.job.count({ where: { companyId: session.companyId, createdAt: { gte: rangeStart, lte: rangeEnd }, deletedAt: null } }),
    prisma.job.count({ where: { companyId: session.companyId, status: 'COMPLETED', completedAt: { gte: rangeStart, lte: rangeEnd }, deletedAt: null } }),
    prisma.job.count({ where: { companyId: session.companyId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, deletedAt: null } }),
  ]);

  // Active driver/truck counts
  const activeDriverCount = await prisma.driver.count({ where: { companyId: session.companyId, active: true } });
  const activeTruckCount = await prisma.truck.count({ where: { companyId: session.companyId, active: true } });

  // Profit/loss over time
  const profitOverTime = dayLabels.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    const rev = dailyRevenueMap.get(key) ?? 0;
    const exp = dailyExpenseMap.get(key) ?? 0;
    return {
      date: format(d, dayLabels.length <= 14 ? 'EEE MMM d' : dayLabels.length <= 45 ? 'MMM d' : 'M/d'),
      revenue: Math.round(rev * 100) / 100,
      expenses: Math.round(exp * 100) / 100,
      profit: Math.round((rev - exp) * 100) / 100,
    };
  });

  // Material breakdown
  const materialMap = new Map<string, { revenue: number; qty: number }>();
  for (const tk of completedTickets) {
    const mat = tk.material?.trim() || 'Unspecified';
    const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : 0;
    const qty = Number(tk.quantity);
    const entry = materialMap.get(mat) ?? { revenue: 0, qty: 0 };
    entry.revenue += rate * qty;
    entry.qty += qty;
    materialMap.set(mat, entry);
  }
  const materialBreakdown = Array.from(materialMap.entries())
    .map(([material, stats]) => ({ material, revenue: Math.round(stats.revenue * 100) / 100, qty: Math.round(stats.qty * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  return {
    // Overview
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
    totalTickets,
    completedTickets: completedTickets.length,
    totalJobs,
    completedJobsCount,
    activeJobsCount,
    activeDriverCount,
    activeTruckCount,
    // Invoices
    invoiceCount: invoiceStats._count,
    invoiceTotal: Number(invoiceStats._sum.total ?? 0),
    paidCount: paidInvoices._count,
    paidTotal: Number(paidInvoices._sum.total ?? 0),
    overdueCount: overdueInvoices._count,
    overdueTotal: Number(overdueInvoices._sum.total ?? 0),
    // Revenue breakdowns
    customerRevenue,
    brokerRevenue,
    driverRevenue,
    jobRevenue,
    revenueOverTime,
    materialBreakdown,
    statusCounts: statusCounts.map(s => ({ status: s.status, count: s._count })),
    // Expenses
    expensesByCategory,
    expensesByTruck,
    expensesByDriver,
    expensesOverTime,
    // Payroll
    totalPayroll: Math.round(totalPayroll * 100) / 100,
    totalPendingPayroll: Math.round(totalPendingPayroll * 100) / 100,
    driverPayouts,
    // Profit
    profitOverTime,
  };
  }, 'Unable to load reports. Please try again.');

  const data = reportData;
  const activeTab = searchParams.tab || 'overview';

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('reports.analytics', lang)}</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('reports.title', lang)}</h1>
          <p className="text-sm text-steel-500 mt-1">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            { label: '7d', value: '7' },
            { label: '14d', value: '14' },
            { label: '30d', value: '30' },
            { label: '90d', value: '90' },
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
            { label: 'Quarter', value: 'quarter' },
            { label: 'Year', value: 'year' },
          ].map((p) => (
            <a
              key={p.value}
              href={`/reports?range=${p.value}&tab=${activeTab}`}
              className={`px-2.5 py-1 rounded border text-xs font-medium ${
                (!searchParams.from && range === p.value) ? 'bg-diesel text-white border-diesel' : 'border-steel-300 bg-white hover:bg-steel-50'
              }`}
            >
              {p.label}
            </a>
          ))}
        </div>
      </header>

      <FinancialReports data={data} activeTab={activeTab} currentRange={range} />
    </div>
  );
}
