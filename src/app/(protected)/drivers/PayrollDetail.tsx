'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Payment {
  id: string;
  periodStart: string;
  periodEnd: string;
  hoursWorked: string;
  jobsCompleted: number;
  ticketsCompleted: number;
  payType: string;
  payRate: string;
  calculatedAmount: string;
  adjustedAmount: string | null;
  finalAmount: string;
  notes: string | null;
  status: 'PENDING' | 'PAID' | 'VOID';
  paidAt: string | null;
  createdAt: string;
}

interface CalcResult {
  payType: string;
  payRate: number;
  hoursWorked: number;
  jobsCompleted: number;
  ticketsCompleted: number;
  calculatedAmount: number;
}

interface Props {
  driverId: string;
  driverName: string;
  workerType: string;
  payType: string;
  payRate: string | null;
  onClose: () => void;
}

const PAY_TYPE_LABELS: Record<string, string> = {
  HOURLY: 'Hourly',
  SALARY: 'Salary',
  PERCENTAGE: 'Percentage',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  VOID: 'bg-steel-200 text-steel-600',
};

function formatCurrency(val: string | number) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRate(payType: string, payRate: string | null): string {
  if (!payRate) return '—';
  const num = parseFloat(payRate);
  if (payType === 'PERCENTAGE') return `${num}%`;
  return `$${num.toFixed(2)}${payType === 'HOURLY' ? '/hr' : ''}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PayrollDetail({ driverId, driverName, workerType, payType, payRate, onClose }: Props) {
  const [view, setView] = useState<'history' | 'create'>('history');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'PAID' | 'VOID'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Create payment form
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [saving, setSaving] = useState(false);

  // -- Fetch payment history --
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ driverId });
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await fetch(`/api/drivers/payments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [driverId, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // -- Calculate suggested pay --
  async function calculatePay() {
    if (!periodStart || !periodEnd) return;
    setCalcLoading(true);
    try {
      const params = new URLSearchParams({ driverId, from: periodStart, to: periodEnd });
      const res = await fetch(`/api/drivers/payments/calculate?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
        setAdjustedAmount('');
      }
    } catch { /* ignore */ }
    setCalcLoading(false);
  }

  // -- Save payment --
  async function savePayment() {
    if (!calcResult || !periodStart || !periodEnd) return;
    setSaving(true);
    const adj = adjustedAmount ? parseFloat(adjustedAmount) : null;
    const final = adj !== null ? adj : calcResult.calculatedAmount;
    try {
      const res = await fetch('/api/drivers/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          periodStart,
          periodEnd,
          hoursWorked: calcResult.hoursWorked,
          jobsCompleted: calcResult.jobsCompleted,
          ticketsCompleted: calcResult.ticketsCompleted,
          payType: calcResult.payType,
          payRate: calcResult.payRate,
          calculatedAmount: calcResult.calculatedAmount,
          adjustedAmount: adj,
          finalAmount: final,
          notes: payNotes || null,
          status: markAsPaid ? 'PAID' : 'PENDING',
        }),
      });
      if (res.ok) {
        // Reset form and switch to history
        setCalcResult(null);
        setPeriodStart('');
        setPeriodEnd('');
        setAdjustedAmount('');
        setPayNotes('');
        setMarkAsPaid(false);
        setView('history');
        fetchPayments();
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  // -- Mark payment as paid/void --
  async function updatePaymentStatus(paymentId: string, status: 'PAID' | 'VOID') {
    const res = await fetch('/api/drivers/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, status }),
    });
    if (res.ok) fetchPayments();
  }

  // Summary stats
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + parseFloat(p.finalAmount), 0);
  const pendingTotal = payments.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + parseFloat(p.finalAmount), 0);

  return (
    <div className="border-t-2 border-safety bg-white">
      {/* Header */}
      <div className="px-5 py-4 bg-steel-50 border-b border-steel-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-steel-400 hover:text-steel-600 text-lg"
            title="Close"
          >
            ✕
          </button>
          <div>
            <h3 className="font-bold text-lg">{driverName}</h3>
            <div className="flex items-center gap-3 text-xs text-steel-500">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                workerType === 'EMPLOYEE' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {workerType === 'EMPLOYEE' ? 'Employee' : 'Contractor'}
              </span>
              <span>{PAY_TYPE_LABELS[payType] ?? payType}: {formatRate(payType, payRate)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-steel-500">Total Paid</div>
            <div className="font-bold text-green-700">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-steel-500">Pending</div>
            <div className="font-bold text-amber-600">{formatCurrency(pendingTotal)}</div>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="px-5 pt-4 flex items-center gap-4">
        <div className="flex items-center gap-1 bg-steel-100 rounded-lg p-1">
          <button
            onClick={() => setView('history')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'history' ? 'bg-white text-steel-900 shadow-sm' : 'text-steel-500 hover:text-steel-700'
            }`}
          >
            Payment History
          </button>
          <button
            onClick={() => setView('create')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'create' ? 'bg-white text-steel-900 shadow-sm' : 'text-steel-500 hover:text-steel-700'
            }`}
          >
            + Create Payment
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {view === 'history' ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-steel-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="input text-sm py-1.5 w-32"
                >
                  <option value="">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="VOID">Void</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-steel-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input text-sm py-1.5"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-steel-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input text-sm py-1.5"
                />
              </div>
              {(statusFilter || dateFrom || dateTo) && (
                <button
                  onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-red-500 hover:text-red-700 pb-2"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Payment list */}
            {loading ? (
              <div className="text-sm text-steel-500 py-8 text-center">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="text-sm text-steel-500 py-8 text-center">
                No payment records found.
                <button onClick={() => setView('create')} className="ml-2 text-blue-600 hover:text-blue-800 font-medium">
                  Create first payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-steel-500 border-b border-steel-200">
                    <tr>
                      <th className="text-left py-2 pr-3">Period</th>
                      <th className="text-right py-2 px-3">Hours</th>
                      <th className="text-right py-2 px-3">Jobs</th>
                      <th className="text-right py-2 px-3">Tickets</th>
                      <th className="text-left py-2 px-3">Rate</th>
                      <th className="text-right py-2 px-3">Calculated</th>
                      <th className="text-right py-2 px-3">Adjusted</th>
                      <th className="text-right py-2 px-3">Final</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Notes</th>
                      <th className="text-right py-2 pl-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-steel-100 hover:bg-steel-50">
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          <div className="text-xs">{formatDate(p.periodStart)}</div>
                          <div className="text-[10px] text-steel-400">to {formatDate(p.periodEnd)}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{parseFloat(p.hoursWorked).toFixed(1)}h</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{p.jobsCompleted}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{p.ticketsCompleted}</td>
                        <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                          {formatRate(p.payType, p.payRate)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-steel-500">
                          {formatCurrency(p.calculatedAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {p.adjustedAmount ? (
                            <span className="text-amber-600">{formatCurrency(p.adjustedAmount)}</span>
                          ) : (
                            <span className="text-steel-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                          {formatCurrency(p.finalAmount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                            {p.status}
                          </span>
                          {p.paidAt && (
                            <div className="text-[10px] text-steel-400 mt-0.5">{formatDate(p.paidAt)}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-steel-500 max-w-[120px] truncate" title={p.notes ?? ''}>
                          {p.notes || '—'}
                        </td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          {p.status === 'PENDING' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => updatePaymentStatus(p.id, 'PAID')}
                                className="text-xs text-green-600 hover:text-green-800 font-medium"
                              >
                                Mark Paid
                              </button>
                              <button
                                onClick={() => updatePaymentStatus(p.id, 'VOID')}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                Void
                              </button>
                            </div>
                          )}
                          {p.status === 'PAID' && (
                            <button
                              onClick={() => updatePaymentStatus(p.id, 'VOID')}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Create Payment View */
          <div className="max-w-2xl">
            <h4 className="font-semibold mb-4">Calculate Payment</h4>

            {/* Period picker */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>

            <button
              onClick={calculatePay}
              disabled={!periodStart || !periodEnd || calcLoading}
              className="btn btn-primary mb-5"
            >
              {calcLoading ? 'Calculating...' : 'Calculate'}
            </button>

            {/* Calculation result */}
            {calcResult && (
              <div className="space-y-4">
                <div className="panel p-4 bg-steel-50">
                  <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold mb-3">Period Summary</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-steel-400">Hours</div>
                      <div className="text-lg font-bold tabular-nums">{calcResult.hoursWorked.toFixed(1)}h</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-steel-400">Jobs</div>
                      <div className="text-lg font-bold tabular-nums">{calcResult.jobsCompleted}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-steel-400">Tickets</div>
                      <div className="text-lg font-bold tabular-nums">{calcResult.ticketsCompleted}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-steel-400">Rate</div>
                      <div className="text-lg font-bold">{formatRate(calcResult.payType, String(calcResult.payRate))}</div>
                    </div>
                  </div>
                </div>

                <div className="panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-steel-500">System Calculated</div>
                      <div className="text-2xl font-bold text-steel-900">{formatCurrency(calcResult.calculatedAmount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-steel-500">Final Amount</div>
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(adjustedAmount ? parseFloat(adjustedAmount) : calcResult.calculatedAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-steel-600 mb-1">
                        Adjusted Amount <span className="text-steel-400">(leave blank to use calculated)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={adjustedAmount}
                          onChange={(e) => setAdjustedAmount(e.target.value)}
                          placeholder={calcResult.calculatedAmount.toFixed(2)}
                          className="input w-full pl-7"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-steel-600 mb-1">Notes</label>
                      <textarea
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Optional notes about this payment..."
                        className="input w-full h-20 resize-none"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={markAsPaid}
                        onChange={(e) => setMarkAsPaid(e.target.checked)}
                        className="rounded"
                      />
                      Mark as Paid immediately
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={savePayment}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : markAsPaid ? 'Save & Mark Paid' : 'Save as Pending'}
                  </button>
                  <button
                    onClick={() => { setCalcResult(null); setPeriodStart(''); setPeriodEnd(''); }}
                    className="btn px-4 py-2 border border-steel-300 rounded text-sm hover:bg-steel-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
