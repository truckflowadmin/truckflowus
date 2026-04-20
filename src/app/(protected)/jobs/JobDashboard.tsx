'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';

interface JobRow {
  id: string;
  jobNumber: number;
  name: string;
  status: string;
  dateRaw: string | null;
  dateDisplay: string | null;
  customerName: string | null;
  brokerName: string | null;
  driverName: string | null;
  hauledFrom: string;
  hauledTo: string;
  material: string | null;
  truckNumber: string | null;
  quantityType: string;
  totalLoads: number;
  completedLoads: number;
  ticketCount: number;
  ratePerUnit: number | null;
  openForDrivers: boolean;
  invoiced: boolean;
}

const ALL_STATUSES = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'] as const;

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-steel-200 text-steel-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  PARTIALLY_COMPLETED: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
};

type PeriodMode = 'all' | 'week' | 'month' | 'year' | 'custom';

function fmtDate(d: Date): string { return d.toISOString().slice(0, 10); }

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function computePeriod(mode: PeriodMode, anchor: Date): { start: string; end: string } | null {
  if (mode === 'all') return null;
  switch (mode) {
    case 'week': {
      const mon = getMonday(anchor);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: fmtDate(mon), end: fmtDate(sun) };
    }
    case 'month': {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start: fmtDate(start), end: fmtDate(end) };
    }
    case 'year':
      return { start: `${anchor.getFullYear()}-01-01`, end: `${anchor.getFullYear()}-12-31` };
    default: return null;
  }
}

function formatPeriodLabel(mode: PeriodMode, start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const optsY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  switch (mode) {
    case 'week': return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', optsY)}`;
    case 'month': return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'year': return String(s.getFullYear());
    case 'custom': return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', optsY)}`;
    default: return 'All Time';
  }
}

function shiftAnchor(mode: PeriodMode, anchor: Date, delta: number): Date {
  const d = new Date(anchor);
  switch (mode) {
    case 'week': d.setDate(d.getDate() + delta * 7); return d;
    case 'month': d.setMonth(d.getMonth() + delta); return d;
    case 'year': d.setFullYear(d.getFullYear() + delta); return d;
    default: return d;
  }
}

export default function JobDashboard({
  jobs, customers, drivers, brokers, defaultPeriodStart, defaultPeriodEnd,
}: {
  jobs: JobRow[];
  customers: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
  brokers: { id: string; name: string }[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [nameFilter, setNameFilter] = useState('');
  const [entityType, setEntityType] = useState<string>('ALL');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [anchor, setAnchor] = useState<Date>(() => {
    const mon = getMonday(new Date()); mon.setDate(mon.getDate() - 7); return mon;
  });
  const [customStart, setCustomStart] = useState(defaultPeriodStart);
  const [customEnd, setCustomEnd] = useState(defaultPeriodEnd);
  const [showCalendar, setShowCalendar] = useState(false);

  // Name dropdown
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Action state
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const period = useMemo(() => {
    if (periodMode === 'custom') return { start: customStart, end: customEnd };
    return computePeriod(periodMode, anchor);
  }, [periodMode, anchor, customStart, customEnd]);

  const periodLabel = useMemo(() => {
    if (!period) return 'All Time';
    return formatPeriodLabel(periodMode, period.start, period.end);
  }, [periodMode, period]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter === 'ALL' && j.status === 'CANCELLED') return false;
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
      if (nameFilter) {
        const q = nameFilter.toLowerCase();
        const matches = [j.name, j.customerName, j.brokerName, j.driverName, j.material, j.hauledFrom, j.hauledTo, String(j.jobNumber)]
          .some(v => v?.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (entityType === 'CUSTOMER' && !j.customerName) return false;
      if (entityType === 'BROKER' && !j.brokerName) return false;
      if (entityType === 'DRIVER' && !j.driverName) return false;
      if (period && j.dateRaw) {
        if (j.dateRaw < period.start || j.dateRaw > period.end) return false;
      }
      return true;
    });
  }, [jobs, statusFilter, nameFilter, entityType, period]);

  const filteredIds = useMemo(() => new Set(filtered.map(j => j.id)), [filtered]);

  const activeSelected = useMemo(() => {
    const s = new Set<string>();
    selected.forEach(id => { if (filteredIds.has(id)) s.add(id); });
    return s;
  }, [selected, filteredIds]);

  const allSelected = filtered.length > 0 && activeSelected.size === filtered.length;
  const someSelected = activeSelected.size > 0;

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0 };
    for (const j of jobs) {
      c[j.status] = (c[j.status] || 0) + 1;
      if (j.status !== 'CANCELLED') c.ALL++;
    }
    return c;
  }, [jobs]);

  function handleShift(delta: number) { setAnchor(prev => shiftAnchor(periodMode, prev, delta)); }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(j => j.id)));
  }

  function clearSelection() { setSelected(new Set()); }

  // Single row status change
  async function handleStatusChange(jobId: string, newStatus: string) {
    setUpdatingId(jobId);
    setActionError(null);
    try {
      const res = await fetch('/api/jobs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: jobId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Failed to update status');
      else window.location.reload();
    } catch { setActionError('Network error'); }
    finally { setUpdatingId(null); }
  }

  // Bulk actions
  async function bulkStatusChange(status: string) {
    const invoicedSelected = filtered.filter(j => activeSelected.has(j.id) && j.invoiced);
    if (invoicedSelected.length > 0) {
      setActionError(`${invoicedSelected.length} selected job(s) are invoiced and cannot be modified`);
      return;
    }
    if (!confirm(`Change ${activeSelected.size} job(s) to ${status.replace('_', ' ')}?`)) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/jobs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...activeSelected], action: 'status', status }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Bulk status change failed');
      else window.location.replace('/jobs?_t=' + Date.now());
    } catch { setActionError('Network error'); }
    finally { setBulkBusy(false); }
  }

  function bulkPrint() {
    [...activeSelected].forEach(id => window.open(`/jobs/${id}`, '_blank'));
  }

  function bulkExportCsv() {
    const rows = filtered.filter(j => activeSelected.has(j.id));
    const header = ['Job #', 'Name', 'Status', 'Customer', 'Broker', 'Driver', 'From', 'To', 'Material', 'Loads', 'Completed', 'Rate', 'Date'];
    const csvRows = [header.join(',')];
    for (const r of rows) {
      csvRows.push([
        `#${r.jobNumber}`,
        `"${r.name}"`,
        r.status,
        `"${r.customerName ?? ''}"`,
        `"${r.brokerName ?? ''}"`,
        `"${r.driverName ?? ''}"`,
        `"${r.hauledFrom}"`,
        `"${r.hauledTo}"`,
        `"${r.material ?? ''}"`,
        r.totalLoads,
        r.completedLoads,
        r.ratePerUnit != null ? r.ratePerUnit.toFixed(2) : '',
        r.dateRaw ?? '',
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const periodModes: { value: PeriodMode; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="panel overflow-hidden">
      {/* Filter bar */}
      <div className="px-5 py-4 border-b border-steel-200 space-y-3">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...ALL_STATUSES].map((s) => {
            const count = counts[s] || 0;
            if (s !== 'ALL' && count === 0) return null;
            return (
              <button key={s} onClick={() => { setStatusFilter(s); clearSelection(); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? 'bg-steel-800 text-white' : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
                }`}>
                {s === 'ALL' ? 'All' : s.replace('_', ' ')} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + entity type */}
        <div className="flex gap-3 flex-wrap items-end">
          <div ref={dropdownRef} className="flex-1 min-w-[200px] max-w-xs relative">
            <input type="text" placeholder="Search job, customer, driver, material..."
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setShowNameDropdown(true); }}
              onFocus={() => setShowNameDropdown(true)}
              className="input text-sm py-1.5 w-full"
            />
            {showNameDropdown && nameFilter.length === 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-steel-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {customers.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Customers</div>
                    {customers.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setNameFilter(c.name); setEntityType('CUSTOMER'); setShowNameDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">{c.name}</button>
                    ))}
                  </div>
                )}
                {brokers.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Brokers</div>
                    {brokers.map(b => (
                      <button key={b.id} type="button"
                        onClick={() => { setNameFilter(b.name); setEntityType('BROKER'); setShowNameDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">{b.name}</button>
                    ))}
                  </div>
                )}
                {drivers.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Drivers</div>
                    {drivers.map(d => (
                      <button key={d.id} type="button"
                        onClick={() => { setNameFilter(d.name); setEntityType('DRIVER'); setShowNameDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">{d.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showNameDropdown && nameFilter.length > 0 && (() => {
              const q = nameFilter.toLowerCase();
              const mc = customers.filter(c => c.name.toLowerCase().includes(q));
              const mb = brokers.filter(b => b.name.toLowerCase().includes(q));
              const md = drivers.filter(d => d.name.toLowerCase().includes(q));
              if (mc.length === 0 && mb.length === 0 && md.length === 0) return null;
              return (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-steel-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {mc.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Customers</div>
                      {mc.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setNameFilter(c.name); setEntityType('CUSTOMER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">{c.name}</button>
                      ))}
                    </div>
                  )}
                  {mb.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Brokers</div>
                      {mb.map(b => (
                        <button key={b.id} type="button"
                          onClick={() => { setNameFilter(b.name); setEntityType('BROKER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">{b.name}</button>
                      ))}
                    </div>
                  )}
                  {md.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Drivers</div>
                      {md.map(d => (
                        <button key={d.id} type="button"
                          onClick={() => { setNameFilter(d.name); setEntityType('DRIVER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">{d.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
            className="input text-sm py-1.5 w-36">
            <option value="ALL">All Types</option>
            <option value="CUSTOMER">Customer</option>
            <option value="BROKER">Broker</option>
            <option value="DRIVER">Driver</option>
          </select>
          {nameFilter && (
            <button type="button" onClick={() => { setNameFilter(''); setEntityType('ALL'); setStatusFilter('ALL'); setPeriodMode('all'); setShowCalendar(false); clearSelection(); }}
              className="text-xs text-steel-500 hover:text-steel-800 py-1.5">
              Clear
            </button>
          )}
        </div>

        {/* Period picker */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-0.5 bg-steel-50 rounded-md p-0.5 border border-steel-200">
            {periodModes.map((m) => (
              <button key={m.value} type="button"
                onClick={() => { setPeriodMode(m.value); setShowCalendar(false); }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  periodMode === m.value ? 'bg-white shadow-sm text-steel-900' : 'text-steel-500 hover:text-steel-700'
                }`}>{m.label}</button>
            ))}
          </div>

          {periodMode !== 'all' && periodMode !== 'custom' && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => handleShift(-1)}
                className="px-2 py-1 rounded border border-steel-300 hover:bg-steel-50 text-xs font-bold">&#8592;</button>
              <button type="button" onClick={() => setShowCalendar(!showCalendar)}
                className="text-sm font-medium py-1 px-3 rounded border border-steel-300 hover:bg-steel-50 cursor-pointer min-w-[160px] text-center">
                {periodLabel}
              </button>
              <button type="button" onClick={() => handleShift(1)}
                className="px-2 py-1 rounded border border-steel-300 hover:bg-steel-50 text-xs font-bold">&#8594;</button>
            </div>
          )}

          {periodMode === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" className="input text-sm py-1" value={customStart}
                onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-steel-400 text-xs">to</span>
              <input type="date" className="input text-sm py-1" value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>

        {showCalendar && periodMode !== 'all' && periodMode !== 'custom' && (
          <div className="p-3 rounded-lg border border-steel-200 bg-white shadow-lg max-w-xs">
            <p className="text-xs text-steel-500 mb-2">Pick a date to jump to that {periodMode}</p>
            <input type="date" className="input text-sm" value={fmtDate(anchor)}
              onChange={(e) => { if (e.target.value) { setAnchor(new Date(e.target.value + 'T00:00:00')); setShowCalendar(false); } }} />
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-900">{activeSelected.size} selected</span>
          <div className="h-4 w-px bg-blue-200" />

          <select defaultValue="" disabled={bulkBusy}
            onChange={(e) => { if (e.target.value) { bulkStatusChange(e.target.value); e.target.value = ''; } }}
            className="text-xs border border-blue-300 rounded px-2 py-1 bg-white cursor-pointer">
            <option value="" disabled>Change Status...</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <button type="button" onClick={bulkPrint} disabled={bulkBusy}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50 px-2 py-1 rounded hover:bg-blue-100">
            Print / View
          </button>

          <button type="button" onClick={bulkExportCsv} disabled={bulkBusy}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50 px-2 py-1 rounded hover:bg-blue-100">
            Export CSV
          </button>

          <div className="h-4 w-px bg-blue-200" />

          <button type="button" onClick={clearSelection}
            className="text-xs text-blue-500 hover:text-blue-700">Clear selection</button>
        </div>
      )}

      {/* Error banner */}
      {actionError && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
          <span className="text-red-500 text-sm">&#9888;</span>
          <span className="text-sm text-red-700 flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center text-steel-500">
          {jobs.length === 0 ? 'No jobs yet.' : 'No jobs match your filters.'}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
            <tr>
              <th className="px-3 py-2 w-10">
                <input type="checkbox" checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  className="rounded border-steel-300 cursor-pointer" />
              </th>
              <th className="text-left px-3 py-2">Job #</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Driver</th>
              <th className="text-left px-3 py-2">Customer / Broker</th>
              <th className="text-left px-3 py-2">Route</th>
              <th className="text-center px-3 py-2">Loads</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => {
              const isCancelled = j.status === 'CANCELLED';
              const isSelected = activeSelected.has(j.id);
              const unlimitedLoads = j.totalLoads === 0;
              // When loads specified: progress = tickets created / totalLoads
              // When no loads specified: progress based on job status
              const STATUS_PROGRESS: Record<string, number> = { CREATED: 0, ASSIGNED: 25, IN_PROGRESS: 50, PARTIALLY_COMPLETED: 75, COMPLETED: 100, CANCELLED: 0 };
              const progress = unlimitedLoads
                ? (STATUS_PROGRESS[j.status] ?? 0)
                : Math.round((j.ticketCount / j.totalLoads) * 100);
              return (
                <tr key={j.id}
                  className={`border-b border-steel-100 hover:bg-steel-50 ${isCancelled ? 'opacity-60' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={isSelected}
                      onChange={() => toggleSelect(j.id)}
                      className="rounded border-steel-300 cursor-pointer" />
                  </td>
                  <td className="px-3 py-3 font-mono">
                    <Link href={`/jobs/${j.id}`} className="text-safety hover:underline font-semibold">
                      #{j.jobNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-medium text-steel-800 max-w-[180px] truncate">
                    <Link href={`/jobs/${j.id}`} className="hover:underline">{j.name}</Link>
                  </td>
                  <td className="px-3 py-3">
                    {j.invoiced ? (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[j.status] || ''}`} title="Invoiced — locked">
                        {j.status.replace('_', ' ')}
                      </span>
                    ) : (
                      <select value={j.status} disabled={updatingId === j.id}
                        onChange={(e) => handleStatusChange(j.id, e.target.value)}
                        className="text-xs border border-steel-200 rounded px-2 py-1 bg-white cursor-pointer">
                        {ALL_STATUSES.map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-steel-600">
                    {j.driverName ?? (
                      <span className="text-steel-400 italic">{j.openForDrivers ? 'Open' : 'Unassigned'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-steel-600">
                    {j.brokerName ?? j.customerName ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-steel-600 text-xs max-w-[180px] truncate">
                    {j.hauledFrom} → {j.hauledTo}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-16 bg-steel-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-amber-400' : 'bg-steel-200'}`}
                          style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      <span className="font-mono text-xs">
                        {unlimitedLoads
                          ? <span className="text-steel-500">{j.status === 'COMPLETED' ? '100%' : `${progress}%`}</span>
                          : <>
                              <span className={progress >= 100 ? 'text-green-600 font-bold' : ''}>{j.ticketCount}</span>
                              <span className="text-steel-400">/{j.totalLoads}</span>
                            </>
                        }
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-steel-500 text-xs">{j.dateDisplay ?? '—'}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {j.invoiced && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="This job has invoiced tickets">Invoiced</span>
                      )}
                      {!j.invoiced && (
                        <Link href={`/jobs/${j.id}/edit`} className="text-xs text-blue-600 hover:text-blue-800">Edit</Link>
                      )}
                      <Link href={`/jobs/${j.id}`} className="text-xs text-steel-600 hover:text-steel-800">View</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Footer */}
      <div className="px-5 py-2 border-t border-steel-200 flex items-center justify-between">
        <span className="text-xs text-steel-500">
          Showing {filtered.length} of {jobs.length} job{jobs.length !== 1 ? 's' : ''}
        </span>
        <Link href="/jobs/new" className="btn-accent text-xs py-1.5 px-3">+ New Job</Link>
      </div>
    </div>
  );
}
