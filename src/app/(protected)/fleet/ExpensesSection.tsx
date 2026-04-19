'use client';

import { useState, useRef } from 'react';

interface TruckOption {
  id: string;
  truckNumber: string;
}

interface ExpenseData {
  id: string;
  truckId: string | null;
  truckNumber: string | null;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  vendor: string | null;
  receiptUrl: string | null;
  isRecurring: boolean;
  recurringDay: number | null;
  recurringEnd: string | null;
  notes: string | null;
}

interface Props {
  initialExpenses: ExpenseData[];
  trucks: TruckOption[];
}

const CATEGORIES = [
  { value: 'FUEL', label: 'Fuel', icon: '⛽' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: '🔧' },
  { value: 'INSURANCE', label: 'Insurance', icon: '🛡' },
  { value: 'REGISTRATION', label: 'Registration', icon: '📋' },
  { value: 'TOLLS', label: 'Tolls', icon: '🛣' },
  { value: 'TIRES', label: 'Tires', icon: '⭕' },
  { value: 'PARTS', label: 'Parts', icon: '⚙' },
  { value: 'LEASE', label: 'Lease', icon: '📝' },
  { value: 'LOAN', label: 'Loan', icon: '🏦' },
  { value: 'WASH', label: 'Wash', icon: '🧼' },
  { value: 'PERMITS', label: 'Permits', icon: '📄' },
  { value: 'OTHER', label: 'Other', icon: '💳' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function ExpensesSection({ initialExpenses, trucks }: Props) {
  const [expenses, setExpenses] = useState<ExpenseData[]>(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTruck, setFilterTruck] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showRecurring, setShowRecurring] = useState(false);

  // Form
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: 'FUEL',
    truckId: '',
    description: '',
    vendor: '',
    notes: '',
    isRecurring: false,
    recurringDay: '',
    recurringEnd: '',
  });

  function resetForm() {
    setForm({
      date: new Date().toISOString().slice(0, 10), amount: '', category: 'FUEL',
      truckId: '', description: '', vendor: '', notes: '',
      isRecurring: false, recurringDay: '', recurringEnd: '',
    });
    if (receiptRef.current) receiptRef.current.value = '';
    setEditingId(null);
  }

  function startEdit(e: ExpenseData) {
    setForm({
      date: e.date.slice(0, 10),
      amount: String(e.amount),
      category: e.category,
      truckId: e.truckId || '',
      description: e.description || '',
      vendor: e.vendor || '',
      notes: e.notes || '',
      isRecurring: e.isRecurring,
      recurringDay: e.recurringDay ? String(e.recurringDay) : '',
      recurringEnd: e.recurringEnd ? e.recurringEnd.slice(0, 10) : '',
    });
    if (receiptRef.current) receiptRef.current.value = '';
    setEditingId(e.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!form.date || !form.amount || !form.category) {
      setError('Date, amount, and category are required');
      return;
    }
    setLoading(true);

    try {
      if (editingId) {
        // PATCH — update existing expense
        const body: Record<string, any> = {
          id: editingId,
          date: form.date,
          amount: form.amount,
          category: form.category,
          truckId: form.truckId || null,
          description: form.description || null,
          vendor: form.vendor || null,
          notes: form.notes || null,
          isRecurring: form.isRecurring,
          recurringDay: form.isRecurring && form.recurringDay ? parseInt(form.recurringDay) : null,
          recurringEnd: form.isRecurring && form.recurringEnd ? form.recurringEnd : null,
        };
        const res = await fetch('/api/fleet/expenses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        // POST — create new expense
        const fd = new FormData();
        fd.append('date', form.date);
        fd.append('amount', form.amount);
        fd.append('category', form.category);
        if (form.truckId) fd.append('truckId', form.truckId);
        if (form.description) fd.append('description', form.description);
        if (form.vendor) fd.append('vendor', form.vendor);
        if (form.notes) fd.append('notes', form.notes);
        fd.append('isRecurring', form.isRecurring.toString());
        if (form.isRecurring && form.recurringDay) fd.append('recurringDay', form.recurringDay);
        if (form.isRecurring && form.recurringEnd) fd.append('recurringEnd', form.recurringEnd);

        const file = receiptRef.current?.files?.[0];
        if (file) fd.append('receipt', file);

        const res = await fetch('/api/fleet/expenses', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      await refreshExpenses();
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      const res = await fetch(`/api/fleet/expenses?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function refreshExpenses() {
    const params = new URLSearchParams();
    if (filterCategory) params.set('category', filterCategory);
    if (filterTruck) params.set('truckId', filterTruck);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    if (showRecurring) params.set('recurring', 'true');
    const res = await fetch(`/api/fleet/expenses?${params}`);
    const data = await res.json();
    if (res.ok) setExpenses(data.expenses);
  }

  // Apply client-side filters for instant feedback
  const filtered = expenses.filter((e) => {
    if (filterCategory && e.category !== filterCategory) return false;
    if (filterTruck && e.truckId !== filterTruck) return false;
    if (showRecurring && !e.isRecurring) return false;
    if (filterFrom && e.date < filterFrom) return false;
    if (filterTo && e.date > filterTo + 'T23:59:59') return false;
    return true;
  });

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-steel-900">Expenses</h2>
          <span className="text-sm text-steel-500">
            {filtered.length} expenses · <span className="font-semibold">{formatCurrency(totalFiltered)}</span>
          </span>
        </div>
        <button
          onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}
          className="btn-accent text-sm"
        >
          + Add Expense
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="panel p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label text-xs">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input text-sm py-1.5">
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Truck</label>
            <select value={filterTruck} onChange={(e) => setFilterTruck(e.target.value)} className="input text-sm py-1.5">
              <option value="">All Trucks</option>
              <option value="__none">Company (no truck)</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.truckNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">From</label>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-steel-600 cursor-pointer pb-1.5">
            <input type="checkbox" checked={showRecurring} onChange={(e) => setShowRecurring(e.target.checked)} className="rounded" />
            Recurring only
          </label>
        </div>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="panel p-5 space-y-4 border-2 border-safety">
          <h3 className="font-semibold text-steel-800">{editingId ? 'Edit Expense' : 'New Expense'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Amount *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Truck</label>
              <select value={form.truckId} onChange={(e) => setForm({ ...form, truckId: e.target.value })} className="input">
                <option value="">Company-wide</option>
                {trucks.map((t) => <option key={t.id} value={t.id}>{t.truckNumber}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vendor</label>
              <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="input" placeholder="e.g. Shell, Pep Boys" />
            </div>
            <div>
              <label className="label">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="What was this for?" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Receipt Photo</label>
              <input ref={receiptRef} type="file" accept="image/*,application/pdf" className="input text-sm" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Optional notes" />
            </div>
          </div>

          {/* Recurring section */}
          <div className="border-t border-steel-200 pt-3">
            <label className="flex items-center gap-2 text-sm text-steel-700 cursor-pointer">
              <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} className="rounded" />
              <span className="font-medium">Recurring Expense</span>
              <span className="text-steel-400">(monthly insurance, lease, etc.)</span>
            </label>
            {form.isRecurring && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Day of Month (1-28)</label>
                  <input type="number" min="1" max="28" value={form.recurringDay} onChange={(e) => setForm({ ...form, recurringDay: e.target.value })} className="input" placeholder="1" />
                </div>
                <div>
                  <label className="label">End Date (optional)</label>
                  <input type="date" value={form.recurringEnd} onChange={(e) => setForm({ ...form, recurringEnd: e.target.value })} className="input" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading} className="btn-accent">
              {loading ? 'Saving...' : editingId ? 'Update Expense' : 'Add Expense'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); setError(null); }} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          {expenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match the current filters.'}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel-50 text-left text-xs text-steel-500 uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Truck</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Receipt</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {filtered.map((e) => {
                const cat = CATEGORY_MAP[e.category];
                return (
                  <tr key={e.id} className="hover:bg-steel-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString()}
                      {e.isRecurring && (
                        <span className="ml-1 text-xs text-blue-600" title={`Recurring on day ${e.recurringDay}`}>🔄</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <span>{cat?.icon || '💳'}</span>
                        <span>{cat?.label || e.category}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-steel-600">{e.truckNumber || '—'}</td>
                    <td className="px-4 py-3 text-steel-600">{e.vendor || '—'}</td>
                    <td className="px-4 py-3 text-steel-600 max-w-[200px] truncate">{e.description || e.notes || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      {e.receiptUrl ? (
                        <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs">
                          View
                        </a>
                      ) : (
                        <span className="text-steel-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button onClick={() => startEdit(e)} className="text-xs text-blue-600 hover:text-blue-800">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:text-red-700">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-steel-50 font-semibold">
                <td colSpan={5} className="px-4 py-3 text-right text-steel-600">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totalFiltered)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Category Breakdown */}
      {filtered.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold text-steel-700 mb-3">Category Breakdown</h3>
          <div className="space-y-2">
            {(() => {
              const byCategory: Record<string, number> = {};
              filtered.forEach((e) => {
                byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
              });
              const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
              const max = sorted[0]?.[1] || 1;
              return sorted.map(([cat, total]) => {
                const info = CATEGORY_MAP[cat];
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-steel-600 flex items-center gap-1">
                      {info?.icon} {info?.label || cat}
                    </span>
                    <div className="flex-1 bg-steel-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-safety h-full rounded-full transition-all"
                        style={{ width: `${(total / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-steel-800 w-24 text-right tabular-nums">
                      {formatCurrency(total)}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
