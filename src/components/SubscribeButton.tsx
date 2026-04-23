'use client';

import { useState } from 'react';

interface SubscribeButtonProps {
  planId: string;
  planName: string;
  isCurrent: boolean;
  /** True if the user already has an active subscription and is changing plans */
  isChangePlan?: boolean;
  /** True if the target plan is cheaper than the current plan */
  isDowngrade?: boolean;
  /** Limits on the target plan */
  targetMaxDrivers?: number | null;
  targetMaxTickets?: number | null;
  /** Current usage counts */
  currentDrivers?: number;
  currentMonthTickets?: number;
}

export default function SubscribeButton({
  planId,
  planName,
  isCurrent,
  isChangePlan,
  isDowngrade,
  targetMaxDrivers,
  targetMaxTickets,
  currentDrivers = 0,
  currentMonthTickets = 0,
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if downgrade will cause limits to be exceeded
  const driversWillExceed = targetMaxDrivers != null && currentDrivers > targetMaxDrivers;
  const ticketsWillExceed = targetMaxTickets != null && currentMonthTickets > targetMaxTickets;
  const hasLimitImpact = isDowngrade && (driversWillExceed || ticketsWillExceed);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      // Use change-plan endpoint if already subscribed, otherwise fresh subscribe
      const endpoint = isChangePlan ? '/api/paypal/change-plan' : '/api/paypal/subscribe';
      const res = await fetch(endpoint, {
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

  function handleClick() {
    if (isDowngrade) {
      setShowConfirm(true);
    } else {
      handleSubscribe();
    }
  }

  function confirmDowngrade() {
    setShowConfirm(false);
    handleSubscribe();
  }

  // Button label
  let label = isCurrent ? 'Activate with PayPal' : `Get ${planName}`;
  if (isChangePlan && isDowngrade) label = `Downgrade to ${planName}`;
  else if (isChangePlan) label = `Upgrade to ${planName}`;

  return (
    <div>
      {error && (
        <p className="text-xs text-red-600 mb-2 text-center">{error}</p>
      )}

      <button
        onClick={handleClick}
        disabled={loading}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
          isDowngrade
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-diesel text-white hover:bg-steel-800'
        }`}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.667c-.535 0-.988.393-1.07.927l-.96 6.079z" />
          </svg>
        )}
        {label}
      </button>

      {/* Downgrade confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-steel-900">Confirm Downgrade</h3>
                  <p className="text-xs text-steel-500">Switching to {planName}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-steel-700">
                You are about to downgrade your subscription. Please review the following before continuing:
              </p>

              {/* Impact warnings */}
              {hasLimitImpact && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-800">
                    This downgrade will exceed your new plan limits:
                  </p>
                  {driversWillExceed && targetMaxDrivers != null && (
                    <div className="flex items-start gap-2 text-xs text-red-700">
                      <span className="text-red-500 mt-0.5 font-bold">!</span>
                      <span>
                        <strong>Drivers:</strong> You currently have {currentDrivers} driver{currentDrivers !== 1 ? 's' : ''}, but the {planName} plan only allows {targetMaxDrivers}. You won't be able to add new drivers until you're under the limit.
                      </span>
                    </div>
                  )}
                  {ticketsWillExceed && targetMaxTickets != null && (
                    <div className="flex items-start gap-2 text-xs text-red-700">
                      <span className="text-red-500 mt-0.5 font-bold">!</span>
                      <span>
                        <strong>Tickets:</strong> You've used {currentMonthTickets} ticket{currentMonthTickets !== 1 ? 's' : ''} this month, but the {planName} plan only allows {targetMaxTickets}/month. You won't be able to create new tickets until next month.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* General downgrade info */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">What happens when you downgrade:</p>
                <ul className="space-y-1.5 text-xs text-amber-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Your current PayPal subscription will be cancelled and a new one created at the lower rate.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Features not included in the {planName} plan will become unavailable.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Your existing data (tickets, drivers, invoices) will not be deleted.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>You can upgrade again at any time to restore full access.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-steel-50 border-t border-steel-200 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-steel-300 text-steel-700 hover:bg-steel-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDowngrade}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Confirm Downgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
