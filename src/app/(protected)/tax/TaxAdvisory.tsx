'use client';

import { useState, useMemo } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

// ── IRS expense category mapping ─────────────────────────────────────
const IRS_CATEGORY_MAP: Record<string, { irsLine: string; irsDesc: string; scheduleC: string }> = {
  FUEL: { irsLine: '9', irsDesc: 'Car and truck expenses', scheduleC: 'Schedule C, Line 9' },
  MAINTENANCE: { irsLine: '21', irsDesc: 'Repairs and maintenance', scheduleC: 'Schedule C, Line 21' },
  INSURANCE: { irsLine: '15', irsDesc: 'Insurance (other than health)', scheduleC: 'Schedule C, Line 15' },
  REGISTRATION: { irsLine: '23', irsDesc: 'Taxes and licenses', scheduleC: 'Schedule C, Line 23' },
  TOLLS: { irsLine: '9', irsDesc: 'Car and truck expenses', scheduleC: 'Schedule C, Line 9' },
  TIRES: { irsLine: '21', irsDesc: 'Repairs and maintenance', scheduleC: 'Schedule C, Line 21' },
  PARTS: { irsLine: '21', irsDesc: 'Repairs and maintenance', scheduleC: 'Schedule C, Line 21' },
  LEASE: { irsLine: '20a', irsDesc: 'Rent or lease (vehicles)', scheduleC: 'Schedule C, Line 20a' },
  LOAN: { irsLine: '16a', irsDesc: 'Interest (mortgage/other)', scheduleC: 'Schedule C, Line 16a' },
  WASH: { irsLine: '27a', irsDesc: 'Other expenses', scheduleC: 'Schedule C, Line 27a' },
  PERMITS: { irsLine: '23', irsDesc: 'Taxes and licenses', scheduleC: 'Schedule C, Line 23' },
  OTHER: { irsLine: '27a', irsDesc: 'Other expenses', scheduleC: 'Schedule C, Line 27a' },
};

const CATEGORY_LABELS: Record<string, string> = {
  FUEL: 'Fuel',
  MAINTENANCE: 'Maintenance',
  INSURANCE: 'Insurance',
  REGISTRATION: 'Registration',
  TOLLS: 'Tolls',
  TIRES: 'Tires',
  PARTS: 'Parts',
  LEASE: 'Lease',
  LOAN: 'Loan Interest',
  WASH: 'Truck Wash',
  PERMITS: 'Permits',
  OTHER: 'Other',
};

interface ContractorData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  payType: string;
  payRate: number | null;
  active: boolean;
  totalPaid: number;
  needs1099: boolean;
}

interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  vendor: string | null;
  truckId: string | null;
}

interface TaxData {
  contractors: ContractorData[];
  employees: { id: string; name: string; payType: string; payRate: number | null; active: boolean }[];
  company: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null; ein: string | null };
  quarterlyRevenue: number[];
  quarterlyExpenses: number[];
  quarterlyPayroll: number[];
  expenseByCategory: Record<string, number>;
  expenses: ExpenseRow[];
  trucks: { id: string; truckNumber: string }[];
  totalRevenue: number;
  totalExpenses: number;
  totalPayroll: number;
  totalInvoiced: number;
  unpaidInvoices: number;
  selectedYear: number;
  availableYears: number[];
}

type Tab = '1099' | 'summary' | 'expenses';
type FilingStatus = 'NOT_STARTED' | 'GENERATED' | 'SENT' | 'FILED';

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TaxAdvisory({ data }: { data: TaxData }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('1099');
  const [filingStatuses, setFilingStatuses] = useState<Record<string, FilingStatus>>({});
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');
  const [expenseTruckFilter, setExpenseTruckFilter] = useState('ALL');

  const changeYear = (year: number) => {
    window.location.href = `/tax?year=${year}&tab=${tab}`;
  };

  // ── 1099 threshold contractors ────────────────────────────────────
  const contractorsOver600 = data.contractors.filter(c => c.needs1099);
  const contractorsUnder600 = data.contractors.filter(c => !c.needs1099);

  // ── Filtered expenses ─────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return data.expenses.filter(e => {
      if (expenseCategoryFilter !== 'ALL' && e.category !== expenseCategoryFilter) return false;
      if (expenseTruckFilter !== 'ALL' && e.truckId !== expenseTruckFilter) return false;
      return true;
    });
  }, [data.expenses, expenseCategoryFilter, expenseTruckFilter]);

  // ── IRS category rollup ───────────────────────────────────────────
  const irsCategoryRollup = useMemo(() => {
    const rollup: Record<string, { amount: number; categories: string[]; irsLine: string; irsDesc: string; scheduleC: string }> = {};
    for (const [cat, amount] of Object.entries(data.expenseByCategory)) {
      const irs = IRS_CATEGORY_MAP[cat] || IRS_CATEGORY_MAP.OTHER;
      const key = irs.irsLine;
      if (!rollup[key]) {
        rollup[key] = { amount: 0, categories: [], irsLine: irs.irsLine, irsDesc: irs.irsDesc, scheduleC: irs.scheduleC };
      }
      rollup[key].amount += amount;
      rollup[key].categories.push(CATEGORY_LABELS[cat] || cat);
    }
    return Object.values(rollup).sort((a, b) => b.amount - a.amount);
  }, [data.expenseByCategory]);

  const updateFilingStatus = (driverId: string, status: FilingStatus) => {
    setFilingStatuses(prev => ({ ...prev, [driverId]: status }));
  };

  const getStatusColor = (status: FilingStatus) => {
    switch (status) {
      case 'FILED': return 'bg-green-50 text-green-700 border border-green-200';
      case 'SENT': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'GENERATED': return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      default: return 'bg-steel-100 text-steel-500 border border-steel-200';
    }
  };

  const getStatusLabel = (status: FilingStatus) => {
    switch (status) {
      case 'FILED': return 'Filed';
      case 'SENT': return 'Sent';
      case 'GENERATED': return 'Generated';
      default: return 'Not Started';
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: '1099', label: '1099 Files' },
    { key: 'summary', label: 'Tax Summary' },
    { key: 'expenses', label: 'Expense Categories' },
  ];

  const netProfit = data.totalRevenue - data.totalExpenses - data.totalPayroll;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-steel-800">Tax Advisory</h1>
          <p className="text-steel-500 text-sm mt-1">1099 generation, tax summaries, and expense categorization</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-steel-500 text-sm">Tax Year:</label>
          <select
            value={data.selectedYear}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="bg-white text-steel-800 border border-steel-300 rounded px-3 py-1.5 text-sm"
          >
            {data.availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-steel-100 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-diesel text-white shadow-sm'
                : 'text-steel-600 hover:bg-steel-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1099 FILES TAB                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === '1099' && (
        <div className="space-y-6">
          {/* Summary banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Total Contractors</div>
              <div className="text-2xl font-bold text-steel-800 mt-1">{data.contractors.length}</div>
            </div>
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Need 1099 (≥ $600)</div>
              <div className="text-2xl font-bold text-diesel mt-1">{contractorsOver600.length}</div>
            </div>
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Total Contractor Payments</div>
              <div className="text-2xl font-bold text-steel-800 mt-1">{fmt(data.contractors.reduce((s, c) => s + c.totalPaid, 0))}</div>
            </div>
          </div>

          {/* Filing status overview */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-steel-500">Filing Progress:</span>
            {(['NOT_STARTED', 'GENERATED', 'SENT', 'FILED'] as FilingStatus[]).map(status => {
              const count = contractorsOver600.filter(c => (filingStatuses[c.id] || 'NOT_STARTED') === status).length;
              return (
                <span key={status} className={`px-2 py-1 rounded ${getStatusColor(status)}`}>
                  {getStatusLabel(status)}: {count}
                </span>
              );
            })}
          </div>

          {/* Contractors needing 1099 */}
          {contractorsOver600.length > 0 && (
            <div className="bg-white border border-steel-200 rounded-lg overflow-hidden shadow-sm">
              <div className="p-4 border-b border-steel-200 bg-steel-50">
                <h2 className="text-steel-800 font-semibold">1099-NEC Required (≥ $600 in {data.selectedYear})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-steel-50 text-steel-500 text-xs uppercase tracking-wider border-b border-steel-200">
                      <th className="text-left p-3">Contractor</th>
                      <th className="text-left p-3">Address</th>
                      <th className="text-right p-3">Total Paid</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-center p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steel-100">
                    {contractorsOver600.map(c => {
                      const status = filingStatuses[c.id] || 'NOT_STARTED';
                      const fullAddress = [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ');
                      return (
                        <tr key={c.id} className="hover:bg-steel-50">
                          <td className="p-3">
                            <div className="text-steel-800 font-medium">{c.name}</div>
                            <div className="text-steel-500 text-xs">{c.phone}</div>
                            {c.email && <div className="text-steel-500 text-xs">{c.email}</div>}
                          </td>
                          <td className="p-3 text-steel-600 text-xs max-w-[200px]">
                            {fullAddress || <span className="text-red-500">Missing address</span>}
                          </td>
                          <td className="p-3 text-right font-mono text-steel-800">{fmt(c.totalPaid)}</td>
                          <td className="p-3 text-center">
                            <select
                              value={status}
                              onChange={e => updateFilingStatus(c.id, e.target.value as FilingStatus)}
                              className={`text-xs rounded px-2 py-1 ${getStatusColor(status)} cursor-pointer`}
                            >
                              <option value="NOT_STARTED">Not Started</option>
                              <option value="GENERATED">Generated</option>
                              <option value="SENT">Sent</option>
                              <option value="FILED">Filed</option>
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => window.open(`/api/tax/1099?driverId=${c.id}&year=${data.selectedYear}`, '_blank')}
                              className="text-xs bg-diesel text-white px-3 py-1.5 rounded hover:bg-diesel/90 transition-colors"
                            >
                              Generate PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Contractors under $600 */}
          {contractorsUnder600.length > 0 && (
            <div className="bg-steel-50 border border-steel-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-steel-200">
                <h2 className="text-steel-600 font-semibold">Under $600 — No 1099 Required</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-steel-500 text-xs uppercase tracking-wider border-b border-steel-200">
                      <th className="text-left p-3">Contractor</th>
                      <th className="text-right p-3">Total Paid</th>
                      <th className="text-right p-3">Remaining to $600</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steel-100">
                    {contractorsUnder600.map(c => (
                      <tr key={c.id} className="text-steel-600">
                        <td className="p-3">{c.name}</td>
                        <td className="p-3 text-right font-mono">{fmt(c.totalPaid)}</td>
                        <td className="p-3 text-right font-mono">{fmt(600 - c.totalPaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.contractors.length === 0 && (
            <div className="bg-steel-50 border border-steel-200 rounded-lg p-8 text-center">
              <div className="text-steel-600 text-lg mb-2">No Contractors Found</div>
              <p className="text-steel-500 text-sm">Drivers marked as &quot;Contractor&quot; worker type will appear here for 1099 generation.</p>
            </div>
          )}

          {/* Payer info preview */}
          <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-steel-800 font-semibold text-sm mb-3">Payer Information (Your Company)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-steel-500">Company: </span>
                <span className="text-steel-800">{data.company.name || '—'}</span>
              </div>
              <div>
                <span className="text-steel-500">EIN: </span>
                <span className="text-steel-800">{data.company.ein || <span className="text-red-500">Not set — go to Settings</span>}</span>
              </div>
              <div>
                <span className="text-steel-500">Address: </span>
                <span className="text-steel-800">
                  {[data.company.address, data.company.city, data.company.state, data.company.zip].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
              <div>
                <span className="text-steel-500">Phone: </span>
                <span className="text-steel-800">{data.company.phone || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAX SUMMARY TAB                                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'summary' && (
        <div className="space-y-6">
          {/* Annual totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Gross Revenue</div>
              <div className="text-xl font-bold text-green-600 mt-1">{fmt(data.totalRevenue)}</div>
            </div>
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Total Expenses</div>
              <div className="text-xl font-bold text-red-600 mt-1">{fmt(data.totalExpenses)}</div>
            </div>
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Payroll</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{fmt(data.totalPayroll)}</div>
            </div>
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <div className="text-steel-500 text-xs uppercase tracking-wider">Net Profit</div>
              <div className={`text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(netProfit)}
              </div>
            </div>
          </div>

          {/* Quarterly breakdown */}
          <div className="bg-white border border-steel-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-steel-200 bg-steel-50">
              <h2 className="text-steel-800 font-semibold">Quarterly Breakdown — {data.selectedYear}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-steel-50 text-steel-500 text-xs uppercase tracking-wider border-b border-steel-200">
                    <th className="text-left p-3">Quarter</th>
                    <th className="text-right p-3">Revenue</th>
                    <th className="text-right p-3">Expenses</th>
                    <th className="text-right p-3">Payroll</th>
                    <th className="text-right p-3">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-100">
                  {[0, 1, 2, 3].map(q => {
                    const rev = data.quarterlyRevenue[q];
                    const exp = data.quarterlyExpenses[q];
                    const pay = data.quarterlyPayroll[q];
                    const net = rev - exp - pay;
                    return (
                      <tr key={q} className="hover:bg-steel-50">
                        <td className="p-3 text-steel-800 font-medium">Q{q + 1} ({['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q]})</td>
                        <td className="p-3 text-right font-mono text-green-600">{fmt(rev)}</td>
                        <td className="p-3 text-right font-mono text-red-600">{fmt(exp)}</td>
                        <td className="p-3 text-right font-mono text-blue-600">{fmt(pay)}</td>
                        <td className={`p-3 text-right font-mono font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-steel-50 font-semibold border-t border-steel-200">
                    <td className="p-3 text-steel-800">Annual Total</td>
                    <td className="p-3 text-right font-mono text-green-600">{fmt(data.totalRevenue)}</td>
                    <td className="p-3 text-right font-mono text-red-600">{fmt(data.totalExpenses)}</td>
                    <td className="p-3 text-right font-mono text-blue-600">{fmt(data.totalPayroll)}</td>
                    <td className={`p-3 text-right font-mono ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(netProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Estimated tax liability */}
          <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-steel-800 font-semibold mb-3">Estimated Tax Liability (Self-Employment)</h3>
            <p className="text-steel-500 text-xs mb-4">These are rough estimates only — consult your tax professional for accurate calculations.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-steel-50 border border-steel-200 rounded p-3">
                <div className="text-steel-500 text-xs">Self-Employment Tax (15.3%)</div>
                <div className="text-steel-800 font-bold mt-1">{fmt(Math.max(0, netProfit * 0.9235 * 0.153))}</div>
                <div className="text-steel-400 text-xs mt-1">On 92.35% of net profit</div>
              </div>
              <div className="bg-steel-50 border border-steel-200 rounded p-3">
                <div className="text-steel-500 text-xs">Est. Federal Income Tax (22%)</div>
                <div className="text-steel-800 font-bold mt-1">{fmt(Math.max(0, netProfit * 0.22))}</div>
                <div className="text-steel-400 text-xs mt-1">Marginal rate estimate</div>
              </div>
              <div className="bg-steel-50 border border-steel-200 rounded p-3">
                <div className="text-steel-500 text-xs">Quarterly Payment Estimate</div>
                <div className="text-diesel font-bold mt-1">{fmt(Math.max(0, (netProfit * 0.9235 * 0.153 + netProfit * 0.22) / 4))}</div>
                <div className="text-steel-400 text-xs mt-1">Due Apr 15, Jun 15, Sep 15, Jan 15</div>
              </div>
            </div>
          </div>

          {/* Workforce summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-steel-800 font-semibold mb-3">Contractor Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-steel-500">Total contractors</span>
                  <span className="text-steel-800">{data.contractors.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">Active contractors</span>
                  <span className="text-steel-800">{data.contractors.filter(c => c.active).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">1099s required</span>
                  <span className="text-diesel font-semibold">{contractorsOver600.length}</span>
                </div>
                <div className="flex justify-between border-t border-steel-200 pt-2">
                  <span className="text-steel-500">Total paid to contractors</span>
                  <span className="text-steel-800 font-mono">{fmt(data.contractors.reduce((s, c) => s + c.totalPaid, 0))}</span>
                </div>
              </div>
            </div>
            <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-steel-800 font-semibold mb-3">Employee Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-steel-500">Total employees</span>
                  <span className="text-steel-800">{data.employees.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">Active employees</span>
                  <span className="text-steel-800">{data.employees.filter(e => e.active).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">Hourly workers</span>
                  <span className="text-steel-800">{data.employees.filter(e => e.payType === 'HOURLY').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">Salary workers</span>
                  <span className="text-steel-800">{data.employees.filter(e => e.payType === 'SALARY').length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Outstanding invoices warning */}
          {data.unpaidInvoices > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 text-lg">⚠</span>
                <div>
                  <div className="text-yellow-700 font-medium text-sm">Outstanding Invoices</div>
                  <div className="text-yellow-600 text-xs mt-1">
                    You have {fmt(data.unpaidInvoices)} in unpaid invoices for {data.selectedYear}. This revenue is invoiced but not yet collected.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EXPENSE CATEGORIES TAB                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <div className="space-y-6">
          {/* IRS Schedule C mapping */}
          <div className="bg-white border border-steel-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-steel-200 bg-steel-50">
              <h2 className="text-steel-800 font-semibold">IRS Schedule C Category Mapping — {data.selectedYear}</h2>
              <p className="text-steel-500 text-xs mt-1">Your expenses mapped to IRS Schedule C line items for tax filing</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-steel-50 text-steel-500 text-xs uppercase tracking-wider border-b border-steel-200">
                    <th className="text-left p-3">Schedule C Line</th>
                    <th className="text-left p-3">IRS Description</th>
                    <th className="text-left p-3">Your Categories</th>
                    <th className="text-right p-3">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-100">
                  {irsCategoryRollup.map((row, i) => (
                    <tr key={i} className="hover:bg-steel-50">
                      <td className="p-3 text-diesel font-mono font-medium">{row.scheduleC}</td>
                      <td className="p-3 text-steel-800">{row.irsDesc}</td>
                      <td className="p-3 text-steel-600 text-xs">{row.categories.join(', ')}</td>
                      <td className="p-3 text-right font-mono text-steel-800 font-semibold">{fmt(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-steel-50 font-semibold border-t border-steel-200">
                    <td colSpan={3} className="p-3 text-steel-800">Total Deductible Expenses</td>
                    <td className="p-3 text-right font-mono text-diesel">{fmt(data.totalExpenses)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Category breakdown chart (simple bar) */}
          <div className="bg-white border border-steel-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-steel-800 font-semibold mb-4">Expense Breakdown by Category</h3>
            <div className="space-y-3">
              {Object.entries(data.expenseByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => {
                  const pct = data.totalExpenses > 0 ? (amount / data.totalExpenses) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-steel-600">{CATEGORY_LABELS[cat] || cat}</span>
                        <span className="text-steel-800 font-mono">{fmt(amount)} <span className="text-steel-400">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="h-2 bg-steel-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-diesel rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Expense detail table with filters */}
          <div className="bg-white border border-steel-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-steel-200 bg-steel-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-steel-800 font-semibold">Expense Detail ({filteredExpenses.length} records)</h2>
              <div className="flex gap-2">
                <select
                  value={expenseCategoryFilter}
                  onChange={e => setExpenseCategoryFilter(e.target.value)}
                  className="bg-white text-steel-800 border border-steel-300 rounded px-2 py-1 text-xs"
                >
                  <option value="ALL">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select
                  value={expenseTruckFilter}
                  onChange={e => setExpenseTruckFilter(e.target.value)}
                  className="bg-white text-steel-800 border border-steel-300 rounded px-2 py-1 text-xs"
                >
                  <option value="ALL">All Trucks</option>
                  {data.trucks.map(t => (
                    <option key={t.id} value={t.id}>{t.truckNumber}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-steel-50 text-steel-500 text-xs uppercase tracking-wider border-b border-steel-200">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">IRS Line</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3">Vendor</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel-100">
                  {filteredExpenses.slice(0, 200).map(exp => {
                    const irs = IRS_CATEGORY_MAP[exp.category] || IRS_CATEGORY_MAP.OTHER;
                    const truckNum = exp.truckId ? data.trucks.find(t => t.id === exp.truckId)?.truckNumber : null;
                    return (
                      <tr key={exp.id} className="hover:bg-steel-50">
                        <td className="p-3 text-steel-600 whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="p-3">
                          <span className="text-xs bg-steel-100 text-steel-700 rounded px-2 py-0.5">
                            {CATEGORY_LABELS[exp.category] || exp.category}
                          </span>
                        </td>
                        <td className="p-3 text-diesel text-xs font-mono">{irs.scheduleC}</td>
                        <td className="p-3 text-steel-600 text-xs max-w-[200px] truncate">
                          {exp.description || '—'}
                          {truckNum && <span className="text-steel-400 ml-1">({truckNum})</span>}
                        </td>
                        <td className="p-3 text-steel-600 text-xs">{exp.vendor || '—'}</td>
                        <td className="p-3 text-right font-mono text-steel-800">{fmt(exp.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredExpenses.length > 200 && (
                <div className="p-3 text-center text-steel-400 text-xs">
                  Showing first 200 of {filteredExpenses.length} records
                </div>
              )}
              {filteredExpenses.length === 0 && (
                <div className="p-8 text-center text-steel-500">No expenses match the selected filters.</div>
              )}
            </div>
          </div>

          {/* Tax deduction tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-blue-700 font-semibold text-sm mb-2">Tax Deduction Reminders</h3>
            <div className="text-blue-600 text-xs space-y-1">
              <p>• Keep receipts for all expenses over $75 — the IRS may request documentation during an audit.</p>
              <p>• Vehicle expenses can be deducted using actual costs or the standard mileage rate (check current IRS rate).</p>
              <p>• Insurance premiums, permits, and registration fees are fully deductible business expenses.</p>
              <p>• Consult a qualified tax professional for advice specific to your situation.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
