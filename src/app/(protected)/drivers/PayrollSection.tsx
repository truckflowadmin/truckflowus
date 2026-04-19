'use client';

import { useState, Fragment } from 'react';
import PayrollDetail from './PayrollDetail';

interface DriverPayroll {
  id: string;
  name: string;
  phone: string;
  truckNumber: string | null;
  active: boolean;
  workerType: 'EMPLOYEE' | 'CONTRACTOR';
  payType: 'HOURLY' | 'SALARY' | 'PERCENTAGE';
  payRate: string | null;
}

interface Props {
  drivers: DriverPayroll[];
}

const PAY_TYPE_LABELS: Record<string, string> = {
  HOURLY: 'Hourly',
  SALARY: 'Salary',
  PERCENTAGE: 'Percentage',
};

function formatRate(payType: string, payRate: string | null): string {
  if (!payRate) return '—';
  const num = parseFloat(payRate);
  if (payType === 'PERCENTAGE') return `${num}%`;
  return `$${num.toFixed(2)}${payType === 'HOURLY' ? '/hr' : ''}`;
}

export default function PayrollSection({ drivers }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'EMPLOYEE' | 'CONTRACTOR'>('ALL');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const filtered = filter === 'ALL'
    ? drivers
    : drivers.filter((d) => d.workerType === filter);

  const employeeCount = drivers.filter((d) => d.workerType === 'EMPLOYEE').length;
  const contractorCount = drivers.filter((d) => d.workerType === 'CONTRACTOR').length;

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return (
    <div className="max-w-6xl">
      {/* Toggle switch */}
      <div className="flex items-center gap-1 mb-5 bg-steel-100 rounded-lg p-1 w-fit">
        {[
          { key: 'ALL' as const, label: `All (${drivers.length})` },
          { key: 'EMPLOYEE' as const, label: `Employees (${employeeCount})` },
          { key: 'CONTRACTOR' as const, label: `Contractors (${contractorCount})` },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === opt.key
                ? 'bg-white text-steel-900 shadow-sm'
                : 'text-steel-500 hover:text-steel-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-steel-500">
            {filter === 'ALL' ? 'No drivers yet.' : `No ${filter.toLowerCase()}s found.`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-5 py-2">Name</th>
                <th className="text-left px-5 py-2">Truck</th>
                <th className="text-left px-5 py-2">Worker Type</th>
                <th className="text-left px-5 py-2">Pay Type</th>
                <th className="text-right px-5 py-2">Pay Rate</th>
                <th className="text-left px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <Fragment key={d.id}>
                  <tr
                    onClick={() => setSelectedDriverId(selectedDriverId === d.id ? null : d.id)}
                    className={`border-b border-steel-100 cursor-pointer transition-colors ${
                      selectedDriverId === d.id
                        ? 'bg-safety/5'
                        : 'hover:bg-steel-50'
                    }`}
                  >
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-3 h-3 text-steel-400 transition-transform ${
                            selectedDriverId === d.id ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        {d.name}
                      </div>
                    </td>
                    <td className="px-5 py-3">{d.truckNumber ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        d.workerType === 'EMPLOYEE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {d.workerType === 'EMPLOYEE' ? 'Employee' : 'Contractor'}
                      </span>
                    </td>
                    <td className="px-5 py-3">{PAY_TYPE_LABELS[d.payType] ?? d.payType}</td>
                    <td className="px-5 py-3 text-right font-mono">
                      {formatRate(d.payType, d.payRate)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${d.active ? 'bg-green-100 text-green-800' : 'bg-steel-200 text-steel-600'}`}>
                        {d.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                  {selectedDriverId === d.id && (
                    <tr key={`${d.id}-detail`}>
                      <td colSpan={6} className="p-0">
                        <PayrollDetail
                          driverId={d.id}
                          driverName={d.name}
                          workerType={d.workerType}
                          payType={d.payType}
                          payRate={d.payRate}
                          onClose={() => setSelectedDriverId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
