'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

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

export default function InvoiceListTable({
  invoices,
  customers,
  brokers,
}: {
  invoices: InvoiceRow[];
  customers: { id: string; name: string }[];
  brokers: { id: string; name: string }[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [nameFilter, setNameFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (typeFilter === 'CUSTOMER' && inv.invoiceType !== 'CUSTOMER') return false;
      if (typeFilter === 'BROKER' && inv.invoiceType !== 'BROKER') return false;
      if (nameFilter) {
        const q = nameFilter.toLowerCase();
        const matchName = inv.billedTo.toLowerCase().includes(q);
        const matchNum = String(inv.invoiceNumber).includes(q);
        if (!matchName && !matchNum) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, typeFilter, nameFilter]);

  async function handleStatusChange(invoiceId: string, newStatus: string) {
    setUpdatingId(invoiceId);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.set('id', invoiceId);
      fd.set('status', newStatus);
      const res = await fetch('/api/invoices/status', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to update status');
      } else {
        window.location.reload();
      }
    } catch {
      setActionError('Network error');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCancel(invoiceId: string) {
    if (!confirm('Cancel this invoice? Tickets will be released back to Ready to Bill.')) return;
    setUpdatingId(invoiceId);
    setActionError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to cancel invoice');
      } else {
        window.location.replace('/invoices?_t=' + Date.now());
      }
    } catch {
      setActionError('Network error');
    } finally {
      setUpdatingId(null);
    }
  }

  // Count by status for the filter pills
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: invoices.length };
    for (const inv of invoices) {
      c[inv.status] = (c[inv.status] || 0) + 1;
    }
    return c;
  }, [invoices]);

  return (
    <div className="panel overflow-hidden">
      {/* Filter bar */}
      <div className="px-5 py-3 border-b border-steel-200 space-y-3">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...ALL_STATUSES].map((s) => {
            const count = counts[s] || 0;
            if (s !== 'ALL' && count === 0) return null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-steel-800 text-white'
                    : 'bg-steel-100 text-steel-600 hover:bg-steel-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s} ({count})
              </button>
            );
          })}
        </div>

        {/* Search + type filter */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name or invoice #..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="input text-sm py-1.5 flex-1 max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input text-sm py-1.5 w-40"
          >
            <option value="ALL">All Types</option>
            <option value="CUSTOMER">Customer</option>
            <option value="BROKER">Broker</option>
          </select>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
          <span className="text-red-500 text-sm">&#9888;</span>
          <span className="text-sm text-red-700 flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-steel-500">
          {invoices.length === 0 ? 'No invoices yet.' : 'No invoices match the selected filters.'}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
            <tr>
              <th className="text-left px-5 py-2">#</th>
              <th className="text-left px-5 py-2">Type</th>
              <th className="text-left px-5 py-2">Billed To</th>
              <th className="text-left px-5 py-2">Period</th>
              <th className="text-right px-5 py-2">Tickets</th>
              <th className="text-right px-5 py-2">Total</th>
              <th className="text-left px-5 py-2">Status</th>
              <th className="text-right px-5 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => {
              const isBroker = inv.invoiceType === 'BROKER';
              const isCancelled = inv.status === 'CANCELLED';
              return (
                <tr
                  key={inv.id}
                  className={`border-b border-steel-100 hover:bg-steel-50 ${isCancelled ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-3 font-mono">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-safety-dark">
                      INV-{String(inv.invoiceNumber).padStart(4, '0')}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${isBroker ? 'bg-purple-100 text-purple-800' : 'bg-blue-50 text-blue-700'}`}>
                      {isBroker ? 'Broker' : 'Customer'}
                    </span>
                  </td>
                  <td className="px-5 py-3">{inv.billedTo}</td>
                  <td className="px-5 py-3 text-steel-600 text-xs">
                    {inv.periodStart} – {inv.periodEnd}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{inv.ticketCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">
                    ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3">
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
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isCancelled && (
                        <Link
                          href={`/invoices/${inv.id}/pdf`}
                          className="text-xs text-steel-600 hover:text-steel-900"
                          target="_blank"
                        >
                          PDF
                        </Link>
                      )}
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleCancel(inv.id)}
                          disabled={updatingId === inv.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
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

      <div className="px-5 py-2 border-t border-steel-200 text-xs text-steel-500">
        Showing {filtered.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
