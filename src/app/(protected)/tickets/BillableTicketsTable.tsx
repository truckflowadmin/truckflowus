'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtQty, qtyUnit } from '@/lib/format';
import {
  createTripSheetFromTicketsAction,
  createInvoiceFromTicketsAction,
  addTicketsToExistingTripSheetAction,
  addTicketsToExistingInvoiceAction,
} from './billingActions';

interface BillableTicket {
  id: string;
  ticketNumber: number;
  date: string | null;
  completedAt: string | null;
  customer: string | null;
  customerId: string | null;
  driver: string | null;
  broker: string | null;
  brokerId: string | null;
  material: string | null;
  quantity: number;
  quantityType: string;
  hauledFrom: string;
  hauledTo: string;
  ratePerUnit: string | null;
  ticketRef: string | null;
}

interface ExistingTripSheet {
  id: string;
  brokerId: string;
  brokerName: string;
  weekEnding: string;
  totalDue: number;
}

interface ExistingInvoice {
  id: string;
  invoiceNumber: number;
  customerId: string | null;
  customerName: string;
  total: number;
}

interface Props {
  tickets: BillableTicket[];
  existingTripSheets?: ExistingTripSheet[];
  existingInvoices?: ExistingInvoice[];
}

export default function BillableTicketsTable({
  tickets,
  existingTripSheets = [],
  existingInvoices = [],
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [weekEnding, setWeekEnding] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTripSheet, setSelectedTripSheet] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState('');

  const filtered = tickets.filter((t) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      t.customer?.toLowerCase().includes(q) ||
      t.driver?.toLowerCase().includes(q) ||
      t.material?.toLowerCase().includes(q) ||
      t.hauledFrom.toLowerCase().includes(q) ||
      t.hauledTo.toLowerCase().includes(q) ||
      String(t.ticketNumber).includes(q) ||
      t.broker?.toLowerCase().includes(q) ||
      t.ticketRef?.toLowerCase().includes(q)
    );
  });

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(filtered.map((t) => t.id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Analyze selected tickets
  const selectedTickets = tickets.filter((t) => selected.has(t.id));
  const selectedTotal = selectedTickets.reduce(
    (sum, t) => sum + (t.ratePerUnit ? Number(t.ratePerUnit) : 0) * t.quantity,
    0
  );

  // Group by broker vs no-broker
  const withBroker = selectedTickets.filter((t) => t.brokerId);
  const withoutBroker = selectedTickets.filter((t) => !t.brokerId);

  // Check if all broker tickets share the same broker
  const uniqueBrokers = [...new Set(withBroker.map((t) => t.brokerId))];
  const uniqueCustomers = [...new Set(withoutBroker.map((t) => t.customerId).filter(Boolean))];

  // Determine what actions are available
  const canCreateTripSheet = withBroker.length > 0 && withoutBroker.length === 0 && uniqueBrokers.length === 1;
  const canCreateInvoice = withoutBroker.length > 0 && withBroker.length === 0 && uniqueCustomers.length === 1;
  const hasMixedSelection = withBroker.length > 0 && withoutBroker.length > 0;
  const hasMultipleBrokers = uniqueBrokers.length > 1;
  const hasMultipleCustomers = uniqueCustomers.length > 1;

  async function handleTripSheet() {
    setSubmitting(true);
    try {
      const fd = new FormData();
      selectedTickets.forEach((t) => fd.append('ticketIds', t.id));
      fd.set('weekEnding', weekEnding);
      await createTripSheetFromTicketsAction(fd);
    } catch (e: any) {
      alert(e.message || 'Failed to create trip sheet');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvoice() {
    setSubmitting(true);
    try {
      const fd = new FormData();
      selectedTickets.forEach((t) => fd.append('ticketIds', t.id));
      fd.set('taxRate', taxRate);
      await createInvoiceFromTicketsAction(fd);
    } catch (e: any) {
      alert(e.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToTripSheet() {
    if (!selectedTripSheet) return;
    setSubmitting(true);
    try {
      const result = await addTicketsToExistingTripSheetAction(
        selectedTickets.map((t) => t.id),
        selectedTripSheet,
      );
      window.location.reload();
    } catch (e: any) {
      alert(e.message || 'Failed to add tickets to trip sheet');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToInvoice() {
    if (!selectedInvoice) return;
    setSubmitting(true);
    try {
      const result = await addTicketsToExistingInvoiceAction(
        selectedTickets.map((t) => t.id),
        selectedInvoice,
      );
      window.location.reload();
    } catch (e: any) {
      alert(e.message || 'Failed to add tickets to invoice');
    } finally {
      setSubmitting(false);
    }
  }

  // Filter existing trip sheets/invoices to match selected broker/customer
  const matchingTripSheets = canCreateTripSheet
    ? existingTripSheets.filter((s) => s.brokerId === uniqueBrokers[0])
    : [];
  const matchingInvoices = canCreateInvoice
    ? existingInvoices.filter((inv) => inv.customerId === uniqueCustomers[0])
    : [];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          className="input flex-1 min-w-[200px]"
          placeholder="Filter by customer, driver, broker, material…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="text-sm text-steel-500">
          {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} ready to bill
        </div>
      </div>

      {/* Ticket table */}
      <div className="panel overflow-hidden mb-4">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-steel-500">
            No completed &amp; reviewed tickets available for billing.
            <br />
            <span className="text-xs">
              Tickets must be COMPLETED, reviewed by dispatcher, and not already on an invoice or trip sheet.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((t) => selected.has(t.id))}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="rounded border-steel-300"
                    />
                  </th>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">Driver</th>
                  <th className="text-left px-3 py-2">Broker</th>
                  <th className="text-left px-3 py-2">Material</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
                  const amount = rate * t.quantity;
                  const isSelected = selected.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-steel-100 cursor-pointer transition-colors ${
                        isSelected ? 'bg-safety/10' : 'hover:bg-steel-50'
                      }`}
                      onClick={() => toggle(t.id)}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(t.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-steel-300"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="text-steel-900 hover:text-safety-dark"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{String(t.ticketNumber).padStart(4, '0')}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-steel-600 text-xs">
                        {t.date
                          ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">{t.customer || '—'}</td>
                      <td className="px-3 py-2.5">{t.driver || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {t.broker ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {t.broker}
                          </span>
                        ) : (
                          <span className="text-steel-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">{t.material || '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {fmtQty(t.quantity, t.quantityType)} {qtyUnit(t.quantityType)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {rate > 0 ? `$${rate.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {amount > 0 ? `$${amount.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {selected.size > 0 && (
                <tfoot className="border-t-2 border-steel-300 bg-steel-50">
                  <tr>
                    <td colSpan={9} className="px-3 py-2 text-right text-sm font-semibold">
                      Selected Total ({selected.size} ticket{selected.size !== 1 ? 's' : ''})
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-base">
                      ${selectedTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="panel p-4 sticky bottom-4 shadow-lg border-2 border-safety/30 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold mb-1">
                {selected.size} ticket{selected.size !== 1 ? 's' : ''} selected · ${selectedTotal.toFixed(2)}
              </div>

              {hasMixedSelection && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  You've selected tickets with and without brokers. Please select only broker tickets (for trip sheet) or only non-broker tickets (for invoice).
                </p>
              )}
              {hasMultipleBrokers && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Selected tickets belong to different brokers. Select tickets for one broker at a time.
                </p>
              )}
              {hasMultipleCustomers && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Selected tickets belong to different customers. Select tickets for one customer at a time.
                </p>
              )}
            </div>

            {/* Trip Sheet actions */}
            {canCreateTripSheet && (
              <div className="flex flex-col gap-2">
                {/* Create new trip sheet */}
                <div className="flex items-end gap-2">
                  <div>
                    <label className="label text-xs">Week Ending</label>
                    <input
                      type="date"
                      className="input text-sm"
                      value={weekEnding}
                      onChange={(e) => setWeekEnding(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    onClick={handleTripSheet}
                    disabled={submitting || !weekEnding}
                    className="btn-accent disabled:opacity-50 whitespace-nowrap"
                  >
                    {submitting ? 'Creating…' : `New Trip Sheet → ${withBroker[0]?.broker}`}
                  </button>
                </div>
                {/* Add to existing trip sheet */}
                {matchingTripSheets.length > 0 && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label text-xs">Add to Existing Trip Sheet</label>
                      <select
                        className="input text-sm w-full"
                        value={selectedTripSheet}
                        onChange={(e) => setSelectedTripSheet(e.target.value)}
                      >
                        <option value="">Select trip sheet…</option>
                        {matchingTripSheets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.brokerName} — Week ending {new Date(s.weekEnding).toLocaleDateString()} (${s.totalDue.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddToTripSheet}
                      disabled={submitting || !selectedTripSheet}
                      className="btn-ghost border-safety text-safety-dark disabled:opacity-50 whitespace-nowrap text-sm"
                    >
                      {submitting ? 'Adding…' : `Add ${selected.size} to Sheet`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Invoice actions */}
            {canCreateInvoice && (
              <div className="flex flex-col gap-2">
                {/* Create new invoice */}
                <div className="flex items-end gap-2">
                  <div>
                    <label className="label text-xs">Tax %</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="input text-sm w-20"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleInvoice}
                    disabled={submitting}
                    className="btn-accent disabled:opacity-50 whitespace-nowrap"
                  >
                    {submitting
                      ? 'Creating…'
                      : `New Invoice → ${withoutBroker[0]?.customer || 'Customer'}`}
                  </button>
                </div>
                {/* Add to existing invoice */}
                {matchingInvoices.length > 0 && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label text-xs">Add to Existing Invoice</label>
                      <select
                        className="input text-sm w-full"
                        value={selectedInvoice}
                        onChange={(e) => setSelectedInvoice(e.target.value)}
                      >
                        <option value="">Select invoice…</option>
                        {matchingInvoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            Invoice #{inv.invoiceNumber} — {inv.customerName} (${inv.total.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddToInvoice}
                      disabled={submitting || !selectedInvoice}
                      className="btn-ghost border-safety text-safety-dark disabled:opacity-50 whitespace-nowrap text-sm"
                    >
                      {submitting ? 'Adding…' : `Add ${selected.size} to Invoice`}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSelected(new Set())}
              className="btn-ghost text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
