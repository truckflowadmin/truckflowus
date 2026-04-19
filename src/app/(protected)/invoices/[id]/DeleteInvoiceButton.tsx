'use client';

import { useState } from 'react';

export default function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!confirm('Cancel this invoice? Tickets will be released back to Ready to Bill.')) return;

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error || `Cancel failed (${res.status})`);
        setCancelling(false);
        return;
      }

      // Hard navigate with cache bust to force fresh data
      window.location.replace('/invoices?_t=' + Date.now());
    } catch (e: any) {
      setError(e.message || 'Network error');
      setCancelling(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={cancelling}
        className="btn-ghost text-red-600 border-red-200"
      >
        {cancelling ? 'Cancelling...' : 'Cancel Invoice'}
      </button>
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
}
