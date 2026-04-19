'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';

interface PreviewTicket {
  id: string;
  ticketNumber: number;
  date: string;
  driver: string;
  customer?: string;
  material: string;
  quantity: number;
  quantityType: string | null;
  rate: number;
  amount: number;
  truckNumber: string;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: number;
  invoiceType: string;
  status: string;
  billedTo: string;
  customerName: string | null;
  brokerName: string | null;
  periodStart: string;
  periodEnd: string;
  periodStartRaw: string;
  periodEndRaw: string;
  ticketCount: number;
  total: number;
  dueDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-steel-200 text-steel-800',
  SENT: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
};

const ALL_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

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

function periodsOverlap(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && a2 >= b1;
}

export default function InvoiceDashboard({
  invoices, customers, brokers, defaultPeriodStart, defaultPeriodEnd,
}: {
  invoices: InvoiceRow[];
  customers: { id: string; name: string }[];
  brokers: { id: string; name: string }[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [nameFilter, setNameFilter] = useState('');
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

  // Close dropdown on outside click
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

  // --- New Invoice inline creation ---
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvType, setNewInvType] = useState<'CUSTOMER' | 'BROKER'>('CUSTOMER');
  const [newInvEntityId, setNewInvEntityId] = useState('');
  const [newInvPeriodMode, setNewInvPeriodMode] = useState<'week' | 'month' | 'year' | 'custom'>('week');
  const [newInvAnchor, setNewInvAnchor] = useState<Date>(() => {
    const mon = getMonday(new Date()); mon.setDate(mon.getDate() - 7); return mon;
  });
  const [newInvCustomStart, setNewInvCustomStart] = useState(defaultPeriodStart);
  const [newInvCustomEnd, setNewInvCustomEnd] = useState(defaultPeriodEnd);
  const [newInvShowCal, setNewInvShowCal] = useState(false);
  const [newInvLoading, setNewInvLoading] = useState(false);
  const [newInvGenerating, setNewInvGenerating] = useState(false);
  const [newInvError, setNewInvError] = useState<string | null>(null);
  const [newInvPreview, setNewInvPreview] = useState<{
    billedTo: string; ticketCount: number; tickets: PreviewTicket[]; subtotal: number;
  } | null>(null);
  const [newInvSelectedTickets, setNewInvSelectedTickets] = useState<Set<string>>(new Set());
  const newInvFormDataRef = useRef<FormData | null>(null);

  const period = useMemo(() => {
    if (periodMode === 'custom') return { start: customStart, end: customEnd };
    return computePeriod(periodMode, anchor);
  }, [periodMode, anchor, customStart, customEnd]);

  const periodLabel = useMemo(() => {
    if (!period) return 'All Time';
    return formatPeriodLabel(periodMode, period.start, period.end);
  }, [periodMode, period]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (typeFilter === 'CUSTOMER' && inv.invoiceType !== 'CUSTOMER') return false;
      if (typeFilter === 'BROKER' && inv.invoiceType !== 'BROKER') return false;
      if (nameFilter) {
        const q = nameFilter.toLowerCase();
        if (!inv.billedTo.toLowerCase().includes(q) && !String(inv.invoiceNumber).includes(q)) return false;
      }
      if (period) {
        if (!periodsOverlap(inv.periodStartRaw, inv.periodEndRaw, period.start, period.end)) return false;
      }
      // Hide cancelled invoices on the "All" view — only show them when CANCELLED filter is active
      if (statusFilter === 'ALL' && inv.status === 'CANCELLED') return false;
      return true;
    });
  }, [invoices, statusFilter, typeFilter, nameFilter, period]);

  const filteredTotal = useMemo(() => filtered.reduce((s, inv) => s + inv.total, 0), [filtered]);
  const filteredIds = useMemo(() => new Set(filtered.map(i => i.id)), [filtered]);

  // Keep selection in sync with filtered results
  const activeSelected = useMemo(() => {
    const s = new Set<string>();
    selected.forEach(id => { if (filteredIds.has(id)) s.add(id); });
    return s;
  }, [selected, filteredIds]);

  const allSelected = filtered.length > 0 && activeSelected.size === filtered.length;
  const someSelected = activeSelected.size > 0;
  const selectedTotal = useMemo(
    () => filtered.filter(i => activeSelected.has(i.id)).reduce((s, i) => s + i.total, 0),
    [filtered, activeSelected],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0 };
    for (const inv of invoices) {
      c[inv.status] = (c[inv.status] || 0) + 1;
      if (inv.status !== 'CANCELLED') c.ALL += 1;
    }
    return c;
  }, [invoices]);

  function handleShift(delta: number) { setAnchor(prev => shiftAnchor(periodMode, prev, delta)); }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  }

  function clearSelection() { setSelected(new Set()); }

  // Single row actions
  async function handleStatusChange(invoiceId: string, newStatus: string) {
    setUpdatingId(invoiceId);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.set('id', invoiceId);
      fd.set('status', newStatus);
      const res = await fetch('/api/invoices/status', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Failed to update status');
      else window.location.reload();
    } catch { setActionError('Network error'); }
    finally { setUpdatingId(null); }
  }

  async function handleCancel(invoiceId: string) {
    if (!confirm('Cancel this invoice? Tickets will be released back to Ready to Bill.')) return;
    setUpdatingId(invoiceId);
    setActionError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Failed to cancel invoice');
      else window.location.replace('/invoices?_t=' + Date.now());
    } catch { setActionError('Network error'); }
    finally { setUpdatingId(null); }
  }

  // Bulk actions
  async function bulkStatusChange(status: string) {
    if (!confirm(`Change ${activeSelected.size} invoice(s) to ${status}?`)) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...activeSelected], action: 'status', status }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Bulk status change failed');
      else window.location.replace('/invoices?_t=' + Date.now());
    } catch { setActionError('Network error'); }
    finally { setBulkBusy(false); }
  }

  async function bulkCancel() {
    if (!confirm(`Cancel ${activeSelected.size} invoice(s)? Tickets will be released back to Ready to Bill.`)) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      const res = await fetch('/api/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...activeSelected], action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || 'Bulk cancel failed');
      else window.location.replace('/invoices?_t=' + Date.now());
    } catch { setActionError('Network error'); }
    finally { setBulkBusy(false); }
  }

  function bulkPrint() {
    const ids = [...activeSelected];
    // Open each PDF in a new tab
    ids.forEach(id => {
      window.open(`/invoices/${id}/pdf`, '_blank');
    });
  }

  function bulkExportCsv() {
    const rows = filtered.filter(i => activeSelected.has(i.id));
    const header = ['Invoice #', 'Type', 'Billed To', 'Period Start', 'Period End', 'Tickets', 'Total', 'Status'];
    const csvRows = [header.join(',')];
    for (const r of rows) {
      csvRows.push([
        `INV-${String(r.invoiceNumber).padStart(4, '0')}`,
        r.invoiceType,
        `"${r.billedTo}"`,
        r.periodStartRaw,
        r.periodEndRaw,
        r.ticketCount,
        r.total.toFixed(2),
        r.status,
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- New Invoice helpers ---
  const newInvPeriod = useMemo(() => {
    if (newInvPeriodMode === 'custom') return { start: newInvCustomStart, end: newInvCustomEnd };
    const p = computePeriod(newInvPeriodMode, newInvAnchor);
    return p ?? { start: defaultPeriodStart, end: defaultPeriodEnd };
  }, [newInvPeriodMode, newInvAnchor, newInvCustomStart, newInvCustomEnd, defaultPeriodStart, defaultPeriodEnd]);

  const newInvPeriodLabel = useMemo(() => {
    return formatPeriodLabel(newInvPeriodMode, newInvPeriod.start, newInvPeriod.end);
  }, [newInvPeriodMode, newInvPeriod]);

  function newInvShift(delta: number) {
    setNewInvAnchor(prev => shiftAnchor(newInvPeriodMode, prev, delta));
    setNewInvPreview(null);
  }

  function resetNewInvoice() {
    setShowNewInvoice(false);
    setNewInvType('CUSTOMER');
    setNewInvEntityId('');
    setNewInvPreview(null);
    setNewInvError(null);
    setNewInvSelectedTickets(new Set());
    setNewInvLoading(false);
    setNewInvGenerating(false);
    newInvFormDataRef.current = null;
  }

  async function handleNewInvLookup() {
    if (!newInvEntityId) {
      setNewInvError(`Please select a ${newInvType === 'CUSTOMER' ? 'customer' : 'broker'}.`);
      return;
    }
    setNewInvError(null);
    setNewInvPreview(null);
    setNewInvLoading(true);

    const fd = new FormData();
    fd.set('invoiceType', newInvType);
    fd.set(newInvType === 'CUSTOMER' ? 'customerId' : 'brokerId', newInvEntityId);
    fd.set('periodStart', newInvPeriod.start);
    fd.set('periodEnd', newInvPeriod.end);
    newInvFormDataRef.current = fd;

    try {
      const res = await fetch('/api/invoices/preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNewInvError(data.error || 'No results found.');
        return;
      }
      if (data.ticketCount === 0) {
        setNewInvError('No uninvoiced completed tickets found for the selected period.');
        return;
      }
      setNewInvPreview(data);
      // Select all tickets by default
      setNewInvSelectedTickets(new Set(data.tickets.map((t: PreviewTicket) => t.id)));
    } catch (err: any) {
      setNewInvError(err?.message || 'Something went wrong.');
    } finally {
      setNewInvLoading(false);
    }
  }

  function toggleNewInvTicket(id: string) {
    setNewInvSelectedTickets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleNewInvAllTickets() {
    if (!newInvPreview) return;
    if (newInvSelectedTickets.size === newInvPreview.tickets.length) {
      setNewInvSelectedTickets(new Set());
    } else {
      setNewInvSelectedTickets(new Set(newInvPreview.tickets.map(t => t.id)));
    }
  }

  const newInvSelectedTotal = useMemo(() => {
    if (!newInvPreview) return 0;
    return newInvPreview.tickets
      .filter(t => newInvSelectedTickets.has(t.id))
      .reduce((s, t) => s + t.amount, 0);
  }, [newInvPreview, newInvSelectedTickets]);

  async function handleNewInvGenerate() {
    if (!newInvFormDataRef.current || newInvSelectedTickets.size === 0) return;
    setNewInvError(null);
    setNewInvGenerating(true);

    // Clone form data and add selected ticket IDs
    const fd = new FormData();
    newInvFormDataRef.current.forEach((val, key) => fd.set(key, val));

    try {
      const res = await fetch('/api/invoices/generate', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNewInvError(data.error || 'Failed to generate invoice.');
        setNewInvGenerating(false);
        return;
      }
      window.location.replace('/invoices?_t=' + Date.now());
    } catch (err: any) {
      setNewInvError(err?.message || 'Something went wrong.');
      setNewInvGenerating(false);
    }
  }

  const newInvPeriodModes: { value: 'week' | 'month' | 'year' | 'custom'; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom' },
  ];

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
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...ALL_STATUSES].map((s) => {
            const count = counts[s] || 0;
            if (s !== 'ALL' && count === 0) return null;
            // Only show CANCELLED pill when a specific name is searched
            if (s === 'CANCELLED' && !nameFilter.trim()) return null;
            return (
              <button key={s} onClick={() => { setStatusFilter(s); clearSelection(); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? 'bg-steel-800 text-white' : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
                }`}>
                {s === 'ALL' ? 'All' : s} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 flex-wrap items-end">
          <div ref={dropdownRef} className="flex-1 min-w-[200px] max-w-xs relative">
            <input type="text" placeholder="Search by name or invoice #..."
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
                        onClick={() => { setNameFilter(c.name); setTypeFilter('CUSTOMER'); setShowNameDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {brokers.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Brokers</div>
                    {brokers.map(b => (
                      <button key={b.id} type="button"
                        onClick={() => { setNameFilter(b.name); setTypeFilter('BROKER'); setShowNameDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showNameDropdown && nameFilter.length > 0 && (() => {
              const q = nameFilter.toLowerCase();
              const matchedCustomers = customers.filter(c => c.name.toLowerCase().includes(q));
              const matchedBrokers = brokers.filter(b => b.name.toLowerCase().includes(q));
              if (matchedCustomers.length === 0 && matchedBrokers.length === 0) return null;
              return (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-steel-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {matchedCustomers.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Customers</div>
                      {matchedCustomers.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setNameFilter(c.name); setTypeFilter('CUSTOMER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedBrokers.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-steel-400 uppercase tracking-wide bg-steel-50">Brokers</div>
                      {matchedBrokers.map(b => (
                        <button key={b.id} type="button"
                          onClick={() => { setNameFilter(b.name); setTypeFilter('BROKER'); setShowNameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-steel-50 transition-colors">
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="input text-sm py-1.5 w-36">
            <option value="ALL">All Types</option>
            <option value="CUSTOMER">Customer</option>
            <option value="BROKER">Broker</option>
          </select>
          {nameFilter && (
            <button type="button" onClick={() => { setNameFilter(''); setTypeFilter('ALL'); setStatusFilter('ALL'); setPeriodMode('all'); setShowCalendar(false); clearSelection(); }}
              className="text-xs text-steel-500 hover:text-steel-800 py-1.5">
              Clear
            </button>
          )}
        </div>

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

      {/* New Invoice inline panel */}
      {showNewInvoice && (
        <div className="px-5 py-5 border-b border-steel-200 bg-steel-50/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-steel-800">New Invoice</h3>
            <button type="button" onClick={resetNewInvoice}
              className="text-xs text-steel-500 hover:text-steel-800">&times; Close</button>
          </div>

          {/* Error */}
          {newInvError && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-red-500 text-lg leading-none mt-0.5">&#9888;</span>
              <p className="text-sm text-red-700 flex-1">{newInvError}</p>
              <button type="button" onClick={() => setNewInvError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
            </div>
          )}

          {/* Step 1: Pick type + entity + period */}
          {!newInvPreview && (
            <div className="space-y-4">
              {/* Type toggle */}
              <div className="flex gap-1 bg-steel-100 rounded-lg p-1 w-fit">
                <button type="button"
                  onClick={() => { setNewInvType('CUSTOMER'); setNewInvEntityId(''); setNewInvPreview(null); setNewInvError(null); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    newInvType === 'CUSTOMER' ? 'bg-white shadow text-steel-900' : 'text-steel-500 hover:text-steel-700'
                  }`}>Customer</button>
                <button type="button"
                  onClick={() => { setNewInvType('BROKER'); setNewInvEntityId(''); setNewInvPreview(null); setNewInvError(null); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    newInvType === 'BROKER' ? 'bg-white shadow text-steel-900' : 'text-steel-500 hover:text-steel-700'
                  }`}>Broker</button>
              </div>

              {/* Entity selector */}
              <div className="max-w-sm">
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  {newInvType === 'CUSTOMER' ? 'Customer' : 'Broker'}
                </label>
                <select value={newInvEntityId}
                  onChange={(e) => { setNewInvEntityId(e.target.value); setNewInvPreview(null); }}
                  className="input text-sm w-full">
                  <option value="">-- Select {newInvType === 'CUSTOMER' ? 'Customer' : 'Broker'} --</option>
                  {(newInvType === 'CUSTOMER' ? customers : brokers).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              {/* Period picker */}
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">Service Period</label>
                <div className="flex gap-1 mb-2 bg-steel-100 rounded-md p-0.5 w-fit border border-steel-200">
                  {newInvPeriodModes.map((m) => (
                    <button key={m.value} type="button"
                      onClick={() => { setNewInvPeriodMode(m.value); setNewInvShowCal(false); setNewInvPreview(null); }}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        newInvPeriodMode === m.value ? 'bg-white shadow-sm text-steel-900' : 'text-steel-500 hover:text-steel-700'
                      }`}>{m.label}</button>
                  ))}
                </div>

                {newInvPeriodMode !== 'custom' ? (
                  <div className="flex items-center gap-2 max-w-md">
                    <button type="button" onClick={() => newInvShift(-1)}
                      className="px-2.5 py-1.5 rounded border border-steel-300 hover:bg-steel-50 text-sm font-bold">&#8592;</button>
                    <button type="button" onClick={() => setNewInvShowCal(!newInvShowCal)}
                      className="flex-1 text-center text-sm font-medium py-1.5 px-3 rounded border border-steel-300 hover:bg-steel-50 cursor-pointer">
                      {newInvPeriodLabel}
                    </button>
                    <button type="button" onClick={() => newInvShift(1)}
                      className="px-2.5 py-1.5 rounded border border-steel-300 hover:bg-steel-50 text-sm font-bold">&#8594;</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 max-w-md">
                    <input type="date" className="input text-sm flex-1" value={newInvCustomStart}
                      onChange={(e) => { setNewInvCustomStart(e.target.value); setNewInvPreview(null); }} />
                    <span className="text-steel-400 text-sm">to</span>
                    <input type="date" className="input text-sm flex-1" value={newInvCustomEnd}
                      onChange={(e) => { setNewInvCustomEnd(e.target.value); setNewInvPreview(null); }} />
                  </div>
                )}

                {newInvShowCal && newInvPeriodMode !== 'custom' && (
                  <div className="mt-2 p-3 rounded-lg border border-steel-200 bg-white shadow-lg max-w-xs">
                    <p className="text-xs text-steel-500 mb-2">Pick a date to jump to that {newInvPeriodMode}</p>
                    <input type="date" className="input text-sm" value={fmtDate(newInvAnchor)}
                      onChange={(e) => { if (e.target.value) { setNewInvAnchor(new Date(e.target.value + 'T00:00:00')); setNewInvShowCal(false); setNewInvPreview(null); } }} />
                  </div>
                )}
              </div>

              {/* Look Up button */}
              <button type="button" onClick={handleNewInvLookup} disabled={newInvLoading || !newInvEntityId}
                className="btn-accent text-sm py-2 px-4 disabled:opacity-50">
                {newInvLoading ? 'Looking up...' : 'Look Up Tickets'}
              </button>
            </div>
          )}

          {/* Step 2: Preview tickets with checkboxes */}
          {newInvPreview && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium">{newInvPreview.billedTo}</span>
                  <span className="text-steel-500 text-sm ml-2">{newInvPeriodLabel}</span>
                  <span className="text-steel-500 text-sm ml-2">
                    &middot; {newInvPreview.ticketCount} ticket{newInvPreview.ticketCount !== 1 ? 's' : ''} available
                  </span>
                </div>
                <button type="button" onClick={() => { setNewInvPreview(null); setNewInvError(null); setNewInvSelectedTickets(new Set()); }}
                  className="text-sm text-steel-500 hover:text-steel-800">&#8592; Change selection</button>
              </div>

              <div className="overflow-hidden rounded-lg border border-steel-200 mb-4 bg-white">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input type="checkbox"
                          checked={newInvSelectedTickets.size === newInvPreview.tickets.length && newInvPreview.tickets.length > 0}
                          ref={(el) => { if (el) el.indeterminate = newInvSelectedTickets.size > 0 && newInvSelectedTickets.size < newInvPreview.tickets.length; }}
                          onChange={toggleNewInvAllTickets}
                          className="rounded border-steel-300 cursor-pointer" />
                      </th>
                      <th className="text-left px-3 py-2">Ticket</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Driver</th>
                      {newInvType === 'BROKER' && <th className="text-left px-3 py-2">Customer</th>}
                      <th className="text-left px-3 py-2">Material</th>
                      <th className="text-left px-3 py-2">Truck</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Rate</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newInvPreview.tickets.map((t) => {
                      const isTicketSelected = newInvSelectedTickets.has(t.id);
                      return (
                        <tr key={t.id} className={`border-b border-steel-100 ${isTicketSelected ? '' : 'opacity-40'}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={isTicketSelected}
                              onChange={() => toggleNewInvTicket(t.id)}
                              className="rounded border-steel-300 cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">#{String(t.ticketNumber).padStart(4, '0')}</td>
                          <td className="px-3 py-2 text-steel-600">{t.date}</td>
                          <td className="px-3 py-2">{t.driver}</td>
                          {newInvType === 'BROKER' && <td className="px-3 py-2">{t.customer}</td>}
                          <td className="px-3 py-2">{t.material}</td>
                          <td className="px-3 py-2">{t.truckNumber}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{t.quantity.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">${t.rate.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">${t.amount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-steel-50">
                    <tr className="border-t-2 border-steel-300">
                      <td colSpan={newInvType === 'BROKER' ? 9 : 8} className="px-3 py-2 text-right font-bold text-sm">
                        {newInvSelectedTickets.size} of {newInvPreview.tickets.length} selected &middot; Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-sm">
                        ${newInvSelectedTotal.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={handleNewInvGenerate}
                  disabled={newInvGenerating || newInvSelectedTickets.size === 0}
                  className="btn-accent text-sm py-2 px-4 disabled:opacity-50">
                  {newInvGenerating ? 'Generating...' : `Generate Invoice ($${newInvSelectedTotal.toFixed(2)})`}
                </button>
                <button type="button" onClick={resetNewInvoice} className="btn-ghost text-sm py-2 px-4">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-blue-900">
            {activeSelected.size} selected
            <span className="text-blue-600 ml-1.5">
              (${selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          </span>

          <div className="h-4 w-px bg-blue-200" />

          {/* Bulk status */}
          <select
            defaultValue=""
            disabled={bulkBusy}
            onChange={(e) => { if (e.target.value) { bulkStatusChange(e.target.value); e.target.value = ''; } }}
            className="text-xs border border-blue-300 rounded px-2 py-1 bg-white cursor-pointer"
          >
            <option value="" disabled>Change Status...</option>
            {ALL_STATUSES.filter(s => s !== 'CANCELLED').map(s => (
              <option key={s} value={s}>Mark {s}</option>
            ))}
          </select>

          <button type="button" onClick={bulkPrint} disabled={bulkBusy}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50 px-2 py-1 rounded hover:bg-blue-100">
            Print PDFs
          </button>

          <button type="button" onClick={bulkExportCsv} disabled={bulkBusy}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50 px-2 py-1 rounded hover:bg-blue-100">
            Export CSV
          </button>

          <button type="button" onClick={bulkCancel} disabled={bulkBusy}
            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-red-50">
            Cancel Selected
          </button>

          <div className="h-4 w-px bg-blue-200" />

          <button type="button" onClick={clearSelection}
            className="text-xs text-blue-500 hover:text-blue-700">
            Clear selection
          </button>
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
          {invoices.length === 0 ? 'No invoices yet.' : 'No invoices match your filters.'}
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
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Billed To</th>
              <th className="text-left px-3 py-2">Period</th>
              <th className="text-right px-3 py-2">Tickets</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => {
              const isBroker = inv.invoiceType === 'BROKER';
              const isCancelled = inv.status === 'CANCELLED';
              const isSelected = activeSelected.has(inv.id);
              return (
                <tr
                  key={inv.id}
                  className={`border-b border-steel-100 hover:bg-steel-50 ${isCancelled ? 'opacity-60' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(inv.id)}
                      className="rounded border-steel-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3 font-mono">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-safety-dark">
                      INV-{String(inv.invoiceNumber).padStart(4, '0')}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`badge ${isBroker ? 'bg-purple-100 text-purple-800' : 'bg-blue-50 text-blue-700'}`}>
                      {isBroker ? 'Broker' : 'Customer'}
                    </span>
                  </td>
                  <td className="px-3 py-3">{inv.billedTo}</td>
                  <td className="px-3 py-3 text-steel-600 text-xs">
                    {inv.periodStart} – {inv.periodEnd}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{inv.ticketCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">
                    ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3">
                    {isCancelled ? (
                      <span className={`badge ${STATUS_COLORS.CANCELLED}`}>CANCELLED</span>
                    ) : (
                      <select
                        value={inv.status}
                        disabled={updatingId === inv.id}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                        className="text-xs border border-steel-200 rounded px-2 py-1 bg-white cursor-pointer"
                      >
                        {ALL_STATUSES.filter(s => s !== 'CANCELLED').map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isCancelled && (
                        <Link href={`/invoices/${inv.id}/pdf`}
                          className="text-xs text-steel-600 hover:text-steel-900" target="_blank">
                          PDF
                        </Link>
                      )}
                      <Link href={`/invoices/${inv.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800">
                        Edit
                      </Link>
                      {!isCancelled && (
                        <button type="button" onClick={() => handleCancel(inv.id)}
                          disabled={updatingId === inv.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                          {updatingId === inv.id ? '...' : 'Cancel'}
                        </button>
                      )}
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
          Showing {filtered.length} of {statusFilter === 'CANCELLED' ? invoices.filter(i => i.status === 'CANCELLED').length : invoices.filter(i => i.status !== 'CANCELLED').length} invoice{(statusFilter === 'CANCELLED' ? invoices.filter(i => i.status === 'CANCELLED').length : invoices.filter(i => i.status !== 'CANCELLED').length) !== 1 ? 's' : ''}
          {filtered.length > 0 && (
            <span className="ml-3 font-medium text-steel-700">
              Total: ${filteredTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </span>
        <button type="button" onClick={() => { setShowNewInvoice(true); setNewInvError(null); }}
          className="btn-accent text-xs py-1.5 px-3">
          + New Invoice
        </button>
      </div>
    </div>
  );
}
