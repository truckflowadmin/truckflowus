'use client';

import { useState } from 'react';

interface DailyDataPoint {
  date: string;
  tickets: number;
  loads: number;
  revenue: number;
}

interface DriverTimeEntry {
  name: string;
  truck: string;
  hours: number;
}

interface Props {
  dailyData: DailyDataPoint[];
  statusCounts: { status: string; count: number }[];
  customerData: { name: string; revenue: number }[];
  driverData: { name: string; truck: string; loads: number }[];
  driverTimeData: DriverTimeEntry[];
  payrollBreakdown: { employees: number; contractors: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#cfd4da',
  DISPATCHED: '#93c5fd',
  IN_PROGRESS: '#FFB500',
  COMPLETED: '#86efac',
  CANCELLED: '#a9b1ba',
  ISSUE: '#fca5a5',
};

export function ReportsCharts({ dailyData, statusCounts, customerData, driverData, driverTimeData, payrollBreakdown }: Props) {
  const [metric, setMetric] = useState<'tickets' | 'loads' | 'revenue'>('loads');

  const maxVal = Math.max(1, ...dailyData.map((d) => d[metric]));
  const totalStatus = statusCounts.reduce((s, c) => s + c.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Daily bar chart */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Daily Activity</h2>
          <div className="flex gap-1">
            {(['tickets', 'loads', 'revenue'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                  metric === m ? 'bg-diesel text-white border-diesel' : 'border-steel-300 hover:bg-steel-50'
                }`}
              >
                {m === 'revenue' ? 'Revenue $' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-px" style={{ minWidth: Math.max(dailyData.length * 18, 300), height: 180 }}>
            {dailyData.map((d, i) => {
              const pct = maxVal > 0 ? (d[metric] / maxVal) * 100 : 0;
              const val = metric === 'revenue' ? `$${d[metric].toFixed(0)}` : String(d[metric]);
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ minWidth: 14 }}>
                  <div
                    className="w-full rounded-t bg-safety hover:bg-safety-dark transition-colors cursor-default"
                    style={{ height: `${Math.max(pct, 1)}%` }}
                    title={`${d.date}: ${val}`}
                  />
                  {/* tooltip */}
                  <div className="hidden group-hover:block absolute bottom-full mb-1 bg-diesel text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                    {d.date}: {val}
                  </div>
                </div>
              );
            })}
          </div>
          {dailyData.length <= 31 && (
            <div className="flex gap-px mt-1" style={{ minWidth: Math.max(dailyData.length * 18, 300) }}>
              {dailyData.map((d, i) => (
                <div key={i} className="flex-1 text-[8px] text-steel-400 text-center truncate" style={{ minWidth: 14 }}>
                  {i % Math.ceil(dailyData.length / 10) === 0 ? d.date.split(' ').slice(-1)[0] : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status breakdown */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Tickets by Status</h2>
          <div className="space-y-2">
            {statusCounts
              .sort((a, b) => b.count - a.count)
              .map((s) => {
                const pct = (s.count / totalStatus) * 100;
                return (
                  <div key={s.status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-steel-700">{s.status.replace('_', ' ')}</span>
                      <span className="tabular-nums text-steel-500">{s.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-steel-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] ?? '#cfd4da' }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Customer revenue */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Revenue by Customer</h2>
          {customerData.length === 0 ? (
            <p className="text-sm text-steel-500">No completed tickets with rates.</p>
          ) : (
            <div className="space-y-2">
              {customerData.map((c, i) => {
                const maxCust = customerData[0]?.revenue || 1;
                const pct = (c.revenue / maxCust) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-steel-700 truncate mr-2">{c.name}</span>
                      <span className="tabular-nums text-steel-500 whitespace-nowrap">${c.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="h-2 bg-steel-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-safety transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Driver leaderboard */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Driver Leaderboard</h2>
          {driverData.length === 0 ? (
            <p className="text-sm text-steel-500">No completed tickets.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-steel-500">
                <tr>
                  <th className="text-left pb-2">Driver</th>
                  <th className="text-right pb-2">Loads</th>
                </tr>
              </thead>
              <tbody>
                {driverData.map((d, i) => (
                  <tr key={i} className="border-t border-steel-100">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-safety text-diesel' : 'bg-steel-200 text-steel-600'
                        }`}>
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">{d.name}</div>
                          {d.truck && <div className="text-[10px] text-steel-500">{d.truck}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{d.loads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Driver Hours */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Driver Hours Worked</h2>
          {driverTimeData.length === 0 ? (
            <p className="text-sm text-steel-500">No tracked hours in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-steel-500">
                <tr>
                  <th className="text-left pb-2">Driver</th>
                  <th className="text-right pb-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {driverTimeData.map((d, i) => (
                  <tr key={i} className="border-t border-steel-100">
                    <td className="py-2">
                      <div className="font-medium">{d.name}</div>
                      {d.truck && <div className="text-[10px] text-steel-500">{d.truck}</div>}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{d.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payroll Breakdown */}
        <div className="panel p-5">
          <h2 className="font-semibold mb-4">Workforce Breakdown</h2>
          <div className="flex items-center gap-8 mt-6">
            <div className="flex-1">
              <div className="flex items-end gap-4 justify-center">
                <div className="text-center">
                  <div className="w-20 bg-blue-100 rounded-t mx-auto" style={{ height: Math.max(20, (payrollBreakdown.employees / Math.max(1, payrollBreakdown.employees + payrollBreakdown.contractors)) * 120) }} />
                  <div className="text-2xl font-bold mt-2">{payrollBreakdown.employees}</div>
                  <div className="text-xs text-steel-500">Employees</div>
                </div>
                <div className="text-center">
                  <div className="w-20 bg-amber-100 rounded-t mx-auto" style={{ height: Math.max(20, (payrollBreakdown.contractors / Math.max(1, payrollBreakdown.employees + payrollBreakdown.contractors)) * 120) }} />
                  <div className="text-2xl font-bold mt-2">{payrollBreakdown.contractors}</div>
                  <div className="text-xs text-steel-500">Contractors</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
