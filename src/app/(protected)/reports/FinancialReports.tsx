'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface RawExpense {
  amount: number;
  category: string;
  date: string;
  truckId: string | null;
  driverId: string | null;
  truck: string;
  driver: string;
  vendor: string;
  description: string;
}

interface ReportData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalTickets: number;
  completedTickets: number;
  totalJobs: number;
  completedJobsCount: number;
  activeJobsCount: number;
  activeDriverCount: number;
  activeTruckCount: number;
  invoiceCount: number;
  invoiceTotal: number;
  paidCount: number;
  paidTotal: number;
  overdueCount: number;
  overdueTotal: number;
  customerRevenue: { name: string; revenue: number; loads: number; tons: number; yards: number }[];
  brokerRevenue: { name: string; revenue: number; loads: number; tons: number; yards: number }[];
  driverRevenue: { name: string; truck: string; revenue: number; tickets: number; loads: number }[];
  jobRevenue: { jobNumber: number; name: string; revenue: number; tickets: number }[];
  revenueOverTime: { date: string; revenue: number }[];
  materialBreakdown: { material: string; revenue: number; qty: number }[];
  statusCounts: { status: string; count: number }[];
  expensesByCategory: { category: string; amount: number }[];
  expensesByTruck: { truck: string; amount: number; count: number }[];
  expensesByDriver: { name: string; amount: number; count: number }[];
  expensesOverTime: { date: string; amount: number }[];
  totalPayroll: number;
  totalPendingPayroll: number;
  driverPayouts: { name: string; truck: string; workerType: string; payType: string; totalPaid: number; totalPending: number; payments: number }[];
  profitOverTime: { date: string; revenue: number; expenses: number; profit: number }[];
  rawExpenses: RawExpense[];
}

interface FilterOption {
  id: string;
  label: string;
}

type Tab = 'overview' | 'revenue' | 'expenses' | 'payroll' | 'profit';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'profit', label: 'Profit & Loss' },
];

const RANGE_OPTIONS = [
  { label: '7d', value: '7' },
  { label: '14d', value: '14' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'Year', value: 'year' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#cfd4da',
  DISPATCHED: '#93c5fd',
  IN_PROGRESS: '#FFB500',
  COMPLETED: '#86efac',
  CANCELLED: '#a9b1ba',
  ISSUE: '#fca5a5',
};

const EXPENSE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#06b6d4'];

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═══════════════════════════════════════════════════════════════════
// CSV EXPORT UTILITY
// ═══════════════════════════════════════════════════════════════════

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function FinancialReports({
  data,
  activeTab: initialTab,
  currentRange,
  periodLabel,
  truckList,
  driverList,
}: {
  data: ReportData;
  activeTab: string;
  currentRange: string;
  periodLabel: string;
  truckList: FilterOption[];
  driverList: FilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (initialTab as Tab) || 'overview';

  const setTab = useCallback((newTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`/reports?${params.toString()}`);
  }, [router, searchParams]);

  const setRange = useCallback((range: string) => {
    const params = new URLSearchParams();
    params.set('range', range);
    params.set('tab', tab);
    router.push(`/reports?${params.toString()}`);
  }, [router, tab]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportOverview = useCallback(() => {
    const headers = ['Metric', 'Value'];
    const rows: (string | number)[][] = [
      ['Total Revenue', data.totalRevenue],
      ['Total Expenses', data.totalExpenses],
      ['Net Profit', data.netProfit],
      ['Total Payroll (Paid)', data.totalPayroll],
      ['Payroll Pending', data.totalPendingPayroll],
      ['Completed Tickets', data.completedTickets],
      ['Total Tickets', data.totalTickets],
      ['Total Jobs', data.totalJobs],
      ['Completed Jobs', data.completedJobsCount],
      ['Active Jobs', data.activeJobsCount],
      ['Active Drivers', data.activeDriverCount],
      ['Active Trucks', data.activeTruckCount],
      ['Invoices', data.invoiceCount],
      ['Invoice Total', data.invoiceTotal],
      ['Paid Invoices', data.paidCount],
      ['Paid Total', data.paidTotal],
      ['Overdue Invoices', data.overdueCount],
      ['Overdue Total', data.overdueTotal],
    ];
    downloadCSV(`report-overview-${currentRange}.csv`, headers, rows);
  }, [data, currentRange]);

  return (
    <div>
      {/* Header with period selector */}
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-6 print:hidden">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Analytics</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-sm text-steel-500 mt-1">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGE_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setRange(p.value)}
              className={`px-2.5 py-1 rounded border text-xs font-medium ${
                currentRange === p.value ? 'bg-diesel text-white border-diesel' : 'border-steel-300 bg-white hover:bg-steel-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <p className="text-sm text-gray-500">{periodLabel} &middot; Printed {new Date().toLocaleDateString()}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-diesel text-white shadow-sm'
                : 'bg-white border border-steel-200 text-steel-600 hover:bg-steel-50'
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Export buttons */}
        <div className="ml-auto flex gap-1">
          <button
            onClick={handleExportOverview}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-green-300 text-green-700 hover:bg-green-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Excel
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print / PDF
          </button>
        </div>
      </div>

      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'revenue' && <RevenueTab data={data} currentRange={currentRange} />}
      {tab === 'expenses' && <ExpensesTab data={data} truckList={truckList} driverList={driverList} currentRange={currentRange} />}
      {tab === 'payroll' && <PayrollTab data={data} currentRange={currentRange} />}
      {tab === 'profit' && <ProfitTab data={data} currentRange={currentRange} />}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, aside, .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .panel { break-inside: avoid; box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          table { font-size: 11px; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: ReportData }) {
  const profitMargin = data.totalRevenue > 0 ? ((data.netProfit / data.totalRevenue) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Total Revenue" value={`$${fmt(data.totalRevenue)}`} accent="green" />
        <KPICard label="Total Expenses" value={`$${fmt(data.totalExpenses)}`} accent="red" />
        <KPICard label="Net Profit" value={`$${fmt(data.netProfit)}`} accent={data.netProfit >= 0 ? 'green' : 'red'} />
        <KPICard label="Profit Margin" value={`${profitMargin.toFixed(1)}%`} accent={profitMargin >= 0 ? 'green' : 'red'} />
        <KPICard label="Payroll Paid" value={`$${fmt(data.totalPayroll)}`} accent="blue" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniCard label="Tickets" value={data.totalTickets} sub={`${data.completedTickets} completed`} />
        <MiniCard label="Jobs" value={data.totalJobs} sub={`${data.completedJobsCount} completed`} />
        <MiniCard label="Active Jobs" value={data.activeJobsCount} />
        <MiniCard label="Invoices" value={data.invoiceCount} sub={`$${fmt(data.invoiceTotal)}`} />
        <MiniCard label="Paid" value={data.paidCount} sub={`$${fmt(data.paidTotal)}`} />
        <MiniCard label="Overdue" value={data.overdueCount} sub={data.overdueCount > 0 ? `$${fmt(data.overdueTotal)}` : '—'} warn={data.overdueCount > 0} />
      </div>

      <div className="panel p-5">
        <h2 className="font-semibold mb-4">Revenue vs Expenses</h2>
        <BarChart
          data={data.profitOverTime}
          bars={[
            { key: 'revenue', color: '#22c55e', label: 'Revenue' },
            { key: 'expenses', color: '#ef4444', label: 'Expenses' },
          ]}
          xKey="date"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="panel p-5">
          <h2 className="font-semibold mb-3">Top Customers</h2>
          <RankList items={data.customerRevenue.slice(0, 5).map(c => ({ label: c.name, value: `$${fmt(c.revenue)}` }))} />
        </div>
        <div className="panel p-5">
          <h2 className="font-semibold mb-3">Expenses by Category</h2>
          <RankList items={data.expensesByCategory.slice(0, 5).map(e => ({ label: formatCategory(e.category), value: `$${fmt(e.amount)}` }))} />
        </div>
        <div className="panel p-5">
          <h2 className="font-semibold mb-3">Ticket Status</h2>
          <StatusBars items={data.statusCounts} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REVENUE TAB
// ═══════════════════════════════════════════════════════════════════

function RevenueTab({ data, currentRange }: { data: ReportData; currentRange: string }) {
  const [view, setView] = useState<'customer' | 'broker' | 'driver' | 'job' | 'material'>('customer');

  const handleExport = useCallback(() => {
    if (view === 'customer') {
      downloadCSV(`revenue-by-customer-${currentRange}.csv`,
        ['Customer', 'Revenue', 'Loads', 'Tons', 'Yards'],
        data.customerRevenue.map(c => [c.name, c.revenue, c.loads, c.tons, c.yards]));
    } else if (view === 'broker') {
      downloadCSV(`revenue-by-broker-${currentRange}.csv`,
        ['Broker', 'Revenue', 'Loads', 'Tons', 'Yards'],
        data.brokerRevenue.map(b => [b.name, b.revenue, b.loads, b.tons, b.yards]));
    } else if (view === 'driver') {
      downloadCSV(`revenue-by-driver-${currentRange}.csv`,
        ['Driver', 'Truck', 'Revenue', 'Tickets', 'Loads'],
        data.driverRevenue.map(d => [d.name, d.truck, d.revenue, d.tickets, d.loads]));
    } else if (view === 'job') {
      downloadCSV(`revenue-by-job-${currentRange}.csv`,
        ['Job #', 'Name', 'Revenue', 'Tickets'],
        data.jobRevenue.map(j => [j.jobNumber, j.name, j.revenue, j.tickets]));
    } else if (view === 'material') {
      downloadCSV(`revenue-by-material-${currentRange}.csv`,
        ['Material', 'Revenue', 'Quantity'],
        data.materialBreakdown.map(m => [m.material, m.revenue, m.qty]));
    }
  }, [view, data, currentRange]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={`$${fmt(data.totalRevenue)}`} accent="green" />
        <KPICard label="Invoiced" value={`$${fmt(data.invoiceTotal)}`} accent="blue" />
        <KPICard label="Collected" value={`$${fmt(data.paidTotal)}`} accent="green" />
        <KPICard label="Outstanding" value={`$${fmt(data.overdueTotal)}`} accent={data.overdueTotal > 0 ? 'red' : 'green'} />
      </div>

      <div className="panel p-5">
        <h2 className="font-semibold mb-4">Revenue Over Time</h2>
        <BarChart
          data={data.revenueOverTime}
          bars={[{ key: 'revenue', color: '#22c55e', label: 'Revenue' }]}
          xKey="date"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <div className="flex gap-1">
          {([
            { key: 'customer', label: 'By Customer' },
            { key: 'broker', label: 'By Broker' },
            { key: 'driver', label: 'By Driver' },
            { key: 'job', label: 'By Job' },
            { key: 'material', label: 'By Material' },
          ] as const).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded border text-xs font-medium ${
                view === v.key ? 'bg-diesel text-white border-diesel' : 'border-steel-300 hover:bg-steel-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={handleExport} className="ml-auto px-3 py-1.5 rounded border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50">
          Export {view}
        </button>
      </div>

      {view === 'customer' && <RevenueTable headers={['Customer', 'Revenue', 'Loads', 'Tons', 'Yards']} rows={data.customerRevenue.map(c => [c.name, `$${fmt(c.revenue)}`, c.loads || '—', c.tons ? c.tons.toFixed(1) : '—', c.yards ? c.yards.toFixed(1) : '—'])} totals={data.customerRevenue.length > 0 ? ['Total', `$${fmt(data.customerRevenue.reduce((s, c) => s + c.revenue, 0))}`, String(data.customerRevenue.reduce((s, c) => s + c.loads, 0)), data.customerRevenue.reduce((s, c) => s + c.tons, 0).toFixed(1), data.customerRevenue.reduce((s, c) => s + c.yards, 0).toFixed(1)] : undefined} />}
      {view === 'broker' && <RevenueTable headers={['Broker', 'Revenue', 'Loads', 'Tons', 'Yards']} rows={data.brokerRevenue.map(b => [b.name, `$${fmt(b.revenue)}`, b.loads || '—', b.tons ? b.tons.toFixed(1) : '—', b.yards ? b.yards.toFixed(1) : '—'])} />}
      {view === 'driver' && <RevenueTable headers={['Driver', 'Truck', 'Revenue', 'Tickets', 'Loads']} rows={data.driverRevenue.map(d => [d.name, d.truck || '—', `$${fmt(d.revenue)}`, d.tickets, d.loads])} />}
      {view === 'job' && <RevenueTable headers={['Job #', 'Name', 'Revenue', 'Tickets']} rows={data.jobRevenue.map(j => [String(j.jobNumber).padStart(4, '0'), j.name, `$${fmt(j.revenue)}`, j.tickets])} />}
      {view === 'material' && <RevenueTable headers={['Material', 'Revenue', 'Quantity']} rows={data.materialBreakdown.map(m => [m.material, `$${fmt(m.revenue)}`, m.qty])} />}
    </div>
  );
}

function RevenueTable({ headers, rows, totals }: { headers: string[]; rows: (string | number)[][]; totals?: string[] }) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`px-4 py-3 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-medium' : 'text-right tabular-nums'} ${typeof cell === 'string' && cell.startsWith('$') ? 'text-green-700 font-semibold' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-steel-500">No data for this period.</td></tr>
          )}
        </tbody>
        {totals && (
          <tfoot className="bg-steel-50 font-semibold">
            <tr>
              {totals.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? '' : 'text-right tabular-nums'}`}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPENSES TAB (with comparison & filters)
// ═══════════════════════════════════════════════════════════════════

function ExpensesTab({ data, truckList, driverList, currentRange }: { data: ReportData; truckList: FilterOption[]; driverList: FilterOption[]; currentRange: string }) {
  const [view, setView] = useState<'category' | 'truck' | 'driver'>('category');
  const [groupBy, setGroupBy] = useState<'week' | 'month' | 'year'>('week');
  const [filterTruck, setFilterTruck] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  // Filter raw expenses
  const filteredExpenses = useMemo(() => {
    let exps = data.rawExpenses;
    if (filterTruck) exps = exps.filter(e => e.truckId === filterTruck);
    if (filterDriver) exps = exps.filter(e => e.driverId === filterDriver);
    return exps;
  }, [data.rawExpenses, filterTruck, filterDriver]);

  const filteredTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);

  // Group expenses by period for comparison
  const comparisonData = useMemo(() => {
    const groups = new Map<string, { label: string; amount: number; count: number }>();

    for (const exp of filteredExpenses) {
      const d = new Date(exp.date);
      let key: string;
      let label: string;

      if (groupBy === 'week') {
        // ISO week: find Monday of the week
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        key = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (groupBy === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      } else {
        key = String(d.getFullYear());
        label = String(d.getFullYear());
      }

      const entry = groups.get(key) ?? { label, amount: 0, count: 0 };
      entry.amount += exp.amount;
      entry.count++;
      groups.set(key, entry);
    }

    return Array.from(groups.values()).sort((a, b) => {
      // Sort chronologically by label comparison (keys are already chronological)
      return 0; // preserve map insertion order which is by date
    });
  }, [filteredExpenses, groupBy]);

  // Category breakdown of filtered expenses
  const filteredByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const handleExport = useCallback(() => {
    if (showComparison) {
      downloadCSV(`expense-comparison-${groupBy}-${currentRange}.csv`,
        ['Period', 'Total Expenses', 'Transactions'],
        comparisonData.map(d => [d.label, d.amount, d.count]));
    } else if (view === 'category') {
      downloadCSV(`expenses-by-category-${currentRange}.csv`,
        ['Category', 'Amount', '% of Total'],
        (filterTruck || filterDriver ? filteredByCategory : data.expensesByCategory).map(e => [
          formatCategory(e.category), e.amount, filteredTotal > 0 ? ((e.amount / filteredTotal) * 100).toFixed(1) + '%' : '0%'
        ]));
    } else if (view === 'truck') {
      downloadCSV(`expenses-by-truck-${currentRange}.csv`,
        ['Truck', 'Total Expenses', 'Transactions', 'Avg per Transaction'],
        data.expensesByTruck.map(t => [t.truck, t.amount, t.count, t.count > 0 ? (t.amount / t.count).toFixed(2) : '0']));
    } else if (view === 'driver') {
      downloadCSV(`expenses-by-driver-${currentRange}.csv`,
        ['Driver', 'Total Expenses', 'Transactions'],
        data.expensesByDriver.map(d => [d.name, d.amount, d.count]));
    }
  }, [showComparison, view, data, currentRange, groupBy, comparisonData, filteredByCategory, filteredTotal, filterTruck, filterDriver]);

  const isFiltered = filterTruck || filterDriver;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={isFiltered ? 'Filtered Expenses' : 'Total Expenses'} value={`$${fmt(isFiltered ? filteredTotal : data.totalExpenses)}`} accent="red" />
        <KPICard label="Categories" value={isFiltered ? filteredByCategory.length : data.expensesByCategory.length} />
        <KPICard label="Trucks with Expenses" value={data.expensesByTruck.length} />
        <KPICard label="Active Trucks" value={data.activeTruckCount} />
      </div>

      {/* Filters */}
      <div className="panel p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-steel-700">Filters:</span>
          <select
            value={filterTruck}
            onChange={(e) => setFilterTruck(e.target.value)}
            className="px-3 py-1.5 rounded border border-steel-300 text-sm bg-white"
          >
            <option value="">All Trucks</option>
            {truckList.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
            className="px-3 py-1.5 rounded border border-steel-300 text-sm bg-white"
          >
            <option value="">All Drivers</option>
            {driverList.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          {isFiltered && (
            <button
              onClick={() => { setFilterTruck(''); setFilterDriver(''); }}
              className="px-2 py-1 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1.5 rounded border text-xs font-medium ${
                showComparison ? 'bg-diesel text-white border-diesel' : 'border-steel-300 hover:bg-steel-50'
              }`}
            >
              {showComparison ? 'Hide' : 'Show'} Comparison
            </button>
            <button onClick={handleExport} className="px-3 py-1.5 rounded border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Comparison view */}
      {showComparison && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Expense Comparison</h2>
            <div className="flex gap-1">
              {(['week', 'month', 'year'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1 rounded border text-xs font-medium capitalize ${
                    groupBy === g ? 'bg-diesel text-white border-diesel' : 'border-steel-300 hover:bg-steel-50'
                  }`}
                >
                  {g === 'week' ? 'Weekly' : g === 'month' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>

          {comparisonData.length === 0 ? (
            <p className="text-sm text-steel-500">No expense data for this period{isFiltered ? ' with the selected filters' : ''}.</p>
          ) : (
            <>
              <BarChart
                data={comparisonData.map(d => ({ date: d.label, amount: Math.round(d.amount * 100) / 100 }))}
                bars={[{ key: 'amount', color: '#ef4444', label: 'Expenses' }]}
                xKey="date"
              />
              <div className="mt-4">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                    <tr>
                      <th className="text-left px-4 py-2">Period</th>
                      <th className="text-right px-4 py-2">Total</th>
                      <th className="text-right px-4 py-2">Transactions</th>
                      <th className="text-right px-4 py-2">Avg / Transaction</th>
                      <th className="text-right px-4 py-2">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((d, i) => {
                      const prev = i > 0 ? comparisonData[i - 1].amount : null;
                      const change = prev !== null && prev > 0 ? ((d.amount - prev) / prev) * 100 : null;
                      return (
                        <tr key={i} className="border-b border-steel-100">
                          <td className="px-4 py-2.5 font-medium">{d.label}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-600">${fmt(d.amount)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{d.count}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-steel-500">${fmt(d.count > 0 ? d.amount / d.count : 0)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {change !== null ? (
                              <span className={change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-steel-500'}>
                                {change > 0 ? '+' : ''}{change.toFixed(1)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-steel-50 font-semibold">
                    <tr>
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600">${fmt(comparisonData.reduce((s, d) => s + d.amount, 0))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{comparisonData.reduce((s, d) => s + d.count, 0)}</td>
                      <td className="px-4 py-2.5"></td>
                      <td className="px-4 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Expenses trend */}
      {!showComparison && (
        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Expenses Over Time</h2>
          <BarChart
            data={data.expensesOverTime}
            bars={[{ key: 'amount', color: '#ef4444', label: 'Expenses' }]}
            xKey="date"
          />
        </div>
      )}

      {/* View selector */}
      <div className="flex gap-1 print:hidden">
        {([
          { key: 'category', label: 'By Category' },
          { key: 'truck', label: 'By Truck' },
          { key: 'driver', label: 'By Driver' },
        ] as const).map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded border text-xs font-medium ${
              view === v.key ? 'bg-diesel text-white border-diesel' : 'border-steel-300 hover:bg-steel-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'category' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel p-5">
            <h2 className="font-semibold mb-4">Category Breakdown{isFiltered ? ' (Filtered)' : ''}</h2>
            {(() => {
              const cats = isFiltered ? filteredByCategory : data.expensesByCategory;
              const total = isFiltered ? filteredTotal : data.totalExpenses;
              if (cats.length === 0) return <p className="text-sm text-steel-500">No expenses for this period.</p>;
              return (
                <div className="space-y-3">
                  {cats.map((e, i) => {
                    const maxCat = cats[0]?.amount || 1;
                    const pct = (e.amount / maxCat) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{formatCategory(e.category)}</span>
                          <span className="tabular-nums text-steel-600">${fmt(e.amount)}</span>
                        </div>
                        <div className="h-3 bg-steel-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {(isFiltered ? filteredByCategory : data.expensesByCategory).map((e, i) => {
                  const total = isFiltered ? filteredTotal : data.totalExpenses;
                  return (
                    <tr key={i} className="border-b border-steel-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                          <span className="font-medium">{formatCategory(e.category)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">${fmt(e.amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-steel-500">
                        {total > 0 ? ((e.amount / total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {(isFiltered ? filteredByCategory : data.expensesByCategory).length > 0 && (
                <tfoot className="bg-steel-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">${fmt(isFiltered ? filteredTotal : data.totalExpenses)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {view === 'truck' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Truck #</th>
                <th className="text-right px-4 py-3">Total Expenses</th>
                <th className="text-right px-4 py-3">Transactions</th>
                <th className="text-right px-4 py-3">Avg per Transaction</th>
              </tr>
            </thead>
            <tbody>
              {data.expensesByTruck.map((t, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-mono font-semibold">{t.truck}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 font-semibold">${fmt(t.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-steel-500">${fmt(t.count > 0 ? t.amount / t.count : 0)}</td>
                </tr>
              ))}
              {data.expensesByTruck.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-steel-500">No truck expenses for this period.</td></tr>
              )}
            </tbody>
            {data.expensesByTruck.length > 0 && (
              <tfoot className="bg-steel-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">${fmt(data.expensesByTruck.reduce((s, t) => s + t.amount, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.expensesByTruck.reduce((s, t) => s + t.count, 0)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {view === 'driver' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Driver</th>
                <th className="text-right px-4 py-3">Total Expenses</th>
                <th className="text-right px-4 py-3">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {data.expensesByDriver.map((d, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 font-semibold">${fmt(d.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.count}</td>
                </tr>
              ))}
              {data.expensesByDriver.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-steel-500">No driver expenses for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAYROLL TAB
// ═══════════════════════════════════════════════════════════════════

function PayrollTab({ data, currentRange }: { data: ReportData; currentRange: string }) {
  const handleExport = useCallback(() => {
    downloadCSV(`payroll-${currentRange}.csv`,
      ['Driver', 'Truck', 'Worker Type', 'Pay Type', 'Total Paid', 'Pending', 'Payments'],
      data.driverPayouts.map(d => [d.name, d.truck, d.workerType, d.payType, d.totalPaid, d.totalPending, d.payments]));
  }, [data, currentRange]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Paid" value={`$${fmt(data.totalPayroll)}`} accent="blue" />
        <KPICard label="Pending" value={`$${fmt(data.totalPendingPayroll)}`} accent={data.totalPendingPayroll > 0 ? 'amber' : 'green'} />
        <KPICard label="Active Drivers" value={data.activeDriverCount} />
        <KPICard label="Revenue per Driver" value={data.driverRevenue.length > 0 ? `$${fmt(data.totalRevenue / data.driverRevenue.length)}` : '—'} />
      </div>

      <div className="flex justify-end print:hidden">
        <button onClick={handleExport} className="px-3 py-1.5 rounded border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50">
          Export Payroll
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-200 bg-steel-50">
          <h2 className="font-semibold">Driver Payouts</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
            <tr>
              <th className="text-left px-4 py-3">Driver</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Pay Type</th>
              <th className="text-right px-4 py-3">Total Paid</th>
              <th className="text-right px-4 py-3">Pending</th>
              <th className="text-right px-4 py-3">Payments</th>
            </tr>
          </thead>
          <tbody>
            {data.driverPayouts.map((d, i) => (
              <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{d.name}</div>
                  {d.truck && <div className="text-xs text-steel-500">{d.truck}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    d.workerType === 'EMPLOYEE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {d.workerType}
                  </span>
                </td>
                <td className="px-4 py-3 text-steel-600">{d.payType}</td>
                <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(d.totalPaid)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-600">{d.totalPending > 0 ? `$${fmt(d.totalPending)}` : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{d.payments}</td>
              </tr>
            ))}
            {data.driverPayouts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-steel-500">No payroll records for this period.</td></tr>
            )}
          </tbody>
          {data.driverPayouts.length > 0 && (
            <tfoot className="bg-steel-50 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={3}>Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-green-700">${fmt(data.totalPayroll)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-600">${fmt(data.totalPendingPayroll)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{data.driverPayouts.reduce((s, d) => s + d.payments, 0)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-200 bg-steel-50">
          <h2 className="font-semibold">Revenue Generated per Driver</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
            <tr>
              <th className="text-left px-4 py-3">Driver</th>
              <th className="text-right px-4 py-3">Revenue Generated</th>
              <th className="text-right px-4 py-3">Tickets</th>
              <th className="text-right px-4 py-3">Loads</th>
              <th className="text-right px-4 py-3">Revenue/Ticket</th>
            </tr>
          </thead>
          <tbody>
            {data.driverRevenue.map((d, i) => (
              <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{d.name}</div>
                  {d.truck && <div className="text-xs text-steel-500">{d.truck}</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(d.revenue)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{d.tickets}</td>
                <td className="px-4 py-3 text-right tabular-nums">{d.loads}</td>
                <td className="px-4 py-3 text-right tabular-nums text-steel-500">${fmt(d.tickets > 0 ? d.revenue / d.tickets : 0)}</td>
              </tr>
            ))}
            {data.driverRevenue.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-steel-500">No driver activity for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFIT & LOSS TAB
// ═══════════════════════════════════════════════════════════════════

function ProfitTab({ data, currentRange }: { data: ReportData; currentRange: string }) {
  const margin = data.totalRevenue > 0 ? (data.netProfit / data.totalRevenue) * 100 : 0;
  const operatingProfit = data.totalRevenue - data.totalExpenses - data.totalPayroll;
  const operatingMargin = data.totalRevenue > 0 ? (operatingProfit / data.totalRevenue) * 100 : 0;

  const handleExport = useCallback(() => {
    downloadCSV(`profit-loss-${currentRange}.csv`,
      ['Line Item', 'Amount'],
      [
        ['Gross Revenue', data.totalRevenue],
        ['Invoiced', data.invoiceTotal],
        ['Collected (Paid)', data.paidTotal],
        ['Outstanding', data.overdueTotal],
        ['Operating Expenses', data.totalExpenses],
        ...data.expensesByCategory.slice(0, 8).map(e => [`  ${formatCategory(e.category)}`, e.amount] as [string, number]),
        ['Gross Profit', data.netProfit],
        [`Margin`, margin.toFixed(1) + '%'],
        ['Payroll (Paid)', data.totalPayroll],
        ['Payroll (Pending)', data.totalPendingPayroll],
        ['Operating Profit', operatingProfit],
        ['Operating Margin', operatingMargin.toFixed(1) + '%'],
      ]);
  }, [data, currentRange, margin, operatingProfit, operatingMargin]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Gross Revenue" value={`$${fmt(data.totalRevenue)}`} accent="green" />
        <KPICard label="Total Costs" value={`$${fmt(data.totalExpenses + data.totalPayroll)}`} accent="red" />
        <KPICard label="Operating Profit" value={`$${fmt(operatingProfit)}`} accent={operatingProfit >= 0 ? 'green' : 'red'} />
        <KPICard label="Operating Margin" value={`${operatingMargin.toFixed(1)}%`} accent={operatingMargin >= 0 ? 'green' : 'red'} />
      </div>

      <div className="flex justify-end print:hidden">
        <button onClick={handleExport} className="px-3 py-1.5 rounded border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50">
          Export P&L
        </button>
      </div>

      <div className="panel p-5">
        <h2 className="font-semibold mb-4">Profit Trend</h2>
        <BarChart
          data={data.profitOverTime}
          bars={[{ key: 'profit', color: '#22c55e', label: 'Daily Profit' }]}
          xKey="date"
          allowNegative
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-200 bg-steel-50">
          <h2 className="font-semibold">Profit & Loss Statement</h2>
        </div>
        <div className="divide-y divide-steel-100">
          <PLRow label="Gross Revenue" value={data.totalRevenue} bold accent="green" />
          <PLRow label="  Invoiced" value={data.invoiceTotal} indent />
          <PLRow label="  Collected (Paid)" value={data.paidTotal} indent />
          <PLRow label="  Outstanding" value={data.overdueTotal} indent warn={data.overdueTotal > 0} />

          <div className="h-2 bg-steel-50" />

          <PLRow label="Operating Expenses" value={data.totalExpenses} bold accent="red" />
          {data.expensesByCategory.slice(0, 8).map((e, i) => (
            <PLRow key={i} label={`  ${formatCategory(e.category)}`} value={e.amount} indent />
          ))}

          <div className="h-2 bg-steel-50" />

          <PLRow label="Gross Profit (Revenue - Expenses)" value={data.netProfit} bold accent={data.netProfit >= 0 ? 'green' : 'red'} />
          <PLRow label={`  Margin: ${margin.toFixed(1)}%`} value={null} indent />

          <div className="h-2 bg-steel-50" />

          <PLRow label="Payroll (Paid)" value={data.totalPayroll} bold accent="blue" />
          <PLRow label="Payroll (Pending)" value={data.totalPendingPayroll} indent />

          <div className="h-2 bg-steel-50" />

          <PLRow label="Operating Profit (Revenue - Expenses - Payroll)" value={operatingProfit} bold accent={operatingProfit >= 0 ? 'green' : 'red'} highlight />
          <PLRow label={`  Operating Margin: ${operatingMargin.toFixed(1)}%`} value={null} indent />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function KPICard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const borderColor = accent === 'green' ? 'border-l-green-500' :
    accent === 'red' ? 'border-l-red-500' :
    accent === 'blue' ? 'border-l-blue-500' :
    accent === 'amber' ? 'border-l-amber-500' : 'border-l-steel-300';

  return (
    <div className={`panel p-4 border-l-4 ${borderColor}`}>
      <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{label}</div>
      <div className="text-xl md:text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function MiniCard({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="text-[9px] uppercase tracking-widest text-steel-500 font-semibold">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${warn ? 'text-red-600' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-steel-500">{sub}</div>}
    </div>
  );
}

function PLRow({ label, value, bold, indent, accent, warn, highlight }: {
  label: string; value: number | null; bold?: boolean; indent?: boolean; accent?: string; warn?: boolean; highlight?: boolean;
}) {
  const textColor = accent === 'green' ? 'text-green-700' :
    accent === 'red' ? 'text-red-600' :
    accent === 'blue' ? 'text-blue-600' :
    warn ? 'text-amber-600' : '';

  return (
    <div className={`flex justify-between items-center px-4 py-2.5 ${highlight ? 'bg-steel-50' : ''} ${indent ? 'pl-8' : ''}`}>
      <span className={`${bold ? 'font-semibold' : ''} ${indent ? 'text-steel-600 text-sm' : ''}`}>{label}</span>
      {value !== null && (
        <span className={`tabular-nums ${bold ? 'font-bold text-base' : 'text-sm'} ${textColor}`}>
          {value < 0 ? `-$${fmt(Math.abs(value))}` : `$${fmt(value)}`}
        </span>
      )}
    </div>
  );
}

function BarChart({ data, bars, xKey, allowNegative }: {
  data: any[];
  bars: { key: string; color: string; label: string }[];
  xKey: string;
  allowNegative?: boolean;
}) {
  if (data.length === 0) return <p className="text-sm text-steel-500">No data for this period.</p>;

  const allValues = data.flatMap((d) => bars.map((b) => d[b.key] as number));
  const maxVal = Math.max(1, ...allValues);
  const minVal = allowNegative ? Math.min(0, ...allValues) : 0;
  const range = maxVal - minVal;

  return (
    <div>
      <div className="flex gap-4 mb-2">
        {bars.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: b.color }} />
            <span className="text-xs text-steel-600">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-px" style={{ minWidth: Math.max(data.length * 18, 300), height: 180 }}>
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ minWidth: 10 }}>
              {bars.map((b) => {
                const val = d[b.key] as number;
                const pct = range > 0 ? (Math.abs(val) / range) * 100 : 0;
                const display = `$${val.toFixed(0)}`;
                return (
                  <div
                    key={b.key}
                    className="w-full rounded-t transition-colors cursor-default"
                    style={{
                      height: `${Math.max(pct, 1)}%`,
                      backgroundColor: val < 0 ? '#ef4444' : b.color,
                      opacity: 0.85,
                    }}
                    title={`${d[xKey]}: ${display}`}
                  />
                );
              })}
              <div className="hidden group-hover:block absolute bottom-full mb-1 bg-diesel text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                {d[xKey]}: {bars.map((b) => `${b.label}: $${(d[b.key] as number).toFixed(0)}`).join(' | ')}
              </div>
            </div>
          ))}
        </div>
        {data.length <= 45 && (
          <div className="flex gap-px mt-1" style={{ minWidth: Math.max(data.length * 18, 300) }}>
            {data.map((d, i) => (
              <div key={i} className="flex-1 text-[7px] text-steel-400 text-center truncate" style={{ minWidth: 10 }}>
                {i % Math.ceil(data.length / 12) === 0 ? d[xKey] : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankList({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return <p className="text-sm text-steel-500">No data for this period.</p>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex justify-between items-center py-1.5 border-b border-steel-100 last:border-0">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-steel-200 flex items-center justify-center text-[10px] font-bold text-steel-600">{i + 1}</span>
            <span className="text-sm font-medium truncate max-w-[160px]">{item.label}</span>
          </div>
          <span className="text-sm tabular-nums font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBars({ items }: { items: { status: string; count: number }[] }) {
  const total = items.reduce((s, c) => s + c.count, 0) || 1;
  const sorted = [...items].sort((a, b) => b.count - a.count);
  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        const pct = (s.count / total) * 100;
        return (
          <div key={s.status}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-steel-700">{s.status.replace('_', ' ')}</span>
              <span className="tabular-nums text-steel-500">{s.count} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-steel-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] ?? '#cfd4da' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
