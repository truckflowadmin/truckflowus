'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { bulkUpdateTripSheetStatusAction } from './actions';

interface SheetRow {
  id: string;
  weekEnding: string;
  status: string;
  ticketCount: number;
  totalDue: string;
  createdAt: string;
}

interface Props {
  brokerId: string;
  brokerName: string;
  sheets: SheetRow[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-steel-200 text-steel-700',
  SENT: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
};

const STATUS_OPTIONS = ['DRAFT', 'SENT', 'PAID'] as const;

export function TripSheetList({ brokerId, brokerName, sheets }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = filterStatus ? sheets.filter((s) => s.status === filterStatus) : sheets;
  const allIds = filtered.map((s) => s.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleSheet(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function handleBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    setError('');
    startTransition(async () => {
      try {
        const fd = new FormData();
        for (const id of selected) fd.append('sheetIds', id);
        fd.set('status', bulkStatus);
        await bulkUpdateTripSheetStatusAction(fd);
        setSelected(new Set());
        setBulkStatus('');
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Filter + bulk actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setSelected(new Set()); }}
          className="input text-sm py-1.5 w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-steel-600 font-medium">
              {selectedCount} selected
            </span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            >
              <option value="">Change status to...</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={handleBulkStatus}
              disabled={!bulkStatus || isPending}
              className="btn-accent text-sm"
            >
              {isPending ? 'Updating\u2026' : 'Apply'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">{'\u2715'}</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">
          {sheets.length === 0
            ? 'No trip sheets yet. Create one to start tracking weekly hauls for this broker.'
            : 'No trip sheets match the current filter.'}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
              <tr>
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-steel-300 text-safety focus:ring-safety"
                  />
                </th>
                <th className="text-left px-5 py-2">Week Ending</th>
                <th className="text-left px-5 py-2">Status</th>
                <th className="text-right px-5 py-2">Tickets</th>
                <th className="text-right px-5 py-2">Total Due</th>
                <th className="text-left px-5 py-2">Created</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className={`border-b border-steel-100 hover:bg-steel-50 ${selected.has(s.id) ? 'bg-safety/5' : ''}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSheet(s.id)}
                      className="w-4 h-4 rounded border-steel-300 text-safety focus:ring-safety"
                    />
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    {format(new Date(s.weekEnding), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge text-xs ${STATUS_COLORS[s.status] ?? ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.ticketCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">${s.totalDue}</td>
                  <td className="px-5 py-3 text-steel-500">
                    {format(new Date(s.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/brokers/${brokerId}/trip-sheets/${s.id}`}
                      className="text-sm text-safety-dark hover:underline"
                    >
                      View {'\u2192'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
