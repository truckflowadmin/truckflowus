'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fmtQty, qtyUnit } from '@/lib/format';

interface Ticket {
  id: string;
  ticketNumber: number;
  ticketRef: string | null;
  date: string | null;
  customer: string | null;
  driver: string | null;
  truckNumber: string | null;
  material: string | null;
  quantity: number;
  quantityType: string;
  hauledFrom: string;
  hauledTo: string;
  ratePerUnit: string | null;
  currentBroker: string | null;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  brokerId: string;
  tickets: Ticket[];
}

export function TicketSelector({ action, brokerId, tickets }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekEnding, setWeekEnding] = useState('');
  const [filter, setFilter] = useState('');

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
      t.ticketRef?.toLowerCase().includes(q)
    );
  });

  const selectedTotal = tickets
    .filter((t) => selected.has(t.id))
    .reduce((sum, t) => sum + (t.ratePerUnit ? Number(t.ratePerUnit) : 0) * t.quantity, 0);

  return (
    <form action={action}>
      <input type="hidden" name="brokerId" value={brokerId} />
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="ticketIds" value={id} />
      ))}

      {/* Week ending + filter */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="label text-xs" htmlFor="weekEnding">Week Ending *</label>
          <input
            id="weekEnding"
            name="weekEnding"
            type="date"
            required
            className="input"
            value={weekEnding}
            onChange={(e) => setWeekEnding(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label text-xs" htmlFor="filter">Search tickets</label>
          <input
            id="filter"
            type="text"
            className="input"
            placeholder="Filter by customer, driver, material..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="text-sm font-semibold tabular-nums">
          {selected.size} selected · ${selectedTotal.toFixed(2)}
        </div>
      </div>

      {/* Ticket table */}
      <div className="panel overflow-hidden mb-4">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-steel-500">
            No completed tickets available. Complete some tickets first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((t) => selected.has(t.id))}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="rounded border-steel-300"
                    />
                  </th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">Driver / Truck</th>
                  <th className="text-left px-3 py-2">Hauled From</th>
                  <th className="text-left px-3 py-2">Hauled To</th>
                  <th className="text-left px-3 py-2">Ticket #</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-left px-3 py-2">Broker</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
                  const amount = rate * t.quantity;
                  const dateStr = t.date ? format(new Date(t.date + 'T00:00:00'), 'MM/dd/yy') : '—';
                  const isSelected = selected.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-steel-100 cursor-pointer ${isSelected ? 'bg-safety/10' : 'hover:bg-steel-50'}`}
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
                      <td className="px-3 py-2.5 text-steel-600">{dateStr}</td>
                      <td className="px-3 py-2.5">{t.customer || '—'}</td>
                      <td className="px-3 py-2.5">
                        {t.driver || '—'}
                        {t.truckNumber && <span className="text-steel-400 ml-1">({t.truckNumber})</span>}
                      </td>
                      <td className="px-3 py-2.5 text-steel-600 max-w-[120px] truncate">{t.hauledFrom}</td>
                      <td className="px-3 py-2.5 text-steel-600 max-w-[120px] truncate">{t.hauledTo}</td>
                      <td className="px-3 py-2.5 font-mono">{t.ticketRef || `#${String(t.ticketNumber).padStart(4, '0')}`}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(t.quantity, t.quantityType)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">${rate.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">${amount.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-xs text-steel-500">{t.currentBroker || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={selected.size === 0 || !weekEnding}
          className="btn-accent disabled:opacity-50"
        >
          Create Trip Sheet ({selected.size} tickets · ${selectedTotal.toFixed(2)})
        </button>
        <span className="text-sm text-steel-500">
          Select completed tickets and a week ending date to create the trip sheet.
        </span>
      </div>
    </form>
  );
}
