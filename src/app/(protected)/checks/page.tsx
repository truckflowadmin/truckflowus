'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ManualCheck {
  id: string;
  checkNumber: number;
  payee: string;
  amount: string;
  memo: string | null;
  category: string | null;
  status: 'PENDING' | 'PAID' | 'VOID';
  paidAt: string | null;
  createdAt: string;
}

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  logoUrl: string | null;
  checkRoutingNumber: string;
  checkAccountNumber: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  VOID: 'bg-steel-200 text-steel-600',
};

const EXPENSE_CATEGORIES = [
  'Fuel',
  'Equipment',
  'Parts & Repairs',
  'Insurance',
  'Rent / Lease',
  'Utilities',
  'Subcontractor',
  'Supplies',
  'Other',
];

function formatCurrency(val: string | number) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Convert a number to words for check writing */
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

// ---------------------------------------------------------------------------
// Manual Check Print View
// ---------------------------------------------------------------------------
function ManualCheckView({ check, company, onClose }: { check: ManualCheck; company: CompanyInfo; onClose: () => void }) {
  const checkRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = checkRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Check #${String(check.checkNumber).padStart(6, '0')} - ${check.payee}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: letter; margin: 0; }
          body { font-family: 'Courier New', monospace; }
          @media print { body { padding: 0; } .no-print { display: none !important; } }
          @media screen { body { padding: 20px; background: #f0f0f0; } }
          .print-btn { display: block; margin: 0 auto 20px; padding: 10px 30px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
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
    const root = printWindow.document.getElementById('check-root');
    if (root) root.appendChild(content.cloneNode(true));
  }

  const checkNumber = String(check.checkNumber).padStart(6, '0');
  const checkDate = check.paidAt ? formatDate(check.paidAt) : formatDate(check.createdAt);
  const amount = parseFloat(check.amount);
  const companyAddress = [company.address, [company.city, company.state, company.zip].filter(Boolean).join(', ')].filter(Boolean).join('\n');

  const VoucherStub = ({ label }: { label: string }) => (
    <div style={{ height: '3.5in', padding: '0.35in 0.5in', display: 'flex', flexDirection: 'column', fontFamily: "'Courier New', monospace", fontSize: '11px', borderBottom: '2px dashed #aaa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{company.name}</div>
          <div style={{ fontSize: '10px', lineHeight: '1.4', whiteSpace: 'pre-line', color: '#444' }}>{companyAddress}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Check No.</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{checkNumber}</div>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Date</div>
          <div style={{ fontSize: '12px' }}>{checkDate}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #ddd' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Pay To</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{check.payee}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount</div>
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{formatCurrency(amount)}</div>
        </div>
      </div>
      <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 'bold' }}>{label}</div>
      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', flex: 1 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'normal' }}>Description</th>
            <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'normal' }}>Category</th>
            <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'normal' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '4px' }}>{check.memo || 'Manual check payment'}</td>
            <td style={{ padding: '4px' }}>{check.category || '—'}</td>
            <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(amount)}</td>
          </tr>
          <tr><td style={{ padding: '4px' }} colSpan={3}>&nbsp;</td></tr>
          <tr><td style={{ padding: '4px' }} colSpan={3}>&nbsp;</td></tr>
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #333' }}>
            <td style={{ padding: '4px', fontWeight: 'bold' }} colSpan={2}>Total</td>
            <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>{formatCurrency(amount)}</td>
          </tr>
        </tfoot>
      </table>
      {check.memo && (
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#555' }}>
          <span style={{ fontSize: '9px', color: '#999', textTransform: 'uppercase' }}>Memo: </span>{check.memo}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-steel-500 hover:text-steel-700">← Back to checks</button>
        <button onClick={handlePrint} className="btn btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Check
        </button>
      </div>

      <div ref={checkRef} style={{ width: '8.5in', minHeight: '11in', margin: '0 auto', background: '#fff', fontFamily: "'Courier New', monospace", boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        {/* Section 1: Top Check */}
        <div style={{ height: '3.5in', padding: '0.35in 0.5in', display: 'flex', flexDirection: 'column', borderBottom: '2px dashed #aaa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '2px' }}>{company.name}</div>
              <div style={{ fontSize: '10px', lineHeight: '1.4', whiteSpace: 'pre-line', color: '#333' }}>{companyAddress}</div>
              {company.phone && <div style={{ fontSize: '10px', color: '#333' }}>{company.phone}</div>}
            </div>
            {company.logoUrl && (
              <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={company.logoUrl} alt={company.name} style={{ maxHeight: '50px', maxWidth: '150px', objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{checkNumber}</div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Date </span>
                <span style={{ fontSize: '12px', borderBottom: '1px solid #333', paddingBottom: '1px', paddingLeft: '8px', paddingRight: '4px' }}>{checkDate}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Pay to the Order of</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '3px', minHeight: '22px' }}>
                {check.payee}
              </div>
            </div>
            <div style={{ border: '2px solid #333', padding: '6px 14px', fontSize: '18px', fontWeight: 'bold', minWidth: '130px', textAlign: 'center', background: '#fafafa' }}>
              {formatCurrency(amount)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '16px' }}>
            <div style={{ flex: 1, fontSize: '12px', borderBottom: '1px solid #666', paddingBottom: '2px' }}>
              {amountToWords(amount)} ★★★★★★★★★★ DOLLARS
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, marginRight: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Memo</span>
                  <span style={{ flex: 1, fontSize: '11px', borderBottom: '1px solid #999', paddingBottom: '2px' }}>
                    {check.memo || ''}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #333', width: '240px', marginBottom: '3px' }}>&nbsp;</div>
                <div style={{ fontSize: '9px', color: '#666', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Authorized Signature</div>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #eee', fontSize: '12px', letterSpacing: '2px', color: '#333', fontFamily: "'Courier New', monospace" }}>
              {company.checkRoutingNumber && <span>⑆{company.checkRoutingNumber}⑆ </span>}
              {company.checkAccountNumber && <span>{company.checkAccountNumber}⑈ </span>}
              <span>{checkNumber}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Middle Voucher Stub */}
        <VoucherStub label="PAYER'S COPY — DETACH AND RETAIN" />

        {/* Section 3: Bottom Voucher Stub */}
        <VoucherStub label="PAYEE'S REMITTANCE ADVICE — DETACH AND RETAIN" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function ManualChecksPage() {
  const [checks, setChecks] = useState<ManualCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'print'>('list');
  const [selectedCheck, setSelectedCheck] = useState<ManualCheck | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  // Form fields
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [category, setCategory] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checks');
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchCompany = useCallback(async () => {
    // We'll get company info from the first check view or a dedicated endpoint
    try {
      // Use a dummy payment check endpoint to get company info
      const res = await fetch('/api/company/info');
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchChecks();
    fetchCompany();
  }, [fetchChecks, fetchCompany]);

  async function createCheck() {
    if (!payee || !amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payee,
          amount: parseFloat(amount),
          memo: memo || null,
          category: category || null,
          markAsPaid,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPayee('');
        setAmount('');
        setMemo('');
        setCategory('');
        setMarkAsPaid(false);
        fetchChecks();
        // Show print view immediately
        if (company) {
          setSelectedCheck(data.check);
          setView('print');
        } else {
          setView('list');
        }
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function updateStatus(checkId: string, status: 'PAID' | 'VOID') {
    const res = await fetch('/api/checks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkId, status }),
    });
    if (res.ok) fetchChecks();
  }

  function viewCheckPrint(check: ManualCheck) {
    setSelectedCheck(check);
    setView('print');
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Payments</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manual Checks</h1>
        <p className="text-sm text-steel-500 mt-1">Write checks for non-payroll expenses like rent, fuel, equipment, subcontractors, etc.</p>
      </header>

      {view === 'print' && selectedCheck && company ? (
        <ManualCheckView check={selectedCheck} company={company} onClose={() => { setSelectedCheck(null); setView('list'); }} />
      ) : view === 'create' ? (
        <div className="panel p-6 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Write a Check</h2>
            <button onClick={() => setView('list')} className="text-sm text-steel-500 hover:text-steel-700">← Back</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Pay To (Payee) *</label>
              <input
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. ABC Equipment Co."
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input w-full pl-7"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-full">
                <option value="">Select category...</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Memo</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="What is this check for?"
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

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={createCheck}
                disabled={saving || !payee || !amount}
                className="btn btn-primary"
              >
                {saving ? 'Creating...' : 'Create & Print Check'}
              </button>
              <button onClick={() => setView('list')} className="btn px-4 py-2 border border-steel-300 rounded text-sm hover:bg-steel-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-steel-500">
              {checks.length} check{checks.length !== 1 ? 's' : ''} total
            </div>
            <button onClick={() => setView('create')} className="btn btn-primary">
              + Write a Check
            </button>
          </div>

          {/* Check list */}
          {loading ? (
            <div className="text-sm text-steel-500 py-8 text-center">Loading...</div>
          ) : checks.length === 0 ? (
            <div className="panel p-8 text-center text-steel-500">
              <p className="text-sm">No manual checks yet.</p>
              <button onClick={() => setView('create')} className="text-blue-600 hover:text-blue-800 font-medium text-sm mt-2">
                Write your first check
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-steel-500 border-b border-steel-200">
                  <tr>
                    <th className="text-left py-2 pr-3">Check #</th>
                    <th className="text-left py-2 pr-3">Payee</th>
                    <th className="text-left py-2 pr-3">Category</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Memo</th>
                    <th className="text-right py-2 pl-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.id} className="border-b border-steel-100 hover:bg-steel-50">
                      <td className="py-2.5 pr-3 font-mono text-xs">{String(c.checkNumber).padStart(6, '0')}</td>
                      <td className="py-2.5 pr-3 font-medium">{c.payee}</td>
                      <td className="py-2.5 pr-3 text-steel-500">{c.category || '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{formatCurrency(c.amount)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-steel-500">{formatDate(c.createdAt)}</td>
                      <td className="py-2.5 px-3 text-xs text-steel-500 max-w-[120px] truncate" title={c.memo ?? ''}>{c.memo || '—'}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => viewCheckPrint(c)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                            Print
                          </button>
                          {c.status === 'PENDING' && (
                            <>
                              <button onClick={() => updateStatus(c.id, 'PAID')} className="text-xs text-green-600 hover:text-green-800 font-medium">
                                Mark Paid
                              </button>
                              <button onClick={() => updateStatus(c.id, 'VOID')} className="text-xs text-red-500 hover:text-red-700 font-medium">
                                Void
                              </button>
                            </>
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
      )}
    </div>
  );
}
