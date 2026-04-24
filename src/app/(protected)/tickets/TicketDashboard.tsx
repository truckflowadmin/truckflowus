'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface TicketRow {
  id: string;
  ticketNumber: number;
  status: string;
  date: string | null;       // formatted "MMM d, yyyy"
  dateRaw: string | null;    // yyyy-MM-dd for filtering
  customerName: string | null;
  driverName: string | null;
  brokerName: string | null;
  truckNumber: string | null;
  material: string | null;
  quantity: number;
  quantityType: string;
  ratePerUnit: number | null;
  amount: number;
  reviewed: boolean;
  hasPhoto: boolean;
  hauledFrom: string | null;
  hauledTo: string | null;
  ticketRef: string | null;
  invoiced: boolean;
}

const ALL_STATUSES = ['PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED'] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-steel-200 text-steel-800',
  DISPATCHED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ISSUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-steel-100 text-steel-500',
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

function fmtQty(quantity: number, quantityType: string): string {
  if (quantityType === 'TONS') return Number(quantity).toFixed(2);
  return String(Math.round(quantity));
}

function qtyUnit(quantityType: string): string {
  if (quantityType === 'TONS') return 'tn';
  if (quantityType === 'YARDS') return 'yd';
  return 'ld';
}

export default function TicketDashboard({
  tickets, customers, drivers, brokers, defaultPeriodStart, defaultPeriodEnd,
}: {
  tickets: TicketRow[];
  customers: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
  brokers: { id: string; name: string }[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [nameFilter, setNameFilter] = useState('');
  const [entityType, setEntityType] = useState<string>('ALL'); // ALL, CUSTOMER, DRIVER
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
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Inline editing — local state for optimistic updates
  const [localQty, setLocalQty] = useState<Record<string, { quantity: number; quantityType: string }>>({});
  const [savingQtyId, setSavingQtyId] = useState<string | null>(null);
  const [localRef, setLocalRef] = useState<Record<string, string>>({});
  const [savingRefId, setSavingRefId] = useState<string | null>(null);

  // Bulk edit panel
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState<Record<string, string>>({});

  const period = useMemo(() => {
    if (periodMode === 'custom') return { start: customStart, end: customEnd };
    return computePeriod(periodMode, anchor);
  }, [periodMode, anchor, customStart, customEnd]);

  const periodLabel = useMemo(() => {
    if (!period) return 'All Time';
    return formatPeriodLabel(periodMode, period.start, period.end);
  }, [periodMode, period]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (nameFilter) {
        const q = nameFilter.toLowerCase();
        const matchesCustomer = t.customerName?.toLowerCase().includes(q);
        const matchesDriver = t.driverName?.toLowerCase().includes(q);
        const matchesBroker = t.brokerName?.toLowerCase().includes(q);
        const matchesMaterial = t.material?.toLowerCase().includes(q);
        const matchesNumber = String(t.ticketNumber).includes(q);
        if (!matchesCustomer && !matchesDriver && !matchesBroker && !matchesMaterial && !matchesNumber) return false;
      }
      if (entityType === 'CUSTOMER' && !t.customerName) return false;
      if (entityType === 'DRIVER' && !t.driverName) return false;
      if (period && t.dateRaw) {
        if (t.dateRaw < period.start || t.dateRaw > period.end) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, nameFilter, entityType, period]);

  const filteredIds = useMemo(() => new Set(filtered.map(t => t.id)), [filtered]);

  const activeSelected = useMemo(() => {
    const s = new Set<string>();
    selected.forEach(id => { if (filteredIds.has(id)) s.add(id); });
    return s;
  }, [selected, filteredIds]);

  const allSelected = filtered.length > 0 && activeSelected.size === filtered.length;
  const someSelected = activeSelected.size > 0;

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tickets.length };
    for (const t of tickets) {
      c[t.status] = (c[t.status] || 0) + 1;
    }
    return c;
  }, [tickets]);

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
    else setSelected(new Set(filtered.map(t => t.id)));
  }

  function clearSelection() { setSelected(new Set()); }

  // Single row status change
  async function handleStatusChange(ticketId: string, newStatus: string) {
    setUpdatingId(ticketId);
    setActionError(null);
    try {
      const res = await fetch('/api/tickets/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Failed to update status');
      else window.location.reload();
    } catch { setActionError('Network error'); }
    finally { setUpdatingId(null); }
  }

  // Quick review toggle
  async function handleReviewToggle(ticketId: string, currentlyReviewed: boolean) {
    setReviewingId(ticketId);
    setActionError(null);
    try {
      const action = currentlyReviewed ? 'unmark' : 'mark';
      const res = await fetch('/api/tickets/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, action }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Review update failed');
      window.location.reload();
    } catch {
      setActionError('Network error');
    } finally {
      setReviewingId(null);
    }
  }

  // Inline quantity auto-save
  async function handleInlineQtyChange(ticketId: string, field: 'quantity' | 'quantityType', value: string) {
    const current = localQty[ticketId] ?? (() => {
      const t = tickets.find(tk => tk.id === ticketId);
      return t ? { quantity: t.quantity, quantityType: t.quantityType } : { quantity: 1, quantityType: 'LOADS' };
    })();

    let newQty = current.quantity;
    let newType = current.quantityType;
    if (field === 'quantity') {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || parsed < 0) return;
      newQty = parsed;
    } else {
      newType = value;
    }

    setLocalQty(prev => ({ ...prev, [ticketId]: { quantity: newQty, quantityType: newType } }));
    setSavingQtyId(ticketId);
    setActionError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, quantity: String(newQty), quantityType: newType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to update quantity');
        // Revert on error
        setLocalQty(prev => { const next = { ...prev }; delete next[ticketId]; return next; });
      }
    } catch {
      setActionError('Network error');
      setLocalQty(prev => { const next = { ...prev }; delete next[ticketId]; return next; });
    } finally {
      setSavingQtyId(null);
    }
  }

  // Inline ticket ref auto-save
  async function handleInlineRefSave(ticketId: string, value: string) {
    setLocalRef(prev => ({ ...prev, [ticketId]: value }));
    setSavingRefId(ticketId);
    setActionError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, ticketRef: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to update ticket #');
        setLocalRef(prev => { const next = { ...prev }; delete next[ticketId]; return next; });
      }
    } catch {
      setActionError('Network error');
      setLocalRef(prev => { const next = { ...prev }; delete next[ticketId]; return next; });
    } finally {
      setSavingRefId(null);
    }
  }

  // Debounce ref changes — save on blur, not on every keystroke
  const refTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function handleRefChange(ticketId: string, value: string) {
    setLocalRef(prev => ({ ...prev, [ticketId]: value }));
    if (refTimers.current[ticketId]) clearTimeout(refTimers.current[ticketId]);
    refTimers.current[ticketId] = setTimeout(() => handleInlineRefSave(ticketId, value), 800);
  }

  // Bulk actions
  async function bulkStatusChange(status: string) {
    const reviewedSelected = filtered.filter(t => activeSelected.has(t.id) && t.reviewed);
    if (reviewedSelected.length > 0) {
      setActionError(`${reviewedSelected.length} selected ticket(s) are reviewed and cannot be modified. Unmark them first.`);
      return;
    }
    const invoicedSelected = filtered.filter(t => activeSelected.has(t.id) && t.invoiced);
    if (invoicedSelected.length > 0) {
      setActionError(`${invoicedSelected.length} selected ticket(s) are on an invoice and cannot be modified`);
      return;
    }
    if (!confirm(`Change ${activeSelected.size} ticket(s) to ${status.replace('_', ' ')}?`)) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...activeSelected], action: 'status', status }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Bulk status change failed');
      else window.location.replace('/tickets?_t=' + Date.now());
    } catch { setActionError('Network error'); }
    finally { setBulkBusy(false); }
  }

  function bulkPrint() {
    const ids = [...activeSelected];
    ids.forEach(id => {
      window.open(`/tickets/${id}`, '_blank');
    });
  }

  function bulkExportCsv() {
    const rows = filtered.filter(t => activeSelected.has(t.id));
    const header = ['Ticket #', 'Date', 'Customer', 'Driver', 'Broker', 'Truck #', 'Material', 'Qty', 'Rate', 'Amount', 'Status', 'Reviewed'];
    const csvRows = [header.join(',')];
    for (const r of rows) {
      csvRows.push([
        `#${String(r.ticketNumber).padStart(4, '0')}`,
        r.dateRaw ?? '',
        `"${r.customerName ?? ''}"`,
        `"${r.driverName ?? ''}"`,
        `"${r.brokerName ?? ''}"`,
        `"${r.truckNumber ?? ''}"`,
        `"${r.material ?? ''}"`,
        `${fmtQty(r.quantity, r.quantityType)} ${qtyUnit(r.quantityType)}`,
        r.ratePerUnit != null ? r.ratePerUnit.toFixed(2) : '',
        r.amount.toFixed(2),
        r.status,
        r.reviewed ? 'Yes' : 'No',
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function bulkEdit() {
    // Filter out empty/unchanged fields
    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(bulkEditFields)) {
      if (val === '' || val === '__skip__') continue;
      if (key === 'customerId' || key === 'driverId' || key === 'brokerId') {
        fields[key] = val === '__clear__' ? null : val;
      } else {
        fields[key] = val;
      }
    }
    if (Object.keys(fields).length === 0) {
      setActionError('Select at least one field to update');
      return;
    }
    const reviewedSelected = filtered.filter(t => activeSelected.has(t.id) && t.reviewed);
    if (reviewedSelected.length > 0) {
      setActionError(`${reviewedSelected.length} selected ticket(s) are reviewed and cannot be edited. Unmark them first.`);
      return;
    }
    const invoicedSelected = filtered.filter(t => activeSelected.has(t.id) && t.invoiced);
    if (invoicedSelected.length > 0) {
      setActionError(`${invoicedSelected.length} selected ticket(s) are invoiced and cannot be edited`);
      return;
    }
    const fieldLabels = Object.keys(fields).join(', ');
    if (!confirm(`Update ${fieldLabels} on ${activeSelected.size} ticket(s)?`)) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...activeSelected], action: 'edit', fields }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Bulk edit failed');
      else {
        setShowBulkEdit(false);
        setBulkEditFields({});
        window.location.replace('/tickets?_t=' + Date.now());
      }
    } catch { setActionError('Network error'); }
    finally { setBulkBusy(false); }
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
            <input type="text" placeholder="Search customer, driver, material, ticket #..."
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
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {drivers.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Drivers</div>
                    {drivers.map(d => (
                      <button key={d.id} type="button"
                        onClick={() => { setNameFilter(d.name); setEntityType('DRIVER'); setShowNameDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showNameDropdown && nameFilter.length > 0 && (() => {
              const q = nameFilter.toLowerCase();
              const matchedCustomers = customers.filter(c => c.name.toLowerCase().includes(q));
              const matchedDrivers = drivers.filter(d => d.name.toLowerCase().includes(q));
              if (matchedCustomers.length === 0 && matchedDrivers.length === 0) return null;
              return (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-steel-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {matchedCustomers.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Customers</div>
                      {matchedCustomers.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setNameFilter(c.name); setEntityType('CUSTOMER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedDrivers.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Drivers</div>
                      {matchedDrivers.map(d => (
                        <button key={d.id} type="button"
                          onClick={() => { setNameFilter(d.name); setEntityType('DRIVER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                          {d.name}
                        </button>
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
                }`}>
                {m.label}
              </button>
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
          <span className="text-sm font-medium text-blue-900">
            {activeSelected.size} selected
          </span>

          <div className="h-4 w-px bg-blue-200" />

          <select
            defaultValue=""
            disabled={bulkBusy}
            onChange={(e) => { if (e.target.value) { bulkStatusChange(e.target.value); e.target.value = ''; } }}
            className="text-xs border border-blue-300 rounded px-2 py-1 bg-white cursor-pointer"
          >
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

          <button type="button" onClick={() => { setShowBulkEdit(!showBulkEdit); setBulkEditFields({}); }} disabled={bulkBusy}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              showBulkEdit ? 'bg-safety text-diesel' : 'text-blue-700 hover:text-blue-900 hover:bg-blue-100'
            }`}>
            {showBulkEdit ? 'Close Edit' : 'Bulk Edit'}
          </button>

          <div className="h-4 w-px bg-blue-200" />

          <button type="button" onClick={clearSelection}
            className="text-xs text-blue-500 hover:text-blue-700">
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk edit panel */}
      {showBulkEdit && someSelected && (
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-900">
              Bulk Edit — {activeSelected.size} ticket{activeSelected.size !== 1 ? 's' : ''}
            </h3>
            <span className="text-xs text-amber-600">Only fill fields you want to change. Leave others blank.</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Customer</label>
              <select
                value={bulkEditFields.customerId ?? '__skip__'}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, customerId: e.target.value })}
                className="input text-sm py-1.5 w-full"
              >
                <option value="__skip__">— No change —</option>
                <option value="__clear__">Clear customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Driver</label>
              <select
                value={bulkEditFields.driverId ?? '__skip__'}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, driverId: e.target.value })}
                className="input text-sm py-1.5 w-full"
              >
                <option value="__skip__">— No change —</option>
                <option value="__clear__">Unassign driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Broker</label>
              <select
                value={bulkEditFields.brokerId ?? '__skip__'}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, brokerId: e.target.value })}
                className="input text-sm py-1.5 w-full"
              >
                <option value="__skip__">— No change —</option>
                <option value="__clear__">Clear broker</option>
                {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Material</label>
              <input type="text"
                value={bulkEditFields.material ?? ''}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, material: e.target.value })}
                className="input text-sm py-1.5 w-full" placeholder="Leave blank = no change"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Hauled From</label>
              <input type="text"
                value={bulkEditFields.hauledFrom ?? ''}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, hauledFrom: e.target.value })}
                className="input text-sm py-1.5 w-full" placeholder="Leave blank = no change"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Hauled To</label>
              <input type="text"
                value={bulkEditFields.hauledTo ?? ''}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, hauledTo: e.target.value })}
                className="input text-sm py-1.5 w-full" placeholder="Leave blank = no change"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Truck #</label>
              <input type="text"
                value={bulkEditFields.truckNumber ?? ''}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, truckNumber: e.target.value })}
                className="input text-sm py-1.5 w-full" placeholder="Leave blank = no change"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Date</label>
              <input type="date"
                value={bulkEditFields.date ?? ''}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, date: e.target.value })}
                className="input text-sm py-1.5 w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Rate per Unit</label>
              <input type="number" step="0.01" min="0"
                value={bulkEditFields.ratePerUnit ?? ''}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, ratePerUnit: e.target.value })}
                className="input text-sm py-1.5 w-full" placeholder="Leave blank = no change"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-amber-800 mb-0.5 block">Quantity Type</label>
              <select
                value={bulkEditFields.quantityType ?? '__skip__'}
                onChange={(e) => setBulkEditFields({ ...bulkEditFields, quantityType: e.target.value })}
                className="input text-sm py-1.5 w-full"
              >
                <option value="__skip__">— No change —</option>
                <option value="LOADS">Loads</option>
                <option value="TONS">Tons</option>
                <option value="YARDS">Yards</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={bulkEdit} disabled={bulkBusy}
              className="btn-accent text-sm">
              {bulkBusy ? 'Updating...' : `Apply to ${activeSelected.size} Ticket${activeSelected.size !== 1 ? 's' : ''}`}
            </button>
            <button type="button" onClick={() => { setShowBulkEdit(false); setBulkEditFields({}); }}
              className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
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
          {tickets.length === 0 ? 'No tickets yet.' : 'No tickets match your filters.'}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  className="rounded border-steel-300 cursor-pointer"
                />
              </th>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Ticket #</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Driver</th>
              <th className="text-left px-3 py-2">Truck #</th>
              <th className="text-left px-3 py-2">Material</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Rate</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-center px-3 py-2">Review</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const isCancelled = t.status === 'CANCELLED';
              const isSelected = activeSelected.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-steel-100 hover:bg-steel-50 ${isCancelled ? 'opacity-60' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(t.id)}
                      className="rounded border-steel-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3 font-mono">
                    <Link href={`/tickets/${t.id}`} className="text-steel-900 hover:text-safety-dark">
                      #{String(t.ticketNumber).padStart(4, '0')}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    {(t.invoiced || t.reviewed) ? (
                      <span className="text-xs text-steel-600">{t.ticketRef || '—'}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={localRef[t.id] ?? t.ticketRef ?? ''}
                          disabled={savingRefId === t.id}
                          onChange={(e) => handleRefChange(t.id, e.target.value)}
                          placeholder="—"
                          className="w-20 text-xs border border-steel-200 rounded px-1.5 py-1 bg-white focus:border-safety focus:ring-1 focus:ring-safety/30"
                        />
                        {savingRefId === t.id && (
                          <span className="text-[10px] text-steel-400 animate-pulse">…</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-steel-600 text-xs">{t.date ?? '—'}</td>
                  <td className="px-3 py-3">{t.customerName ?? '—'}</td>
                  <td className="px-3 py-3">
                    {t.driverName ?? <span className="text-steel-400">unassigned</span>}
                  </td>
                  <td className="px-3 py-3 text-steel-600">{t.truckNumber ?? '—'}</td>
                  <td className="px-3 py-3">{t.material ?? '—'}</td>
                  <td className="px-3 py-3 text-right">
                    {(t.invoiced || t.reviewed) ? (
                      <span className="tabular-nums">{fmtQty(t.quantity, t.quantityType)} {qtyUnit(t.quantityType)}</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step={((localQty[t.id]?.quantityType ?? t.quantityType) === 'TONS') ? '0.01' : '1'}
                          min="0"
                          value={localQty[t.id]?.quantity ?? t.quantity}
                          disabled={savingQtyId === t.id}
                          onChange={(e) => handleInlineQtyChange(t.id, 'quantity', e.target.value)}
                          className="w-16 text-right text-xs border border-steel-200 rounded px-1.5 py-1 bg-white tabular-nums focus:border-safety focus:ring-1 focus:ring-safety/30"
                        />
                        <select
                          value={localQty[t.id]?.quantityType ?? t.quantityType}
                          disabled={savingQtyId === t.id}
                          onChange={(e) => handleInlineQtyChange(t.id, 'quantityType', e.target.value)}
                          className="text-xs border border-steel-200 rounded px-1 py-1 bg-white cursor-pointer"
                        >
                          <option value="LOADS">ld</option>
                          <option value="TONS">tn</option>
                          <option value="YARDS">yd</option>
                        </select>
                        {savingQtyId === t.id && (
                          <span className="text-[10px] text-steel-400 animate-pulse">…</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {t.ratePerUnit != null ? `$${t.ratePerUnit.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-3">
                    {t.invoiced ? (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[t.status] || ''}`} title="Invoiced — locked">
                        {t.status.replace('_', ' ')}
                      </span>
                    ) : (
                      <select
                        value={t.status}
                        disabled={updatingId === t.id}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        className="text-xs border border-steel-200 rounded px-2 py-1 bg-white cursor-pointer"
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {t.invoiced ? (
                      t.reviewed
                        ? <span className="text-green-600 text-xs font-medium">✓ Reviewed</span>
                        : <span className="text-amber-600 text-xs font-medium">Review Needed</span>
                    ) : t.reviewed ? (
                      t.hasPhoto && t.status === 'COMPLETED' ? (
                        <button
                          type="button"
                          disabled={reviewingId === t.id}
                          onClick={() => handleReviewToggle(t.id, true)}
                          className="text-xs px-2 py-0.5 rounded font-medium transition-colors bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          {reviewingId === t.id ? '...' : '✓ Reviewed'}
                        </button>
                      ) : (
                        <span className="text-green-600 text-xs font-medium">✓ Reviewed</span>
                      )
                    ) : t.hasPhoto && t.status === 'COMPLETED' ? (
                      <button
                        type="button"
                        disabled={reviewingId === t.id}
                        onClick={() => handleReviewToggle(t.id, false)}
                        className="text-xs px-2 py-0.5 rounded font-medium transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200"
                      >
                        {reviewingId === t.id ? '...' : 'Review Needed'}
                      </button>
                    ) : (
                      <span className="text-amber-600 text-xs font-medium">Review Needed</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.invoiced && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="On an invoice">Invoiced</span>
                      )}
                      <Link href={`/tickets/${t.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800">
                        View
                      </Link>
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
          Showing {filtered.length} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <Link href="/tickets/scan" className="btn-ghost text-xs py-1.5 px-3">Bulk Scan</Link>
          <Link href="/tickets/bulk" className="btn-ghost text-xs py-1.5 px-3">Bulk Create</Link>
          <Link href="/tickets/new" className="btn-accent text-xs py-1.5 px-3">+ New Ticket</Link>
        </div>
      </div>
    </div>
  );
}
