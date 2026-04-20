'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';

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

interface TruckGroup {
  truckNumber: string;
  driverName: string;
  tickets: TicketRow[];
  total: number;
}

interface Props {
  sheetId: string;
  brokerId: string;
  brokerEmail: string | null;
  companyName: string;
  status: string;
  tickets: TicketRow[];
  isDraft: boolean;
  removeAction: (formData: FormData) => Promise<void>;
  updateStatusAction: (formData: FormData) => Promise<void>;
  fullPdfUrl: string;
}

export function TruckSheetManager({
  sheetId,
  brokerId,
  brokerEmail,
  companyName,
  status,
  tickets,
  isDraft,
  removeAction,
  updateStatusAction,
  fullPdfUrl,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedTruck, setExpandedTruck] = useState<string | null>(null);
  const [emailTruck, setEmailTruck] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState(brokerEmail ?? '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  // Preview state
  const [previewBody, setPreviewBody] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Group tickets by truck number
  const truckGroups: TruckGroup[] = useMemo(() => {
    const map = new Map<string, TruckGroup>();
    for (const t of tickets) {
      const key = t.truckNumber || '(No Truck)';
      if (!map.has(key)) {
        map.set(key, { truckNumber: key, driverName: t.driverName, tickets: [], total: 0 });
      }
      const g = map.get(key)!;
      g.tickets.push(t);
      g.total += t.ratePerUnit * t.quantity;
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
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allTruckNumbers));
    }
  }

  function formatDate(dateStr: string | null, fallback: string | null): string {
    if (!dateStr && !fallback) return '\u2014';
    const d = new Date(dateStr || fallback!);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  // View / Print PDF for selected trucks
  function handleViewPdf(truckNumbers?: string[]) {
    const trucks = truckNumbers || Array.from(selected);
    if (trucks.length === 0) return;
    const url = `/api/brokers/${brokerId}/trip-sheets/${sheetId}/truck-pdf?trucks=${encodeURIComponent(trucks.join(','))}`;
    window.open(url, '_blank');
  }

  // Fetch email preview
  async function fetchPreview(truckNumbers: string[] | 'full') {
    setPreviewLoading(true);
    setError('');
    try {
      const trucks = truckNumbers === 'full' ? undefined : truckNumbers;
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheets/${sheetId}/email-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trucks }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewSubject(data.subject);
        setPreviewBody(data.text);
        setShowPreview(true);
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to load preview' }));
        setError(data.error || 'Failed to load preview');
      }
    } catch {
      setError('Failed to load preview');
    }
    setPreviewLoading(false);
  }

  // Email selected trucks (per-truck API) or full sheet
  async function handleEmail(truckNumbers: string[] | 'full') {
    if (!emailTo.trim()) return;
    setEmailSending(true);
    setError('');
    setEmailSent(null);
    try {
      let res: Response;
      if (truckNumbers === 'full') {
        // Full sheet email
        res = await fetch(`/api/brokers/${brokerId}/trip-sheets/${sheetId}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: emailTo.trim(), customBody: previewBody || undefined }),
        });
      } else {
        if (truckNumbers.length === 0) return;
        res = await fetch(`/api/brokers/${brokerId}/trip-sheets/${sheetId}/truck-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: emailTo.trim(), trucks: truckNumbers, customBody: previewBody || undefined }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to send' }));
        throw new Error(data.error || 'Failed to send');
      }
      setEmailSent(truckNumbers === 'full' ? 'Full Trip Sheet' : truckNumbers.join(', '));
      setEmailTruck(null);
      setShowPreview(false);
      setPreviewBody('');
      setPreviewSubject('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  // Download PDF — selection-aware
  function handleDownloadPdf() {
    if (selected.size > 0) {
      handleViewPdf();
    } else {
      window.open(fullPdfUrl, '_blank');
    }
  }

  // Open email form — selection-aware
  function handleEmailOpen() {
    if (selected.size > 0) {
      setEmailTruck('__bulk__');
    } else {
      setEmailTruck('__full__');
    }
    setEmailTo(brokerEmail ?? '');
    setShowPreview(false);
    setPreviewBody('');
    setPreviewSubject('');
  }

  // Handle Preview button click
  function handlePreviewClick() {
    if (!emailTo.trim()) return;
    if (emailTruck === '__full__') {
      fetchPreview('full');
    } else if (emailTruck === '__bulk__') {
      fetchPreview(Array.from(selected));
    } else if (emailTruck) {
      fetchPreview([emailTruck]);
    }
  }

  // Handle Send from preview
  function handleSendFromPreview() {
    if (emailTruck === '__full__') {
      handleEmail('full');
    } else {
      const trucks = emailTruck === '__bulk__' ? Array.from(selected) : [emailTruck!];
      handleEmail(trucks);
    }
  }

  const selectedCount = selected.size;
  const selectedTotal = truckGroups
    .filter((g) => selected.has(g.truckNumber))
    .reduce((sum, g) => sum + g.total, 0);

  function handleStatusChange(newStatus: string) {
    if (!newStatus || newStatus === status) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('sheetId', sheetId);
      fd.set('status', newStatus);
      await updateStatusAction(fd);
    });
  }

  return (
    <div className="space-y-4">
      {/* Top-level actions — selection-aware */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleDownloadPdf}
          className="btn-ghost text-sm inline-flex items-center gap-1"
        >
          {selected.size > 0 ? `View / Print (${selected.size} truck${selected.size !== 1 ? 's' : ''})` : 'View / Print'}
        </button>
        <button
          onClick={handleEmailOpen}
          disabled={tickets.length === 0}
          className="btn-ghost text-sm inline-flex items-center gap-1"
        >
          {selected.size > 0 ? `Email Trip Sheet (${selected.size} truck${selected.size !== 1 ? 's' : ''})` : 'Email Trip Sheet'}
        </button>

        <div className="flex items-center gap-2">
          <label className="text-sm text-steel-500">Status:</label>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isPending}
            className="input text-sm py-1.5 px-3 w-auto"
          >
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
          </select>
          {isPending && <span className="text-xs text-steel-400">Saving…</span>}
        </div>
      </div>

      {/* Bulk action bar */}
      {truckGroups.length > 1 && (
        <div className="panel p-3 flex items-center gap-3 flex-wrap bg-steel-50 border border-steel-200">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-steel-300 text-safety focus:ring-safety"
            />
            <span className="font-medium text-steel-700">Select All</span>
          </label>

          {selectedCount > 0 && (
            <span className="text-sm text-steel-500">
              {selectedCount} truck{selectedCount !== 1 ? 's' : ''} selected
              <span className="ml-1 font-semibold">(${selectedTotal.toFixed(2)})</span>
            </span>
          )}
        </div>
      )}

      {/* Email modal with preview */}
      {emailTruck && (
        <div className="panel p-4 border-2 border-safety bg-safety/5">
          <h3 className="text-sm font-semibold mb-2">
            {emailTruck === '__full__'
              ? 'Email Full Trip Sheet'
              : emailTruck === '__bulk__'
                ? `Email Trip Sheet (${selectedCount} truck${selectedCount !== 1 ? 's' : ''})`
                : `Email Trip Sheet — ${emailTruck}`}
          </h3>

          {/* Email to field */}
          <div className="flex items-end gap-2 mb-3">
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
            {!showPreview ? (
              <button
                onClick={handlePreviewClick}
                disabled={previewLoading || !emailTo.trim()}
                className="btn-accent"
              >
                {previewLoading ? 'Loading…' : 'Preview'}
              </button>
            ) : null}
            <button
              onClick={() => { setEmailTruck(null); setShowPreview(false); setPreviewBody(''); }}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>

          {/* Preview body */}
          {showPreview && (
            <div className="space-y-3">
              <div>
                <label className="label text-xs">Subject</label>
                <div className="text-sm font-medium bg-steel-100 px-3 py-2 rounded border border-steel-200">
                  {previewSubject}
                </div>
              </div>
              <div>
                <label className="label text-xs">Email Body <span className="text-steel-400 font-normal">(edit as needed)</span></label>
                <textarea
                  value={previewBody}
                  onChange={(e) => setPreviewBody(e.target.value)}
                  className="input w-full h-48 resize-y font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendFromPreview}
                  disabled={emailSending || !emailTo.trim()}
                  className="btn-accent"
                >
                  {emailSending ? 'Sending…' : 'Send Email'}
                </button>
                <button
                  onClick={() => { setShowPreview(false); setPreviewBody(''); }}
                  className="btn-ghost text-sm"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {emailSent && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          Sent trip sheet for {emailSent} to {emailTo}!
          <button onClick={() => setEmailSent(null)} className="ml-2 text-green-500 hover:text-green-700">{'\u2715'}</button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">{'\u2715'}</button>
        </div>
      )}

      {/* Truck groups */}
      {truckGroups.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">
          No tickets on this trip sheet yet. Add some below.
        </div>
      ) : (
        truckGroups.map((group) => {
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

              {/* Per-truck actions bar */}
              {isExpanded && (
                <div className="px-5 py-2 bg-white border-b border-steel-100 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleViewPdf([group.truckNumber])}
                    className="text-xs px-3 py-1.5 bg-steel-100 text-steel-700 rounded-lg hover:bg-steel-200 transition-colors inline-flex items-center gap-1"
                  >
                    View / Print
                  </button>
                  <button
                    onClick={() => {
                      setEmailTruck(group.truckNumber);
                      setEmailTo(brokerEmail ?? '');
                      setShowPreview(false);
                      setPreviewBody('');
                    }}
                    className="text-xs px-3 py-1.5 bg-steel-100 text-steel-700 rounded-lg hover:bg-steel-200 transition-colors inline-flex items-center gap-1"
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
                        {isDraft && <th className="px-4 py-2 w-8"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.tickets.map((t) => (
                        <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                          <td className="px-4 py-2.5 text-steel-600">{formatDate(t.date, t.completedAt)}</td>
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
                          {isDraft && (
                            <td className="px-4 py-2.5">
                              <form action={removeAction}>
                                <input type="hidden" name="sheetId" value={sheetId} />
                                <input type="hidden" name="ticketId" value={t.id} />
                                <button type="submit" className="text-red-500 hover:text-red-700 text-xs">{'\u2715'}</button>
                              </form>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
