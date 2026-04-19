'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fmtQty } from '@/lib/format';

interface Ticket {
  id: string;
  ticketNumber: number;
  date: string | null;
  completedAt: string | null;
  material: string | null;
  quantityType: string;
  quantity: number;
  hauledFrom: string;
  hauledTo: string;
  ratePerUnit: string | null;
  ticketRef: string | null;
  customer: string | null;
  driver: string | null;
  truckNumber: string | null;
  status: string;
}

interface TruckGroup {
  truckNumber: string;
  driverName: string;
  tickets: Ticket[];
  total: number;
}

interface Props {
  brokerId: string;
  brokerName: string;
  brokerEmail: string | null;
  commissionPct: number;
  companyName: string;
  dispatcherName: string;
  tickets: Ticket[];
  weekStart: string;
  weekEnd: string;
}

export function TripSheetView({
  brokerId,
  brokerName,
  brokerEmail,
  commissionPct,
  companyName,
  dispatcherName,
  tickets,
  weekStart,
  weekEnd,
}: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailTo, setEmailTo] = useState(brokerEmail ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedTruck, setExpandedTruck] = useState<string | null>(null);
  const [emailTruck, setEmailTruck] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [truckEmailTo, setTruckEmailTo] = useState(brokerEmail ?? '');

  const completedTickets = tickets.filter((t) => t.status === 'COMPLETED' && t.ratePerUnit);
  const totalRevenue = completedTickets.reduce(
    (sum, t) => sum + Number(t.ratePerUnit) * Number(t.quantity),
    0,
  );
  const totalCommission = totalRevenue * (commissionPct / 100);
  const totalQuantity = tickets.reduce((sum, t) => sum + Number(t.quantity), 0);

  // Group tickets by truck number
  const truckGroups: TruckGroup[] = useMemo(() => {
    const map = new Map<string, TruckGroup>();
    for (const t of tickets) {
      const key = t.truckNumber || '(No Truck)';
      if (!map.has(key)) {
        map.set(key, { truckNumber: key, driverName: t.driver ?? '(Unassigned)', tickets: [], total: 0 });
      }
      const g = map.get(key)!;
      g.tickets.push(t);
      const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
      g.total += rate * Number(t.quantity);
    }
    return Array.from(map.values());
  }, [tickets]);

  const allTruckNumbers = truckGroups.map((g) => g.truckNumber);
  const allSelected = allTruckNumbers.length > 0 && allTruckNumbers.every((t) => selected.has(t));

  function toggleTruck(truckNum: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(truckNum)) next.delete(truckNum);
      else next.add(truckNum);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allTruckNumbers));
  }

  function handleViewPdf(truckNumbers?: string[]) {
    const trucks = truckNumbers || Array.from(selected);
    if (trucks.length === 0) return;
    const url = `/api/brokers/${brokerId}/trip-sheet/truck-pdf?weekStart=${weekStart}&weekEnd=${weekEnd}&trucks=${encodeURIComponent(trucks.join(','))}`;
    window.open(url, '_blank');
  }

  async function handleTruckEmail(truckNumbers: string[]) {
    if (!truckEmailTo.trim() || truckNumbers.length === 0) return;
    setEmailSending(true);
    setEmailSent(null);
    setEmailError('');
    try {
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheet/truck-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd, to: truckEmailTo.trim(), trucks: truckNumbers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to send' }));
        throw new Error(data.error || 'Failed to send');
      }
      setEmailSent(truckNumbers.join(', '));
      setEmailTruck(null);
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  async function handleEmailAll() {
    if (!emailTo.trim()) return;
    setSending(true);
    setEmailError('');
    setSent(false);
    try {
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheet/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd, to: emailTo.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to send' }));
        throw new Error(data.error || 'Failed to send');
      }
      setSent(true);
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setSending(false);
    }
  }

  const pdfUrl = `/api/brokers/${brokerId}/trip-sheet/pdf?weekStart=${weekStart}&weekEnd=${weekEnd}`;
  const selectedCount = selected.size;
  const selectedTotal = truckGroups
    .filter((g) => selected.has(g.truckNumber))
    .reduce((sum, g) => sum + g.total, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Tickets</div>
          <div className="text-2xl font-bold tabular-nums">{tickets.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-bold tabular-nums">{completedTickets.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Total Qty</div>
          <div className="text-2xl font-bold tabular-nums">{totalQuantity}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Revenue</div>
          <div className="text-2xl font-bold tabular-nums">${totalRevenue.toFixed(2)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Commission ({commissionPct}%)</div>
          <div className="text-2xl font-bold tabular-nums text-red-700">${totalCommission.toFixed(2)}</div>
        </div>
      </div>

      {/* Bulk action bar */}
      {truckGroups.length > 1 && tickets.length > 0 && (
        <div className="panel p-3 flex items-center gap-3 flex-wrap bg-steel-50 border border-steel-200">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-steel-300 text-safety focus:ring-safety"
            />
            <span className="font-medium text-steel-700">Select All Trucks</span>
          </label>

          {selectedCount > 0 && (
            <>
              <span className="text-sm text-steel-500">
                {selectedCount} truck{selectedCount !== 1 ? 's' : ''} selected
                <span className="ml-1 font-semibold">(${selectedTotal.toFixed(2)})</span>
              </span>

              <button
                onClick={() => handleViewPdf()}
                className="btn-ghost text-sm inline-flex items-center gap-1"
              >
                View / Print Selected
              </button>

              <button
                onClick={() => {
                  setEmailTruck('__bulk__');
                  setTruckEmailTo(brokerEmail ?? '');
                }}
                className="btn-ghost text-sm inline-flex items-center gap-1"
              >
                Email Selected
              </button>
            </>
          )}
        </div>
      )}

      {/* Email modal for selected trucks */}
      {emailTruck && (
        <div className="panel p-4 border-2 border-safety bg-safety/5">
          <h3 className="text-sm font-semibold mb-2">
            Email Trip Sheet{emailTruck === '__bulk__' ? ` (${selectedCount} truck${selectedCount !== 1 ? 's' : ''})` : ` \u2014 ${emailTruck}`}
          </h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label text-xs">Email to</label>
              <input
                type="email"
                className="input"
                value={truckEmailTo}
                onChange={(e) => setTruckEmailTo(e.target.value)}
                placeholder="broker@example.com"
              />
            </div>
            <button
              onClick={() => {
                const trucks = emailTruck === '__bulk__' ? Array.from(selected) : [emailTruck];
                handleTruckEmail(trucks);
              }}
              disabled={emailSending || !truckEmailTo.trim()}
              className="btn-accent"
            >
              {emailSending ? 'Sending\u2026' : 'Send'}
            </button>
            <button onClick={() => setEmailTruck(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {emailSent && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          Sent trip sheet for {emailSent} to {truckEmailTo}!
          <button onClick={() => setEmailSent(null)} className="ml-2 text-green-500 hover:text-green-700">{'\u2715'}</button>
        </div>
      )}

      {/* Per-truck trip sheets */}
      {tickets.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">No tickets for this broker in the selected week.</div>
      ) : (
        <div className="space-y-4">
          {truckGroups.map((group) => {
            const isExpanded = expandedTruck === group.truckNumber || truckGroups.length === 1;
            const isSelected = selected.has(group.truckNumber);

            return (
              <div key={group.truckNumber} className={`panel overflow-hidden ${isSelected ? 'ring-2 ring-safety' : ''}`}>
                {/* Truck header */}
                <div className="px-5 py-3 border-b border-steel-200 bg-steel-50 flex items-center gap-3">
                  {truckGroups.length > 1 && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTruck(group.truckNumber)}
                      className="w-4 h-4 rounded border-steel-300 text-safety focus:ring-safety flex-shrink-0"
                    />
                  )}

                  <div
                    className="flex-1 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedTruck(isExpanded && truckGroups.length > 1 ? null : group.truckNumber)}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-xs text-steel-500 uppercase tracking-wider">Truck: </span>
                        <span className="font-bold text-steel-900">{group.truckNumber}</span>
                      </div>
                      <span className="text-steel-300">|</span>
                      <div>
                        <span className="text-xs text-steel-500 uppercase tracking-wider">Driver: </span>
                        <span className="font-semibold text-steel-800">{group.driverName}</span>
                      </div>
                      <span className="text-steel-300">|</span>
                      <span className="text-sm text-steel-500">{group.tickets.length} ticket{group.tickets.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums">${group.total.toFixed(2)}</span>
                      {truckGroups.length > 1 && (
                        <span className="text-steel-400 text-sm">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-truck action bar */}
                {isExpanded && (
                  <div className="px-5 py-2 bg-white border-b border-steel-100 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleViewPdf([group.truckNumber])}
                      className="text-xs px-3 py-1.5 bg-steel-100 text-steel-700 rounded-lg hover:bg-steel-200 transition-colors"
                    >
                      View / Print
                    </button>
                    <button
                      onClick={() => {
                        setEmailTruck(group.truckNumber);
                        setTruckEmailTo(brokerEmail ?? '');
                      }}
                      className="text-xs px-3 py-1.5 bg-steel-100 text-steel-700 rounded-lg hover:bg-steel-200 transition-colors"
                    >
                      Email
                    </button>
                  </div>
                )}

                {/* Ticket table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
                        <tr>
                          <th className="text-left px-4 py-2">Date</th>
                          <th className="text-left px-4 py-2">Customer Name</th>
                          <th className="text-left px-4 py-2">Hauled From</th>
                          <th className="text-left px-4 py-2">Hauled To</th>
                          <th className="text-left px-4 py-2">Ticket Number</th>
                          <th className="text-right px-4 py-2">Quantity</th>
                          <th className="text-right px-4 py-2">Rate</th>
                          <th className="text-left px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.tickets.map((t) => {
                          const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
                          const dateStr = t.date
                            ? format(new Date(t.date + 'T00:00:00'), 'MM/dd')
                            : t.completedAt
                              ? format(new Date(t.completedAt), 'MM/dd')
                              : '\u2014';
                          return (
                            <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                              <td className="px-4 py-2.5 text-steel-600">{dateStr}</td>
                              <td className="px-4 py-2.5">{t.customer || '\u2014'}</td>
                              <td className="px-4 py-2.5 text-steel-600">{t.hauledFrom}</td>
                              <td className="px-4 py-2.5 text-steel-600">{t.hauledTo}</td>
                              <td className="px-4 py-2.5 font-mono">
                                <a href={`/tickets/${t.id}`} className="hover:text-safety-dark">
                                  {t.ticketRef || `#${String(t.ticketNumber).padStart(4, '0')}`}
                                </a>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{fmtQty(t.quantity, t.quantityType)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">${rate.toFixed(2)}</td>
                              <td className="px-4 py-2.5">
                                <span className={`badge text-xs ${
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
                      <tfoot className="border-t-2 border-steel-300 font-semibold">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right">Total Due:</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {group.tickets.reduce((s, t) => s + Number(t.quantity), 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">${group.total.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Actions: Download All PDF + Email All */}
      <div className="panel p-5 space-y-4">
        <h2 className="font-semibold text-sm">Full Trip Sheet Actions</h2>

        <div className="flex flex-wrap items-end gap-4">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent inline-flex items-center gap-2"
          >
            Download Full PDF
          </a>

          <div className="flex items-end gap-2 flex-1 min-w-[300px]">
            <div className="flex-1">
              <label className="label text-xs" htmlFor="emailTo">Email full trip sheet to</label>
              <input
                id="emailTo"
                type="email"
                className="input"
                value={emailTo}
                onChange={(e) => { setEmailTo(e.target.value); setSent(false); }}
                placeholder="broker@example.com"
              />
            </div>
            <button
              type="button"
              onClick={handleEmailAll}
              disabled={sending || !emailTo.trim() || tickets.length === 0}
              className="btn-accent"
            >
              {sending ? 'Sending\u2026' : 'Email Full Trip Sheet'}
            </button>
          </div>
        </div>

        {sent && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            Full trip sheet emailed to {emailTo} successfully.
          </p>
        )}
        {emailError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {emailError}
          </p>
        )}

        {tickets.length === 0 && (
          <p className="text-sm text-steel-500 italic">
            Select a week with tickets to generate an invoice.
          </p>
        )}
      </div>
    </div>
  );
}
