'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fmtQty, qtyUnit } from '@/lib/format';

type TicketRow = {
  id: string;
  ticketNumber: number;
  date: Date | null;
  createdAt: Date;
  material: string | null;
  quantity: any;
  quantityType: string | null;
  ratePerUnit: any;
  status: string;
  customer: { name: string } | null;
};

type JobRow = {
  id: string;
  jobNumber: number;
  date: Date | null;
  createdAt: Date;
  name: string;
  material: string | null;
  hauledFrom: string | null;
  hauledTo: string | null;
  completedLoads: number;
  totalLoads: number;
  status: string;
  customer: { name: string } | null;
  assignments: { driver: { firstName: string | null; lastName: string | null } | null }[];
};

export default function BrokerHistory({
  tickets,
  jobs,
  commissionPct,
}: {
  tickets: TicketRow[];
  jobs: JobRow[];
  commissionPct: number;
}) {
  const [tab, setTab] = useState<'jobs' | 'tickets'>('jobs');

  return (
    <div className="panel overflow-hidden">
      {/* Toggle header */}
      <div className="px-5 py-3 border-b border-steel-200 bg-steel-50 flex items-center gap-1">
        <button
          onClick={() => setTab('jobs')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            tab === 'jobs'
              ? 'bg-white text-steel-900 shadow-sm'
              : 'text-steel-500 hover:text-steel-700'
          }`}
        >
          Job History
          <span className="ml-1.5 text-xs font-normal text-steel-400">({jobs.length})</span>
        </button>
        <button
          onClick={() => setTab('tickets')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            tab === 'tickets'
              ? 'bg-white text-steel-900 shadow-sm'
              : 'text-steel-500 hover:text-steel-700'
          }`}
        >
          Ticket History
          <span className="ml-1.5 text-xs font-normal text-steel-400">({tickets.length})</span>
        </button>
      </div>

      {/* Job History Table */}
      {tab === 'jobs' && (
        <>
          {jobs.length === 0 ? (
            <div className="p-10 text-center text-steel-500">No jobs linked to this broker yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                  <tr>
                    <th className="text-left px-5 py-2">Job #</th>
                    <th className="text-left px-5 py-2">Date</th>
                    <th className="text-left px-5 py-2">Name</th>
                    <th className="text-left px-5 py-2">Customer</th>
                    <th className="text-left px-5 py-2 hidden lg:table-cell">From → To</th>
                    <th className="text-left px-5 py-2 hidden md:table-cell">Driver(s)</th>
                    <th className="text-left px-5 py-2 hidden md:table-cell">Material</th>
                    <th className="text-right px-5 py-2">Loads</th>
                    <th className="text-left px-5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => {
                    const drivers = (j.assignments || [])
                      .map((a) => a.driver?.firstName || a.driver?.lastName || '—')
                      .join(', ');
                    return (
                      <tr key={j.id} className="border-b border-steel-100 hover:bg-steel-50">
                        <td className="px-5 py-3 font-mono">
                          <Link href={`/jobs/${j.id}`} className="hover:text-safety-dark">
                            #{String(j.jobNumber).padStart(4, '0')}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-steel-600">
                          {j.date ? format(new Date(j.date), 'MMM d, yyyy') : format(new Date(j.createdAt), 'MMM d')}
                        </td>
                        <td className="px-5 py-3 max-w-[160px] truncate">{j.name}</td>
                        <td className="px-5 py-3">{j.customer?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-steel-600 max-w-[200px] truncate hidden lg:table-cell">
                          {j.hauledFrom} → {j.hauledTo}
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">{drivers || '—'}</td>
                        <td className="px-5 py-3 hidden md:table-cell">{j.material ?? '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {j.completedLoads}/{j.totalLoads}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`badge ${
                            j.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            j.status === 'IN_PROGRESS' ? 'bg-safety text-diesel' :
                            j.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                            j.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            'bg-steel-200 text-steel-700'
                          }`}>
                            {j.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Ticket History Table */}
      {tab === 'tickets' && (
        <>
          {tickets.length === 0 ? (
            <div className="p-10 text-center text-steel-500">No tickets linked to this broker yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                  <tr>
                    <th className="text-left px-5 py-2">#</th>
                    <th className="text-left px-5 py-2">Date</th>
                    <th className="text-left px-5 py-2">Customer</th>
                    <th className="text-left px-5 py-2 hidden md:table-cell">Material</th>
                    <th className="text-right px-5 py-2">Qty</th>
                    <th className="text-right px-5 py-2 hidden sm:table-cell">Revenue</th>
                    <th className="text-right px-5 py-2 hidden sm:table-cell">Commission</th>
                    <th className="text-left px-5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
                    const qty = Number(t.quantity);
                    const lineTotal = rate * qty;
                    const lineComm = lineTotal * (commissionPct / 100);
                    return (
                      <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                        <td className="px-5 py-3 font-mono">
                          <Link href={`/tickets/${t.id}`} className="hover:text-safety-dark">
                            #{String(t.ticketNumber).padStart(4, '0')}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-steel-600">
                          {t.date ? format(new Date(t.date), 'MMM d, yyyy') : format(new Date(t.createdAt), 'MMM d')}
                        </td>
                        <td className="px-5 py-3">{t.customer?.name ?? '—'}</td>
                        <td className="px-5 py-3 hidden md:table-cell">{t.material ?? '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{fmtQty(t.quantity, t.quantityType ?? 'LOADS')} {qtyUnit(t.quantityType ?? 'LOADS')}</td>
                        <td className="px-5 py-3 text-right tabular-nums hidden sm:table-cell">${lineTotal.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-red-700 hidden sm:table-cell">${lineComm.toFixed(2)}</td>
                        <td className="px-5 py-3">
                          <span className={`badge ${
                            t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            t.status === 'IN_PROGRESS' ? 'bg-safety text-diesel' :
                            'bg-steel-200 text-steel-700'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
