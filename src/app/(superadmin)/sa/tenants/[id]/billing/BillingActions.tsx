'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  recordPaymentAction,
  recordAdjustmentAction,
  updateCustomPriceAction,
  markOverdueAction,
  updateStatusAction,
} from './actions';

interface BillingActionsProps {
  companyId: string;
  companyName: string;
  currentStatus: string;
  customPriceCents: number | null;
  actorEmail: string;
}

export function BillingActions({
  companyId,
  companyName,
  currentStatus,
  customPriceCents,
  actorEmail,
}: BillingActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Zelle');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  // Adjustment form
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjNote, setAdjNote] = useState('');

  // Custom price form
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [newPriceDollars, setNewPriceDollars] = useState(
    customPriceCents !== null ? (customPriceCents / 100).toFixed(2) : '',
  );

  const [message, setMessage] = useState('');

  function closeAll() {
    setShowPaymentForm(false);
    setShowAdjustForm(false);
    setShowPriceForm(false);
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setMessage('Enter a valid amount');
      return;
    }

    startTransition(async () => {
      try {
        await recordPaymentAction({
          companyId,
          amountCents,
          paymentMethod,
          description: paymentDesc || `${paymentMethod} payment`,
          note: paymentNote || undefined,
          actor: actorEmail,
          periodStart: periodStart ? new Date(periodStart) : undefined,
          periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        });
        setMessage('Payment recorded');
        closeAll();
        setPaymentAmount('');
        setPaymentDesc('');
        setPaymentNote('');
        setPeriodStart('');
        setPeriodEnd('');
        router.refresh();
      } catch {
        setMessage('Failed to record payment');
      }
    });
  }

  async function handleRecordAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(adjAmount) * 100);
    if (isNaN(amountCents) || amountCents === 0) {
      setMessage('Enter a valid amount');
      return;
    }

    startTransition(async () => {
      try {
        await recordAdjustmentAction({
          companyId,
          amountCents,
          description: adjDesc || 'Manual adjustment',
          note: adjNote || undefined,
          actor: actorEmail,
        });
        setMessage('Adjustment recorded');
        closeAll();
        setAdjAmount('');
        setAdjDesc('');
        setAdjNote('');
        router.refresh();
      } catch {
        setMessage('Failed to record adjustment');
      }
    });
  }

  async function handleUpdatePrice(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = newPriceDollars
      ? Math.round(parseFloat(newPriceDollars) * 100)
      : null;

    startTransition(async () => {
      try {
        await updateCustomPriceAction(companyId, priceCents);
        setMessage(
          priceCents !== null
            ? `Custom price set to $${(priceCents / 100).toFixed(2)}/mo`
            : 'Custom price removed — using plan price',
        );
        closeAll();
        router.refresh();
      } catch {
        setMessage('Failed to update price');
      }
    });
  }

  async function handleMarkOverdue() {
    startTransition(async () => {
      try {
        await markOverdueAction(companyId, actorEmail);
        setMessage('Marked as overdue');
        router.refresh();
      } catch {
        setMessage('Failed to mark overdue');
      }
    });
  }

  async function handleStatusChange(status: string) {
    startTransition(async () => {
      try {
        await updateStatusAction(companyId, status, actorEmail);
        setMessage(`Status updated to ${status}`);
        router.refresh();
      } catch {
        setMessage('Failed to update status');
      }
    });
  }

  return (
    <div className="panel-sa space-y-4">
      <h2 className="font-semibold text-white">Actions</h2>

      {message && (
        <div className="px-3 py-2 rounded bg-purple-900/40 border border-purple-700 text-purple-200 text-sm">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => { closeAll(); setShowPaymentForm(true); }}
          className="btn-sa-primary"
        >
          Record Payment
        </button>
        <button
          onClick={() => { closeAll(); setShowAdjustForm(true); }}
          className="btn-sa-secondary"
        >
          Record Adjustment
        </button>
        <button
          onClick={() => { closeAll(); setShowPriceForm(true); }}
          className="btn-sa-secondary"
        >
          Set Custom Price
        </button>
        {currentStatus !== 'PAST_DUE' && (
          <button
            onClick={handleMarkOverdue}
            disabled={isPending}
            className="btn-sa-secondary text-red-400"
          >
            Mark Overdue
          </button>
        )}
        {currentStatus === 'PAST_DUE' && (
          <button
            onClick={() => handleStatusChange('ACTIVE')}
            disabled={isPending}
            className="btn-sa-secondary text-green-400"
          >
            Mark Active
          </button>
        )}
      </div>

      {/* ── Record Payment Form ── */}
      {showPaymentForm && (
        <form
          onSubmit={handleRecordPayment}
          className="border border-purple-800 rounded-lg p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-white">Record Payment</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-purple-400 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="49.00"
                className="input-sa w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-purple-400 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input-sa w-full"
              >
                <option value="Zelle">Zelle</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="Venmo">Venmo</option>
                <option value="CashApp">CashApp</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-purple-400 mb-1">Description</label>
              <input
                type="text"
                value={paymentDesc}
                onChange={(e) => setPaymentDesc(e.target.value)}
                placeholder="e.g. March payment"
                className="input-sa w-full"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-purple-400 mb-1">Period Start (optional)</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="input-sa w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-400 mb-1">Period End (optional)</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="input-sa w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-purple-400 mb-1">Note (optional)</label>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Internal note..."
              rows={2}
              className="input-sa w-full"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="btn-sa-primary">
              {isPending ? 'Recording…' : 'Record Payment'}
            </button>
            <button type="button" onClick={closeAll} className="btn-sa-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Record Adjustment Form ── */}
      {showAdjustForm && (
        <form
          onSubmit={handleRecordAdjustment}
          className="border border-purple-800 rounded-lg p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-white">Record Adjustment</h3>
          <p className="text-xs text-purple-400">
            Credits, discounts, or write-offs. Use negative amounts for debits.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-purple-400 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="25.00"
                className="input-sa w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-purple-400 mb-1">Description</label>
              <input
                type="text"
                value={adjDesc}
                onChange={(e) => setAdjDesc(e.target.value)}
                placeholder="e.g. First month credit"
                className="input-sa w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-purple-400 mb-1">Note (optional)</label>
            <textarea
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              placeholder="Internal note..."
              rows={2}
              className="input-sa w-full"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="btn-sa-primary">
              {isPending ? 'Recording…' : 'Record Adjustment'}
            </button>
            <button type="button" onClick={closeAll} className="btn-sa-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Custom Price Form ── */}
      {showPriceForm && (
        <form
          onSubmit={handleUpdatePrice}
          className="border border-purple-800 rounded-lg p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-white">Custom Price Override</h3>
          <p className="text-xs text-purple-400">
            Set a custom monthly price for this tenant. Leave blank to revert to the plan price.
          </p>
          <div className="max-w-xs">
            <label className="block text-xs text-purple-400 mb-1">
              Custom Price ($/month)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPriceDollars}
              onChange={(e) => setNewPriceDollars(e.target.value)}
              placeholder="Leave blank for plan price"
              className="input-sa w-full"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="btn-sa-primary">
              {isPending ? 'Saving…' : 'Save Price'}
            </button>
            {customPriceCents !== null && (
              <button
                type="button"
                onClick={() => {
                  setNewPriceDollars('');
                  startTransition(async () => {
                    try {
                      await updateCustomPriceAction(companyId, null);
                      setMessage('Custom price removed');
                      closeAll();
                      router.refresh();
                    } catch {
                      setMessage('Failed to remove price override');
                    }
                  });
                }}
                disabled={isPending}
                className="btn-sa-secondary text-red-400"
              >
                Remove Override
              </button>
            )}
            <button type="button" onClick={closeAll} className="btn-sa-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
