'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { addTicketsToSheetAction } from '../actions';

interface Ticket {
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

interface Props {
  sheetId: string;
  availableTickets: Ticket[];
}

export function AddTicketsForm({ sheetId, availableTickets }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (availableTickets.length === 0) return null;

  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-safety-dark hover:underline">
        {open ? 'Cancel' : '+ Add more tickets'}
      </button>

      {open && (
        <form action={addTicketsToSheetAction} className="mt-3">
          <input type="hidden" name="sheetId" value={sheetId} />
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="ticketIds" value={id} />
          ))}

          <div className="panel overflow-hidden mb-3">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 sticky top-0 bg-white">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Customer</th>
                    <th className="text-left px-3 py-2">Driver</th>
                    <th className="text-left px-3 py-2">From / To</th>
                    <th className="text-left px-3 py-2">Ticket #</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {availableTickets.map((t) => {
                    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
                    const dateStr = t.date ? format(new Date(t.date + 'T00:00:00'), 'MM/dd') : '—';
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-steel-100 cursor-pointer ${selected.has(t.id) ? 'bg-safety/10' : 'hover:bg-steel-50'}`}
                        onClick={() => toggle(t.id)}
                      >
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} onClick={(e) => e.stopPropagation()} className="rounded border-steel-300" />
                        </td>
                        <td className="px-3 py-2">{dateStr}</td>
                        <td className="px-3 py-2">{t.customer || '—'}</td>
                        <td className="px-3 py-2">{t.driver || '—'}</td>
                        <td className="px-3 py-2 text-steel-600 text-xs">{t.hauledFrom} → {t.hauledTo}</td>
                        <td className="px-3 py-2 font-mono">{t.ticketRef || `#${String(t.ticketNumber).padStart(4, '0')}`}</td>
                        <td className="px-3 py-2 text-right">{t.quantityType === 'TONS' ? Number(t.quantity) : Math.round(Number(t.quantity))}</td>
                        <td className="px-3 py-2 text-right">${(rate * Number(t.quantity)).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button type="submit" disabled={selected.size === 0} className="btn-accent text-sm disabled:opacity-50">
            Add {selected.size} ticket{selected.size !== 1 ? 's' : ''}
          </button>
        </form>
      )}
    </div>
  );
}
