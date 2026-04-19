'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { AddTicketsForm } from './[sheetId]/AddTicketsForm';

/* ── Types ───────────────────────────────────────────────────── */

interface TicketRow {
  id: string;
  ticketNumber: number;
  ticketRef: string | null;
  date: string | null;
  completedAt: string | null;
  customerName: string | null;
  hauledFrom: string;
  hauledTo: string;
  quantity: number;
  quantityType: string;
  ratePerUnit: number;
  truckNumber: string;
  driverName: string;
}

interface AvailableTicket {
  id: string;
  ticketNumber: number;
  ticketRef: string | null;
  date: string | null;
  customer: string | null;
  driver: string | null;
  hauledFrom: string;
  hauledTo: string;
  quantity: number;
  quantityType: string;
  ratePerUnit: string | null;
}

interface SheetData {
  id: string;
  weekEnding: string;
  status: string;
  ticketCount: number;
  totalDue: string;
  createdAt: string;
  tickets: TicketRow[];
}

interface Props {
  brokerId: string;
  brokerName: string;
  brokerEmail: string | null;
  companyName: string;
  sheets: SheetData[];
  availableTickets: AvailableTicket[];
  removeAction: (formData: FormData) => Promise<void>;
  updateStatusAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  bulkUpdateStatusAction: (formData: FormData) => Promise<void>;
}

/** A single row in the list — one driver (or truck) slice of one sheet */
interface Entry {
  key: string;           // unique row key
  sheetId: string;
  weekEnding: string;
  status: string;
  driverName: string;
  truckNumbers: string[];  // all trucks for this entry
  tickets: TicketRow[];
  total: number;
}

type DatePreset = 'week' | 'month' | 'year' | 'custom' | 'all';

/* ── Constants ───────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-steel-200 text-steel-700',
  SENT: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
};
const STATUS_OPTIONS = ['DRAFT', 'SENT', 'PAID'] as const;

/* ── Helpers ─────────────────────────────────────────────────── */

function formatTicketDate(dateStr: string | null, fallback: string | null): string {
  if (!dateStr && !fallback) return '\u2014';
  const d = new Date(dateStr || fallback!);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Component ───────────────────────────────────────────────── */

export function TripSheetsPage({
  brokerId,
  brokerName,
  brokerEmail,
  companyName,
  sheets,
  availableTickets,
  removeAction,
  updateStatusAction,
  deleteAction,
  bulkUpdateStatusAction,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [filterTruck, setFilterTruck] = useState('');

  // Date range filter
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  /* ── Extract unique drivers and trucks for filter dropdowns ── */

  const { allDrivers, allTrucks } = useMemo(() => {
    const drivers = new Set<string>();
    const trucks = new Set<string>();
    for (const sheet of sheets) {
      for (const t of sheet.tickets) {
        if (t.driverName) drivers.add(t.driverName);
        if (t.truckNumber) trucks.add(t.truckNumber);
      }
    }
    return {
      allDrivers: Array.from(drivers).sort(),
      allTrucks: Array.from(trucks).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    };
  }, [sheets]);

  // Email state — supports single or bulk (multiple entries)
  const [emailTargets, setEmailTargets] = useState<{ sheetId: string; trucks: string[] }[]>([]);
  const [emailTo, setEmailTo] = useState(brokerEmail ?? '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  /* ── Compute date range from preset ────────────────────────── */

  const dateRange = useMemo<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    switch (datePreset) {
      case 'week':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'custom': {
        const f = customFrom ? new Date(customFrom + 'T00:00:00') : null;
        const t = customTo ? new Date(customTo + 'T23:59:59.999') : null;
        return { from: f, to: t };
      }
      default:
        return { from: null, to: null };
    }
  }, [datePreset, customFrom, customTo]);

  /* ── Build entries: one row per driver per sheet, filtered ──── */

  const entries: Entry[] = useMemo(() => {
    const result: Entry[] = [];

    for (const sheet of sheets) {
      // Status filter
      if (filterStatus && sheet.status !== filterStatus) continue;

      // Date range filter on weekEnding
      if (dateRange.from || dateRange.to) {
        const we = new Date(sheet.weekEnding);
        if (dateRange.from && we < dateRange.from) continue;
        if (dateRange.to && we > dateRange.to) continue;
      }

      // Group tickets by driver
      const byDriver = new Map<string, TicketRow[]>();
      for (const t of sheet.tickets) {
        // Truck filter: skip tickets that don't match
        if (filterTruck && t.truckNumber !== filterTruck) continue;

        const key = t.driverName || '(Unassigned)';
        if (!byDriver.has(key)) byDriver.set(key, []);
        byDriver.get(key)!.push(t);
      }

      for (const [driverName, tickets] of byDriver) {
        // Driver filter: skip drivers that don't match
        if (filterDriver && driverName !== filterDriver) continue;

        const truckSet = new Set<string>();
        let total = 0;
        for (const t of tickets) {
          if (t.truckNumber) truckSet.add(t.truckNumber);
          total += t.ratePerUnit * t.quantity;
        }
        result.push({
          key: `${sheet.id}::${driverName}`,
          sheetId: sheet.id,
          weekEnding: sheet.weekEnding,
          status: sheet.status,
          driverName,
          truckNumbers: Array.from(truckSet).sort(),
          tickets,
          total,
        });
      }

      // If a sheet has zero tickets (and no filters active), still show a row
      if (sheet.tickets.length === 0 && !filterDriver && !filterTruck) {
        result.push({
          key: `${sheet.id}::__empty__`,
          sheetId: sheet.id,
          weekEnding: sheet.weekEnding,
          status: sheet.status,
          driverName: '\u2014',
          truckNumbers: [],
          tickets: [],
          total: 0,
        });
      }
    }

    return result;
  }, [sheets, filterStatus, filterDriver, filterTruck, dateRange]);

  /* ── Sort entries (by week desc, then driver) ──────────────── */

  const sorted = useMemo(() => {
    const arr = [...entries];
    arr.sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime() || a.driverName.localeCompare(b.driverName));
    return arr;
  }, [entries]);

  /* ── Selection (by entry key, resolved to sheet IDs for bulk) ── */

  const allEntryKeys = useMemo(() => sorted.map((e) => e.key), [sorted]);
  const allSelected = allEntryKeys.length > 0 && allEntryKeys.every((k) => selected.has(k));

  function toggleEntry(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allEntryKeys));
  }

  /** Resolve selected entry keys to unique sheet IDs for bulk actions */
  function selectedSheetIds(): string[] {
    const ids = new Set<string>();
    for (const entry of sorted) {
      if (selected.has(entry.key)) ids.add(entry.sheetId);
    }
    return [...ids];
  }

  function handleBulkStatus() {
    const sheetIds = selectedSheetIds();
    if (!bulkStatus || sheetIds.length === 0) return;
    setError('');
    startTransition(async () => {
      try {
        const fd = new FormData();
        for (const id of sheetIds) fd.append('sheetIds', id);
        fd.set('status', bulkStatus);
        await bulkUpdateStatusAction(fd);
        setSelected(new Set());
        setBulkStatus('');
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  /* ── Status change per sheet ──────────────────────────────── */

  function handleStatusChange(sheetId: string, newStatus: string, currentStatus: string) {
    if (!newStatus || newStatus === currentStatus) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('sheetId', sheetId);
      fd.set('status', newStatus);
      await updateStatusAction(fd);
    });
  }

  /* ── PDF / Email ──────────────────────────────────────────── */

  function handleViewPdf(sheetId: string, truckNumbers: string[]) {
    if (truckNumbers.length === 0) {
      window.open(`/api/brokers/${brokerId}/trip-sheets/${sheetId}/pdf`, '_blank');
    } else {
      window.open(`/api/brokers/${brokerId}/trip-sheets/${sheetId}/truck-pdf?trucks=${encodeURIComponent(truckNumbers.join(','))}`, '_blank');
    }
  }

  function handleEmailOpen(sheetId: string, truckNumbers: string[]) {
    setEmailTargets([{ sheetId, trucks: truckNumbers }]);
    setEmailTo(brokerEmail ?? '');
    setEmailSent(null);
  }

  /** Collect selected entries as { sheetId, trucks }[] for bulk API calls */
  function selectedEntries(): { sheetId: string; trucks: string[] }[] {
    const targets: { sheetId: string; trucks: string[] }[] = [];
    for (const entry of sorted) {
      if (!selected.has(entry.key)) continue;
      targets.push({ sheetId: entry.sheetId, trucks: entry.truckNumbers });
    }
    return targets;
  }

  /** Open email form for all selected entries */
  function handleBulkEmail() {
    const targets = selectedEntries();
    if (targets.length === 0) return;
    setEmailTargets(targets);
    setEmailTo(brokerEmail ?? '');
    setEmailSent(null);
  }

  /** Open a single combined PDF for all selected entries */
  async function handleBulkViewPdf() {
    const targets = selectedEntries();
    if (targets.length === 0) return;

    // Single entry — use existing per-sheet route (no popup blocker issue)
    if (targets.length === 1) {
      handleViewPdf(targets[0].sheetId, targets[0].trucks);
      return;
    }

    // Multiple entries — POST to bulk-pdf, get blob, open in new tab
    setError('');
    try {
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheets/bulk-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: targets }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to generate PDF' }));
        throw new Error(data.error || 'Failed to generate PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleEmailSend() {
    if (emailTargets.length === 0 || !emailTo.trim()) return;
    setEmailSending(true);
    setError('');
    setEmailSent(null);
    try {
      // Single entry — use existing per-sheet route
      if (emailTargets.length === 1) {
        const target = emailTargets[0];
        let res: Response;
        if (target.trucks.length === 0) {
          res = await fetch(`/api/brokers/${brokerId}/trip-sheets/${target.sheetId}/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: emailTo.trim() }),
          });
        } else {
          res = await fetch(`/api/brokers/${brokerId}/trip-sheets/${target.sheetId}/truck-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: emailTo.trim(), trucks: target.trucks }),
          });
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Failed to send' }));
          throw new Error(data.error || 'Failed to send');
        }
      } else {
        // Multiple entries — use bulk-email route (one combined PDF, one email)
        const res = await fetch(`/api/brokers/${brokerId}/trip-sheets/bulk-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: emailTo.trim(), entries: emailTargets }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Failed to send' }));
          throw new Error(data.error || 'Failed to send');
        }
      }
      setEmailSent(emailTo);
      setEmailTargets([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Controls — row 1: sort + status + bulk */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Driver filter */}
        <select
          value={filterDriver}
          onChange={(e) => { setFilterDriver(e.target.value); setSelected(new Set()); setExpandedKey(null); }}
          className="input text-sm py-1.5 w-auto"
        >
          <option value="">All Drivers</option>
          {allDrivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Truck filter */}
        <select
          value={filterTruck}
          onChange={(e) => { setFilterTruck(e.target.value); setSelected(new Set()); setExpandedKey(null); }}
          className="input text-sm py-1.5 w-auto"
        >
          <option value="">All Trucks</option>
          {allTrucks.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setSelected(new Set()); setExpandedKey(null); }}
          className="input text-sm py-1.5 w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Bulk actions */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-steel-600 font-medium">
              {selectedCount} selected
            </span>
            <button
              onClick={handleBulkViewPdf}
              className="btn-ghost text-sm inline-flex items-center gap-1"
            >
              View / Print
            </button>
            <button
              onClick={handleBulkEmail}
              className="btn-ghost text-sm inline-flex items-center gap-1"
            >
              Email
            </button>
            <span className="text-steel-200">|</span>
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

      {/* Controls — row 2: date range filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-steel-500 font-medium">Period:</span>
        <div className="flex items-center bg-steel-100 rounded-lg p-0.5 text-sm">
          {([
            ['all', 'All'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['year', 'This Year'],
            ['custom', 'Custom'],
          ] as [DatePreset, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setDatePreset(key); setExpandedKey(null); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                datePreset === key
                  ? 'bg-white text-steel-900 font-medium shadow-sm'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setExpandedKey(null); }}
              className="input text-sm py-1.5 w-auto"
            />
            <span className="text-steel-400 text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setExpandedKey(null); }}
              className="input text-sm py-1.5 w-auto"
            />
          </div>
        )}

        {datePreset !== 'all' && datePreset !== 'custom' && dateRange.from && dateRange.to && (
          <span className="text-xs text-steel-400">
            {format(dateRange.from, 'MMM d')} – {format(dateRange.to, 'MMM d, yyyy')}
          </span>
        )}

        {/* Result count */}
        <span className="text-xs text-steel-400 ml-auto">
          {sorted.length} result{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">{'\u2715'}</button>
        </div>
      )}

      {emailSent && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          Trip sheet sent to {emailSent}!
          <button onClick={() => setEmailSent(null)} className="ml-2 text-green-500 hover:text-green-700">{'\u2715'}</button>
        </div>
      )}

      {/* Email form (inline) */}
      {emailTargets.length > 0 && (
        <div className="panel p-4 border-2 border-safety bg-safety/5">
          <h3 className="text-sm font-semibold mb-2">
            Email {emailTargets.length === 1
              ? `Trip Sheet${emailTargets[0].trucks.length > 0 ? ` — ${emailTargets[0].trucks.join(', ')}` : ''}`
              : `${emailTargets.length} Trip Sheets`}
          </h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label text-xs">Email to</label>
              <input
                type="email"
                className="input"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="broker@example.com"
              />
            </div>
            <button onClick={handleEmailSend} disabled={emailSending || !emailTo.trim()} className="btn-accent">
              {emailSending ? 'Sending\u2026' : 'Send'}
            </button>
            <button onClick={() => setEmailTargets([])} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">
          {sheets.length === 0
            ? 'No trip sheets yet. Create one to start tracking weekly hauls for this broker.'
            : 'No trip sheets match the current filter.'}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((entry) => {
            const isExpanded = expandedKey === entry.key;
            const isDraft = entry.status === 'DRAFT';
            const truckLabel = entry.truckNumbers.length === 0
              ? '\u2014'
              : entry.truckNumbers.length <= 2
                ? entry.truckNumbers.join(', ')
                : `${entry.truckNumbers[0]} +${entry.truckNumbers.length - 1}`;

            return (
              <div key={entry.key} className={`panel overflow-hidden ${isExpanded ? 'ring-2 ring-safety/50' : ''}`}>
                {/* Summary row */}
                <div
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-steel-50 transition-colors ${isExpanded ? 'bg-steel-50 border-b border-steel-200' : ''}`}
                  onClick={() => setExpandedKey(isExpanded ? null : entry.key)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.key)}
                    onChange={() => toggleEntry(entry.key)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-steel-300 text-safety focus:ring-safety flex-shrink-0"
                  />

                  <div className="flex-1 grid grid-cols-[120px_1fr_auto_auto_auto_auto] items-center gap-3 min-w-0">
                    {/* Week */}
                    <span className="font-semibold text-sm">
                      {format(new Date(entry.weekEnding), 'MMM d, yyyy')}
                    </span>

                    {/* Driver + Truck */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <span className="text-xs text-steel-400 uppercase tracking-wider">Driver </span>
                        <span className="font-medium text-sm truncate">{entry.driverName}</span>
                      </div>
                      <span className="text-steel-200">|</span>
                      <div className="min-w-0">
                        <span className="text-xs text-steel-400 uppercase tracking-wider">Truck </span>
                        <span className="font-medium text-sm">{truckLabel}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <span className={`badge text-xs ${STATUS_COLORS[entry.status] ?? ''}`}>
                      {entry.status}
                    </span>

                    {/* Count */}
                    <span className="text-sm text-steel-500 tabular-nums">
                      {entry.tickets.length} tkt{entry.tickets.length !== 1 ? 's' : ''}
                    </span>

                    {/* Total */}
                    <span className="font-semibold tabular-nums text-sm">${entry.total.toFixed(2)}</span>
                  </div>

                  <span className="text-steel-400 text-sm flex-shrink-0">
                    {isExpanded ? '\u25BC' : '\u25B6'}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="p-5 space-y-4">
                    {/* Actions bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => handleViewPdf(entry.sheetId, entry.truckNumbers)}
                        className="btn-ghost text-sm inline-flex items-center gap-1"
                      >
                        View / Print
                      </button>
                      <button
                        onClick={() => handleEmailOpen(entry.sheetId, entry.truckNumbers)}
                        disabled={entry.tickets.length === 0}
                        className="btn-ghost text-sm inline-flex items-center gap-1"
                      >
                        Email
                      </button>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-steel-500">Status:</label>
                        <select
                          value={entry.status}
                          onChange={(e) => handleStatusChange(entry.sheetId, e.target.value, entry.status)}
                          disabled={isPending}
                          className="input text-sm py-1.5 px-3 w-auto"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="SENT">Sent</option>
                          <option value="PAID">Paid</option>
                        </select>
                        {isPending && <span className="text-xs text-steel-400">Saving\u2026</span>}
                      </div>

                      {isDraft && (
                        <form action={deleteAction} className="ml-auto">
                          <input type="hidden" name="sheetId" value={entry.sheetId} />
                          <button type="submit" className="text-sm text-red-600 hover:underline">
                            Delete Trip Sheet
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Tickets table */}
                    {entry.tickets.length === 0 ? (
                      <div className="text-center text-steel-400 py-6 text-sm">No tickets</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                            <tr>
                              <th className="text-left px-4 py-2">Date</th>
                              <th className="text-left px-4 py-2">Truck</th>
                              <th className="text-left px-4 py-2">Customer</th>
                              <th className="text-left px-4 py-2">Hauled From</th>
                              <th className="text-left px-4 py-2">Hauled To</th>
                              <th className="text-left px-4 py-2">Ticket #</th>
                              <th className="text-right px-4 py-2">Qty</th>
                              <th className="text-right px-4 py-2">Rate</th>
                              <th className="text-right px-4 py-2">Amount</th>
                              {isDraft && <th className="px-4 py-2 w-8"></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {entry.tickets.map((t) => (
                              <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                                <td className="px-4 py-2.5 text-steel-600">{formatTicketDate(t.date, t.completedAt)}</td>
                                <td className="px-4 py-2.5 font-medium">{t.truckNumber || '\u2014'}</td>
                                <td className="px-4 py-2.5">{t.customerName || '\u2014'}</td>
                                <td className="px-4 py-2.5 text-steel-600">{t.hauledFrom}</td>
                                <td className="px-4 py-2.5 text-steel-600">{t.hauledTo}</td>
                                <td className="px-4 py-2.5 font-mono">
                                  <Link href={`/tickets/${t.id}`} className="hover:text-safety-dark">
                                    {t.ticketRef || `#${String(t.ticketNumber).padStart(4, '0')}`}
                                  </Link>
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {t.quantityType === 'TONS' ? Number(t.quantity) : Math.round(Number(t.quantity))}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">${t.ratePerUnit.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                                  ${(t.ratePerUnit * t.quantity).toFixed(2)}
                                </td>
                                {isDraft && (
                                  <td className="px-4 py-2.5">
                                    <form action={removeAction}>
                                      <input type="hidden" name="sheetId" value={entry.sheetId} />
                                      <input type="hidden" name="ticketId" value={t.id} />
                                      <button type="submit" className="text-red-500 hover:text-red-700 text-xs">{'\u2715'}</button>
                                    </form>
                                  </td>
                                )}
                              </tr>
                            ))}
                            {/* Totals row */}
                            <tr className="bg-steel-50 font-semibold">
                              <td colSpan={8} className="px-4 py-2 text-right text-steel-600">Total</td>
                              <td className="px-4 py-2 text-right tabular-nums">${entry.total.toFixed(2)}</td>
                              {isDraft && <td></td>}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add tickets (draft only) */}
                    {isDraft && (
                      <AddTicketsForm
                        sheetId={entry.sheetId}
                        availableTickets={availableTickets}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
