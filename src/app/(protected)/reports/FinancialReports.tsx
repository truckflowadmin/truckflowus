'use client';

import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

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
}

type Tab = 'overview' | 'revenue' | 'expenses' | 'payroll' | 'profit';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'profit', label: 'Profit & Loss' },
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function FinancialReports({ data, activeTab: initialTab, currentRange }: { data: ReportData; activeTab: string; currentRange: string }) {
  const [tab, setTab] = useState<Tab>((initialTab as Tab) || 'overview');

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
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
      </div>

      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'revenue' && <RevenueTab data={data} />}
      {tab === 'expenses' && <ExpensesTab data={data} />}
      {tab === 'payroll' && <PayrollTab data={data} />}
      {tab === 'profit' && <ProfitTab data={data} />}
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
      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Total Revenue" value={`$${fmt(data.totalRevenue)}`} accent="green" />
        <KPICard label="Total Expenses" value={`$${fmt(data.totalExpenses)}`} accent="red" />
        <KPICard label="Net Profit" value={`$${fmt(data.netProfit)}`} accent={data.netProfit >= 0 ? 'green' : 'red'} />
        <KPICard label="Profit Margin" value={`${profitMargin.toFixed(1)}%`} accent={profitMargin >= 0 ? 'green' : 'red'} />
        <KPICard label="Payroll Paid" value={`$${fmt(data.totalPayroll)}`} accent="blue" />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniCard label="Tickets" value={data.totalTickets} sub={`${data.completedTickets} completed`} />
        <MiniCard label="Jobs" value={data.totalJobs} sub={`${data.completedJobsCount} completed`} />
        <MiniCard label="Active Jobs" value={data.activeJobsCount} />
        <MiniCard label="Invoices" value={data.invoiceCount} sub={`$${fmt(data.invoiceTotal)}`} />
        <MiniCard label="Paid" value={data.paidCount} sub={`$${fmt(data.paidTotal)}`} />
        <MiniCard label="Overdue" value={data.overdueCount} sub={data.overdueCount > 0 ? `$${fmt(data.overdueTotal)}` : '—'} warn={data.overdueCount > 0} />
      </div>

      {/* Profit trend chart */}
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

      {/* Quick views */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top customers */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-3">Top Customers</h2>
          <RankList items={data.customerRevenue.slice(0, 5).map(c => ({ label: c.name, value: `$${fmt(c.revenue)}` }))} />
        </div>
        {/* Top expenses */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-3">Expenses by Category</h2>
          <RankList items={data.expensesByCategory.slice(0, 5).map(e => ({ label: formatCategory(e.category), value: `$${fmt(e.amount)}` }))} />
        </div>
        {/* Status breakdown */}
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

function RevenueTab({ data }: { data: ReportData }) {
  const [view, setView] = useState<'customer' | 'broker' | 'driver' | 'job' | 'material'>('customer');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={`$${fmt(data.totalRevenue)}`} accent="green" />
        <KPICard label="Invoiced" value={`$${fmt(data.invoiceTotal)}`} accent="blue" />
        <KPICard label="Collected" value={`$${fmt(data.paidTotal)}`} accent="green" />
        <KPICard label="Outstanding" value={`$${fmt(data.overdueTotal)}`} accent={data.overdueTotal > 0 ? 'red' : 'green'} />
      </div>

      {/* Revenue trend */}
      <div className="panel p-5">
        <h2 className="font-semibold mb-4">Revenue Over Time</h2>
        <BarChart
          data={data.revenueOverTime}
          bars={[{ key: 'revenue', color: '#22c55e', label: 'Revenue' }]}
          xKey="date"
        />
      </div>

      {/* View selector */}
      <div className="flex gap-1 flex-wrap">
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

      {view === 'customer' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-right px-4 py-3">Revenue</th>
                <th className="text-right px-4 py-3">Loads</th>
                <th className="text-right px-4 py-3">Tons</th>
                <th className="text-right px-4 py-3">Yards</th>
              </tr>
            </thead>
            <tbody>
              {data.customerRevenue.map((c, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(c.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.loads || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.tons ? c.tons.toFixed(1) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.yards ? c.yards.toFixed(1) : '—'}</td>
                </tr>
              ))}
              {data.customerRevenue.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-steel-500">No revenue data for this period.</td></tr>
              )}
            </tbody>
            {data.customerRevenue.length > 0 && (
              <tfoot className="bg-steel-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">${fmt(data.customerRevenue.reduce((s, c) => s + c.revenue, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.customerRevenue.reduce((s, c) => s + c.loads, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.customerRevenue.reduce((s, c) => s + c.tons, 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{data.customerRevenue.reduce((s, c) => s + c.yards, 0).toFixed(1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {view === 'broker' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Broker</th>
                <th className="text-right px-4 py-3">Revenue</th>
                <th className="text-right px-4 py-3">Loads</th>
                <th className="text-right px-4 py-3">Tons</th>
                <th className="text-right px-4 py-3">Yards</th>
              </tr>
            </thead>
            <tbody>
              {data.brokerRevenue.map((b, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(b.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.loads || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.tons ? b.tons.toFixed(1) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.yards ? b.yards.toFixed(1) : '—'}</td>
                </tr>
              ))}
              {data.brokerRevenue.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-steel-500">No broker revenue for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'driver' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Driver</th>
                <th className="text-left px-4 py-3">Truck</th>
                <th className="text-right px-4 py-3">Revenue Generated</th>
                <th className="text-right px-4 py-3">Tickets</th>
                <th className="text-right px-4 py-3">Loads</th>
              </tr>
            </thead>
            <tbody>
              {data.driverRevenue.map((d, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-steel-500">{d.truck || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(d.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.tickets}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.loads}</td>
                </tr>
              ))}
              {data.driverRevenue.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-steel-500">No driver revenue for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'job' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Job #</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-right px-4 py-3">Revenue</th>
                <th className="text-right px-4 py-3">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {data.jobRevenue.map((j, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-mono text-sm">{String(j.jobNumber).padStart(4, '0')}</td>
                  <td className="px-4 py-3 font-medium">{j.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(j.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{j.tickets}</td>
                </tr>
              ))}
              {data.jobRevenue.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-steel-500">No job revenue for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'material' && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-right px-4 py-3">Revenue</th>
                <th className="text-right px-4 py-3">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {data.materialBreakdown.map((m, i) => (
                <tr key={i} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-4 py-3 font-medium">{m.material}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">${fmt(m.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.qty}</td>
                </tr>
              ))}
              {data.materialBreakdown.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-steel-500">No material data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPENSES TAB
// ═══════════════════════════════════════════════════════════════════

function ExpensesTab({ data }: { data: ReportData }) {
  const [view, setView] = useState<'category' | 'truck' | 'driver'>('category');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Expenses" value={`$${fmt(data.totalExpenses)}`} accent="red" />
        <KPICard label="Categories" value={data.expensesByCategory.length} />
        <KPICard label="Trucks with Expenses" value={data.expensesByTruck.length} />
        <KPICard label="Active Trucks" value={data.activeTruckCount} />
      </div>

      {/* Expenses trend */}
      <div className="panel p-5">
        <h2 className="font-semibold mb-4">Expenses Over Time</h2>
        <BarChart
          data={data.expensesOverTime}
          bars={[{ key: 'amount', color: '#ef4444', label: 'Expenses' }]}
          xKey="date"
        />
      </div>

      {/* View selector */}
      <div className="flex gap-1">
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
          {/* Visual breakdown */}
          <div className="panel p-5">
            <h2 className="font-semibold mb-4">Category Breakdown</h2>
            {data.expensesByCategory.length === 0 ? (
              <p className="text-sm text-steel-500">No expenses for this period.</p>
            ) : (
              <div className="space-y-3">
                {data.expensesByCategory.map((e, i) => {
                  const maxCat = data.expensesByCategory[0]?.amount || 1;
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
            )}
          </div>

          {/* Table */}
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
                {data.expensesByCategory.map((e, i) => (
                  <tr key={i} className="border-b border-steel-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                        <span className="font-medium">{formatCategory(e.category)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">${fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-steel-500">
                      {data.totalExpenses > 0 ? ((e.amount / data.totalExpenses) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
              {data.expensesByCategory.length > 0 && (
                <tfoot className="bg-steel-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">${fmt(data.totalExpenses)}</td>
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

function PayrollTab({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Paid" value={`$${fmt(data.totalPayroll)}`} accent="blue" />
        <KPICard label="Pending" value={`$${fmt(data.totalPendingPayroll)}`} accent={data.totalPendingPayroll > 0 ? 'amber' : 'green'} />
        <KPICard label="Active Drivers" value={data.activeDriverCount} />
        <KPICard label="Revenue per Driver" value={data.driverRevenue.length > 0 ? `$${fmt(data.totalRevenue / data.driverRevenue.length)}` : '—'} />
      </div>

      {/* Driver payouts table */}
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

      {/* Revenue generated per driver */}
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

function ProfitTab({ data }: { data: ReportData }) {
  const margin = data.totalRevenue > 0 ? (data.netProfit / data.totalRevenue) * 100 : 0;
  const operatingProfit = data.totalRevenue - data.totalExpenses - data.totalPayroll;
  const operatingMargin = data.totalRevenue > 0 ? (operatingProfit / data.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Gross Revenue" value={`$${fmt(data.totalRevenue)}`} accent="green" />
        <KPICard label="Total Costs" value={`$${fmt(data.totalExpenses + data.totalPayroll)}`} accent="red" />
        <KPICard label="Operating Profit" value={`$${fmt(operatingProfit)}`} accent={operatingProfit >= 0 ? 'green' : 'red'} />
        <KPICard label="Operating Margin" value={`${operatingMargin.toFixed(1)}%`} accent={operatingMargin >= 0 ? 'green' : 'red'} />
      </div>

      {/* P&L trend */}
      <div className="panel p-5">
        <h2 className="font-semibold mb-4">Profit Trend</h2>
        <BarChart
          data={data.profitOverTime}
          bars={[{ key: 'profit', color: '#22c55e', label: 'Daily Profit' }]}
          xKey="date"
          allowNegative
        />
      </div>

      {/* P&L Statement */}
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
      {/* Legend */}
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
