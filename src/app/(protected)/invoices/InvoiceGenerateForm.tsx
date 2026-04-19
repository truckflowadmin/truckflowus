'use client';

import { useState, useMemo, useRef } from 'react';

interface Customer { id: string; name: string }
interface Broker { id: string; name: string }

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

interface PreviewResult {
  billedTo: string;
  ticketCount: number;
  tickets: PreviewTicket[];
  subtotal: number;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  return sun;
}

type PeriodMode = 'week' | 'month' | 'year' | 'custom';

function computePeriod(mode: PeriodMode, anchor: Date): { start: Date; end: Date } {
  switch (mode) {
    case 'week': {
      const mon = getMonday(anchor);
      return { start: mon, end: getSunday(mon) };
    }
    case 'month': {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start, end };
    }
    case 'year': {
      const start = new Date(anchor.getFullYear(), 0, 1);
      const end = new Date(anchor.getFullYear(), 11, 31);
      return { start, end };
    }
    default:
      return { start: anchor, end: anchor };
  }
}

function formatPeriodLabel(mode: PeriodMode, start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const optsYear: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  switch (mode) {
    case 'week':
      return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', optsYear)}`;
    case 'month':
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'year':
      return String(start.getFullYear());
    case 'custom':
      return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', optsYear)}`;
  }
}

function shiftPeriod(mode: PeriodMode, anchor: Date, delta: number): Date {
  const d = new Date(anchor);
  switch (mode) {
    case 'week':
      d.setDate(d.getDate() + delta * 7);
      return d;
    case 'month':
      d.setMonth(d.getMonth() + delta);
      return d;
    case 'year':
      d.setFullYear(d.getFullYear() + delta);
      return d;
    default:
      return d;
  }
}

export default function InvoiceGenerateForm({
  customers,
  brokers,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  customers: Customer[];
  brokers: Broker[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  const [invoiceType, setInvoiceType] = useState<'CUSTOMER' | 'BROKER'>('CUSTOMER');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastFormData = useRef<FormData | null>(null);

  // Period picker state
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  const [anchor, setAnchor] = useState<Date>(() => {
    const today = new Date();
    // Default to last week's Monday
    const mon = getMonday(today);
    mon.setDate(mon.getDate() - 7);
    return mon;
  });
  const [customStart, setCustomStart] = useState(defaultPeriodStart);
  const [customEnd, setCustomEnd] = useState(defaultPeriodEnd);
  const [showCalendar, setShowCalendar] = useState(false);

  const period = useMemo(() => {
    if (periodMode === 'custom') {
      return {
        start: new Date(customStart + 'T00:00:00'),
        end: new Date(customEnd + 'T00:00:00'),
      };
    }
    return computePeriod(periodMode, anchor);
  }, [periodMode, anchor, customStart, customEnd]);

  const periodLabel = useMemo(
    () => formatPeriodLabel(periodMode, period.start, period.end),
    [periodMode, period],
  );

  function handleShift(delta: number) {
    setAnchor((prev) => shiftPeriod(periodMode, prev, delta));
    setPreview(null);
  }

  function handleModeChange(mode: PeriodMode) {
    setPeriodMode(mode);
    setShowCalendar(mode === 'custom');
    setPreview(null);
  }

  // Calendar picker: pick a date and snap to the correct period
  function handleCalendarPick(dateStr: string) {
    const picked = new Date(dateStr + 'T00:00:00');
    setAnchor(picked);
    if (periodMode !== 'custom') {
      setShowCalendar(false);
    }
  }

  async function handleLookup(e: React.FormEvent<HTMLFormElement>, type: 'CUSTOMER' | 'BROKER') {
    e.preventDefault();
    setError(null);
    setPreview(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    fd.set('invoiceType', type);
    fd.set('periodStart', fmtDate(period.start));
    fd.set('periodEnd', fmtDate(period.end));
    lastFormData.current = fd;

    try {
      const res = await fetch('/api/invoices/preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No results found.');
        setLoading(false);
        return;
      }
      if (data.ticketCount === 0) {
        setError('No uninvoiced completed tickets found for the selected period.');
        setLoading(false);
        return;
      }
      setPreview(data);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!lastFormData.current) return;
    setError(null);
    setGenerating(true);

    try {
      const res = await fetch('/api/invoices/generate', { method: 'POST', body: lastFormData.current });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to generate invoice.');
        setGenerating(false);
        return;
      }
      window.location.href = `/invoices/${data.invoiceId}`;
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
      setGenerating(false);
    }
  }

  function resetPreview() {
    setPreview(null);
    setError(null);
    lastFormData.current = null;
  }

  const isBroker = invoiceType === 'BROKER';

  const periodModes: { value: PeriodMode; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <section className="panel p-5 mb-6">
      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-red-500 text-lg leading-none mt-0.5">&#9888;</span>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">
            &times;
          </button>
        </div>
      )}

      {/* Toggle */}
      <div className="flex gap-1 mb-4 bg-steel-100 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => { setInvoiceType('CUSTOMER'); resetPreview(); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            invoiceType === 'CUSTOMER'
              ? 'bg-white shadow text-steel-900'
              : 'text-steel-500 hover:text-steel-700'
          }`}
        >
          Customer
        </button>
        <button
          type="button"
          onClick={() => { setInvoiceType('BROKER'); resetPreview(); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            invoiceType === 'BROKER'
              ? 'bg-white shadow text-steel-900'
              : 'text-steel-500 hover:text-steel-700'
          }`}
        >
          Broker
        </button>
      </div>

      {/* Lookup form */}
      {!preview && (
        <form
          ref={formRef}
          onSubmit={(e) => handleLookup(e, invoiceType)}
          className="space-y-4"
        >
          {/* Row 1: Entity selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invoiceType === 'CUSTOMER' ? (
              <div>
                <label className="label">Customer</label>
                <select name="customerId" required className="input" defaultValue="">
                  <option value="" disabled>-- Select Customer --</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Broker</label>
                <select name="brokerId" required className="input" defaultValue="">
                  <option value="" disabled>-- Select Broker --</option>
                  {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Period picker */}
          <div>
            <label className="label">Service Period</label>

            {/* Mode tabs */}
            <div className="flex gap-1 mb-2 bg-steel-50 rounded-md p-0.5 w-fit border border-steel-200">
              {periodModes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleModeChange(m.value)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    periodMode === m.value
                      ? 'bg-white shadow-sm text-steel-900'
                      : 'text-steel-500 hover:text-steel-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Period nav (for week/month/year) */}
            {periodMode !== 'custom' ? (
              <div className="flex items-center gap-2 max-w-md">
                <button
                  type="button"
                  onClick={() => handleShift(-1)}
                  className="px-2.5 py-1.5 rounded border border-steel-300 hover:bg-steel-50 text-sm font-bold"
                >
                  &#8592;
                </button>
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex-1 text-center text-sm font-medium py-1.5 px-3 rounded border border-steel-300 hover:bg-steel-50 cursor-pointer"
                >
                  {periodLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleShift(1)}
                  className="px-2.5 py-1.5 rounded border border-steel-300 hover:bg-steel-50 text-sm font-bold"
                >
                  &#8594;
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 max-w-md">
                <div className="flex-1">
                  <input
                    type="date"
                    className="input text-sm"
                    value={customStart}
                    onChange={(e) => { setCustomStart(e.target.value); setPreview(null); }}
                  />
                </div>
                <span className="text-steel-400 text-sm">to</span>
                <div className="flex-1">
                  <input
                    type="date"
                    className="input text-sm"
                    value={customEnd}
                    onChange={(e) => { setCustomEnd(e.target.value); setPreview(null); }}
                  />
                </div>
              </div>
            )}

            {/* Calendar popup for picking a date to snap to week/month/year */}
            {showCalendar && periodMode !== 'custom' && (
              <div className="mt-2 p-3 rounded-lg border border-steel-200 bg-white shadow-lg max-w-xs">
                <p className="text-xs text-steel-500 mb-2">
                  Pick a date to jump to that {periodMode}
                </p>
                <input
                  type="date"
                  className="input text-sm"
                  value={fmtDate(anchor)}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleCalendarPick(e.target.value);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Hidden period fields */}
          <input type="hidden" name="periodStart" value={fmtDate(period.start)} />
          <input type="hidden" name="periodEnd" value={fmtDate(period.end)} />

          <div>
            <button className="btn-accent" type="submit" disabled={loading}>
              {loading ? 'Looking up...' : 'Look Up Invoices'}
            </button>
          </div>
        </form>
      )}

      {/* Preview results */}
      {preview && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-medium">{preview.billedTo}</span>
              <span className="text-steel-500 text-sm ml-2">
                {periodLabel}
              </span>
              <span className="text-steel-500 text-sm ml-2">
                &middot; {preview.ticketCount} ticket{preview.ticketCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button type="button" onClick={resetPreview} className="text-sm text-steel-500 hover:text-steel-800">
              &#8592; Change selection
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-steel-200 mb-4">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="text-left px-4 py-2">Ticket</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Driver</th>
                  {isBroker && <th className="text-left px-4 py-2">Customer</th>}
                  <th className="text-left px-4 py-2">Material</th>
                  <th className="text-left px-4 py-2">Truck</th>
                  <th className="text-right px-4 py-2">Qty</th>
                  <th className="text-right px-4 py-2">Rate</th>
                  <th className="text-right px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.tickets.map((t) => (
                  <tr key={t.id} className="border-b border-steel-100">
                    <td className="px-4 py-2 font-mono text-xs">#{String(t.ticketNumber).padStart(4, '0')}</td>
                    <td className="px-4 py-2 text-steel-600">{t.date}</td>
                    <td className="px-4 py-2">{t.driver}</td>
                    {isBroker && <td className="px-4 py-2">{t.customer}</td>}
                    <td className="px-4 py-2">{t.material}</td>
                    <td className="px-4 py-2">{t.truckNumber}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.quantity.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">${t.rate.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">${t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-steel-50">
                <tr className="border-t-2 border-steel-300">
                  <td colSpan={isBroker ? 8 : 7} className="px-4 py-2 text-right font-bold">Subtotal</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold">${preview.subtotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-accent"
            >
              {generating ? 'Generating...' : `Generate Invoice ($${preview.subtotal.toFixed(2)})`}
            </button>
            <button type="button" onClick={resetPreview} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
