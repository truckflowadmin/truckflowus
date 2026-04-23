'use client';

import { useState } from 'react';

interface SubscribeButtonProps {
  planId: string;
  planName: string;
  isCurrent: boolean;
}

export default function SubscribeButton({ planId, planName, isCurrent }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/paypal/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');
      // Redirect to PayPal checkout
      window.location.href = data.approvalUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="text-xs text-red-600 mb-2 text-center">{error}</p>
      )}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-diesel text-white hover:bg-steel-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.667c-.535 0-.988.393-1.07.927l-.96 6.079z" />
          </svg>
        )}
        {isCurrent ? 'Activate with PayPal' : `Get ${planName}`}
      </button>
    </div>
  );
}
