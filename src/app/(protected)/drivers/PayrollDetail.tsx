'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  totalRevenue?: number;
}

interface CheckData {
  payment: {
    id: string;
    periodStart: string;
    periodEnd: string;
    payType: string;
    payRate: number;
    hoursWorked: number;
    jobsCompleted: number;
    ticketsCompleted: number;
    calculatedAmount: number;
    adjustedAmount: number | null;
    finalAmount: number;
    notes: string | null;
    status: string;
    paidAt: string | null;
    createdAt: string;
  };
  driverName: string;
  company: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    checkRoutingNumber: string;
    checkAccountNumber: string;
  };
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

/** Convert a number to words for check writing (e.g. 1234.56 → "One Thousand Two Hundred Thirty-Four and 56/100") */
function amountToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + convert(n % 1000000) : '');
    return convert(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 ? ' ' + convert(n % 1000000000) : '');
  }

  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const dollarWords = dollars === 0 ? 'Zero' : convert(dollars);
  return `${dollarWords} and ${cents.toString().padStart(2, '0')}/100`;
}

function maskAccount(acct: string): string {
  if (!acct || acct.length <= 4) return acct || '';
  return '●●●●' + acct.slice(-4);
}

// ---------------------------------------------------------------------------
// Check View Component
// ---------------------------------------------------------------------------
function CheckView({ data, onClose }: { data: CheckData; onClose: () => void }) {
  const checkRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = checkRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=900,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Check - ${data.driverName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 20px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
          .check-container {
            border: 2px solid #333;
            padding: 30px;
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            position: relative;
          }
          .check-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 16px;
          }
          .company-info { font-size: 12px; line-height: 1.5; }
          .company-name { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .check-number { font-size: 14px; color: #666; text-align: right; }
          .check-date { font-size: 14px; text-align: right; margin-top: 8px; }
          .date-label { font-size: 10px; color: #666; text-transform: uppercase; }
          .pay-to-section { margin-bottom: 20px; }
          .pay-to-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .pay-to-name { font-size: 20px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 4px; display: inline-block; min-width: 400px; }
          .amount-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .amount-words { font-size: 13px; flex: 1; border-bottom: 1px solid #999; padding-bottom: 4px; margin-right: 16px; }
          .amount-box { border: 2px solid #333; padding: 8px 16px; font-size: 20px; font-weight: bold; min-width: 140px; text-align: center; }
          .memo-section { margin-top: 24px; padding-top: 16px; border-top: 1px solid #ccc; }
          .memo-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .memo-text { font-size: 12px; border-bottom: 1px solid #999; padding-bottom: 4px; min-height: 16px; }
          .bank-section { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 16px; }
          .bank-info { font-size: 11px; color: #555; }
          .bank-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
          .signature-line { border-top: 1px solid #333; width: 250px; text-align: center; padding-top: 4px; font-size: 10px; color: #666; }
          .stub { margin-top: 30px; border-top: 2px dashed #999; padding-top: 20px; }
          .stub-title { font-size: 14px; font-weight: bold; margin-bottom: 12px; }
          .stub-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px; }
          .stub-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
          .stub-value { font-weight: bold; }
          .print-btn {
            display: block; margin: 20px auto; padding: 10px 30px;
            background: #2563eb; color: white; border: none; border-radius: 6px;
            font-size: 14px; cursor: pointer;
          }
          .print-btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">Print Check</button>
        <div id="check-root"></div>
      </body>
      </html>
    `);
    printWindow.document.close();
    // Safely clone the DOM nodes instead of using innerHTML string injection
    const root = printWindow.document.getElementById('check-root');
    if (root) {
      root.appendChild(content.cloneNode(true));
    }
  }

  const p = data.payment;
  const c = data.company;
  const companyAddress = [c.address, [c.city, c.state, c.zip].filter(Boolean).join(', ')].filter(Boolean).join('\n');

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-steel-500 hover:text-steel-700">
          ← Back to payments
        </button>
        <button
          onClick={handlePrint}
          className="btn btn-primary flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Check
        </button>
      </div>

      {/* Check preview */}
      <div ref={checkRef} className="bg-white">
        <div style={{ border: '2px solid #333', padding: '30px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Courier New', monospace", background: '#fff' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid #ccc', paddingBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{c.name}</div>
              <div style={{ fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{companyAddress}</div>
              {c.phone && <div style={{ fontSize: '12px' }}>{c.phone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Date</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>
                {p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}
              </div>
            </div>
          </div>

          {/* Pay To */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Pay to the Order of</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '4px', flex: 1, marginRight: '16px' }}>
                {data.driverName}
              </div>
              <div style={{ border: '2px solid #333', padding: '8px 16px', fontSize: '20px', fontWeight: 'bold', minWidth: '140px', textAlign: 'center' }}>
                {formatCurrency(p.finalAmount)}
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', borderBottom: '1px solid #999', paddingBottom: '4px' }}>
              {amountToWords(p.finalAmount)} ★★★★★
            </div>
          </div>

          {/* Memo */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #ccc' }}>
            <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Memo</div>
            <div style={{ fontSize: '12px', borderBottom: '1px solid #999', paddingBottom: '4px', minHeight: '16px' }}>
              Payment for {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
              {p.notes ? ` | ${p.notes}` : ''}
            </div>
          </div>

          {/* Bank info + signature */}
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #ccc', paddingTop: '16px' }}>
            <div style={{ fontSize: '11px', color: '#555' }}>
              {c.checkRoutingNumber && (
                <div>
                  <span style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Routing: </span>
                  {c.checkRoutingNumber}
                </div>
              )}
              {c.checkAccountNumber && (
                <div>
                  <span style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Account: </span>
                  {maskAccount(c.checkAccountNumber)}
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid #333', width: '250px', textAlign: 'center', paddingTop: '4px', fontSize: '10px', color: '#666' }}>
              Authorized Signature
            </div>
          </div>
        </div>

        {/* Pay stub / details */}
        <div style={{ marginTop: '30px', borderTop: '2px dashed #999', paddingTop: '20px', maxWidth: '800px', margin: '30px auto 0', fontFamily: "'Courier New', monospace" }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Payment Stub — {data.driverName}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Period</div>
              <div style={{ fontWeight: 'bold' }}>{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Pay Type</div>
              <div style={{ fontWeight: 'bold' }}>{PAY_TYPE_LABELS[p.payType] ?? p.payType} @ {formatRate(p.payType, String(p.payRate))}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Hours / Jobs / Tickets</div>
              <div style={{ fontWeight: 'bold' }}>{p.hoursWorked.toFixed(1)}h / {p.jobsCompleted} / {p.ticketsCompleted}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Pay</div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{formatCurrency(p.finalAmount)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PayrollDetail({ driverId, driverName, workerType, payType, payRate, onClose }: Props) {
  const [view, setView] = useState<'history' | 'create' | 'check'>('history');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkData, setCheckData] = useState<CheckData | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

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
    const final_ = adj !== null ? adj : calcResult.calculatedAmount;
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
          finalAmount: final_,
          notes: payNotes || null,
          status: markAsPaid ? 'PAID' : 'PENDING',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Show check view immediately after creating payment
        await viewCheck(data.payment.id);
        // Reset form
        setCalcResult(null);
        setPeriodStart('');
        setPeriodEnd('');
        setAdjustedAmount('');
        setPayNotes('');
        setMarkAsPaid(false);
        fetchPayments();
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  // -- View check for a payment --
  async function viewCheck(paymentId: string) {
    setCheckLoading(true);
    try {
      const res = await fetch(`/api/drivers/payments/check?paymentId=${paymentId}`);
      if (res.ok) {
        const data = await res.json();
        setCheckData(data);
        setView('check');
      }
    } catch { /* ignore */ }
    setCheckLoading(false);
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
      {view !== 'check' && (
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
      )}

      {/* Content */}
      <div className="p-5">
        {view === 'check' && checkData ? (
          <CheckView data={checkData} onClose={() => { setCheckData(null); setView('history'); }} />
        ) : view === 'history' ? (
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => viewCheck(p.id)}
                              disabled={checkLoading}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Check
                            </button>
                            {p.status === 'PENDING' && (
                              <>
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
                              </>
                            )}
                            {p.status === 'PAID' && (
                              <button
                                onClick={() => updatePaymentStatus(p.id, 'VOID')}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                Void
                              </button>
                            )}
                          </div>
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
            <p className="text-xs text-steel-500 mb-4">
              Only dispatcher-reviewed tickets within the selected period are included in the calculation.
            </p>

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
                  <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold mb-3">Period Summary (Reviewed Tickets Only)</div>
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
