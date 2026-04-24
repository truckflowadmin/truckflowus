'use client';

import { useState, useEffect, useCallback } from 'react';

interface BillingEvent {
  id: string;
  type: string;
  amountCents: number;
  subscriptionStatus: string | null;
  paymentMethod: string | null;
  description: string;
  note: string | null;
  createdAt: string;
}

interface BillingSectionProps {
  planName: string | null;
  planPrice: string | null;
  subscriptionStatus: string | null;
  paypalPayerEmail: string | null;
  paypalSubscriptionId: string | null;
  planId: string | null;
  nextPaymentDue: string | null;
}

export default function BillingSection({
  planName,
  planPrice,
  subscriptionStatus,
  paypalPayerEmail,
  paypalSubscriptionId,
  planId,
  nextPaymentDue,
}: BillingSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [receiptEvent, setReceiptEvent] = useState<BillingEvent | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/billing/history');
      const data = await res.json();
      setBillingHistory(data.events || []);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showHistory && billingHistory.length === 0) {
      fetchHistory();
    }
  }, [showHistory, billingHistory.length, fetchHistory]);

  const isActive = subscriptionStatus === 'ACTIVE';
  const isPending = subscriptionStatus === 'APPROVAL_PENDING';
  const isCancelled = subscriptionStatus === 'CANCELLED';
  const isSuspended = subscriptionStatus === 'SUSPENDED';
  const isPaymentFailed = subscriptionStatus === 'PAYMENT_FAILED';
  const isExpired = subscriptionStatus === 'EXPIRED';
  const hasSubscription = !!paypalSubscriptionId && !isCancelled && !isExpired;

  async function handleSubscribe() {
    if (!planId) {
      setError('No plan assigned. Contact your administrator.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/paypal/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start subscription');
      // Redirect to PayPal approval page
      window.location.href = data.approvalUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/paypal/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      setSuccess('Subscription cancelled. Redirecting to plans page...');
      // Redirect to subscribe page so they can resubscribe
      setTimeout(() => {
        window.location.href = '/subscribe';
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  function statusBadge() {
    if (isActive) return <span className="badge bg-green-100 text-green-800">Active</span>;
    if (isPending) return <span className="badge bg-yellow-100 text-yellow-800">Awaiting Approval</span>;
    if (isSuspended) return <span className="badge bg-orange-100 text-orange-800">Suspended</span>;
    if (isPaymentFailed) return <span className="badge bg-red-100 text-red-800">Payment Failed</span>;
    if (isCancelled) return <span className="badge bg-steel-200 text-steel-700">Cancelled</span>;
    if (isExpired) return <span className="badge bg-steel-200 text-steel-700">Expired</span>;
    return <span className="badge bg-steel-100 text-steel-500">No Subscription</span>;
  }

  return (
    <section className="panel p-6 mb-6">
      <h2 className="font-semibold text-lg mb-4">Billing & Subscription</h2>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
          {success}
        </div>
      )}

      {/* Status overview */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-steel-600">Plan</span>
          <span className="text-sm font-medium">{planName || 'None'} {planPrice ? `(${planPrice})` : ''}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-steel-600">Subscription Status</span>
          {statusBadge()}
        </div>
        {paypalPayerEmail && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-steel-600">PayPal Account</span>
            <span className="text-sm text-steel-700">{paypalPayerEmail}</span>
          </div>
        )}
        {nextPaymentDue && isActive && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-steel-600">Next Payment</span>
            <span className="text-sm text-steel-700">
              {new Date(nextPaymentDue).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Payment failure warning */}
      {(isPaymentFailed || isSuspended) && (
        <div className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded px-3 py-2 mb-4">
          {isPaymentFailed
            ? 'Your last payment failed. Please update your payment method on PayPal to avoid account suspension.'
            : 'Your subscription is suspended due to a payment issue. Please resolve it on PayPal to restore access.'}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-steel-200 pt-4 flex items-center gap-3">
        {/* Show link to subscribe page when no active subscription */}
        {(!subscriptionStatus || isCancelled || isExpired) && (
          <a
            href="/subscribe"
            className="btn-accent flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.667c-.535 0-.988.393-1.07.927l-.96 6.079z" />
            </svg>
            Choose a Plan
          </a>
        )}

        {/* Show Cancel button when subscription is active */}
        {isActive && hasSubscription && !showCancelConfirm && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="btn-outline text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-2"
          >
            Cancel Subscription
          </button>
        )}

        {/* Pending state */}
        {isPending && (
          <p className="text-sm text-yellow-700">
            Your subscription is awaiting PayPal approval.{' '}
            <button onClick={() => window.location.reload()} className="underline font-medium">
              Refresh status
            </button>
          </p>
        )}
      </div>

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className="mt-4 border border-red-200 bg-red-50 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-red-800">Are you sure you want to cancel?</h3>
          <p className="text-sm text-red-700">
            Your PayPal subscription will be cancelled immediately. Your account will be suspended
            and you will lose access to all dispatcher features until you resubscribe.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Yes, Cancel My Subscription
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-steel-600 hover:text-steel-800"
            >
              Keep Subscription
            </button>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="border-t border-steel-200 mt-5 pt-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-sm font-semibold text-steel-700 hover:text-steel-900 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Payment History
        </button>

        {showHistory && (
          <div className="mt-3">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-steel-500 py-4">
                <span className="inline-block w-4 h-4 border-2 border-steel-400 border-t-transparent rounded-full animate-spin" />
                Loading history...
              </div>
            ) : billingHistory.length === 0 ? (
              <p className="text-sm text-steel-500 py-3">No billing events yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {billingHistory.map((ev) => {
                  const isPayment = ev.type === 'PAYMENT' && ev.amountCents > 0;
                  const date = new Date(ev.createdAt);
                  const dateStr = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const timeStr = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isPayment
                          ? 'border-green-200 bg-green-50'
                          : 'border-steel-200 bg-steel-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isPayment ? (
                            <span className="text-green-600 text-xs font-semibold">PAYMENT</span>
                          ) : (
                            <span className="text-steel-500 text-xs font-semibold uppercase">
                              {ev.type.replace('_', ' ')}
                            </span>
                          )}
                          <span className="text-xs text-steel-400">{dateStr} {timeStr}</span>
                        </div>
                        <p className="text-sm text-steel-700 mt-0.5 truncate">{ev.description}</p>
                        {ev.paymentMethod && (
                          <span className="text-xs text-steel-500">via {ev.paymentMethod}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        {isPayment && (
                          <span className="text-sm font-semibold text-green-700">
                            ${(ev.amountCents / 100).toFixed(2)}
                          </span>
                        )}
                        {isPayment && (
                          <button
                            onClick={() => setReceiptEvent(ev)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            title="View receipt"
                          >
                            Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {receiptEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReceiptEvent(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 print:shadow-none print:max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Receipt header */}
            <div className="bg-diesel text-white p-5 rounded-t-xl print:bg-gray-900">
              <div className="text-center">
                <h3 className="text-lg font-bold tracking-wide text-safety">TruckFlowUS</h3>
                <p className="text-xs text-steel-300 mt-1">Payment Receipt</p>
              </div>
            </div>

            {/* Receipt body */}
            <div className="p-6 space-y-4">
              <div className="text-center border-b border-steel-200 pb-4">
                <span className="text-3xl font-bold text-green-700">
                  ${(receiptEvent.amountCents / 100).toFixed(2)}
                </span>
                <p className="text-sm text-steel-500 mt-1">Payment Received</p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-steel-500">Date</span>
                  <span className="font-medium">
                    {new Date(receiptEvent.createdAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">Plan</span>
                  <span className="font-medium">{planName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-500">Payment Method</span>
                  <span className="font-medium">{receiptEvent.paymentMethod || 'PayPal'}</span>
                </div>
                {receiptEvent.note && (
                  <div className="flex justify-between">
                    <span className="text-steel-500">Transaction ID</span>
                    <span className="font-medium text-xs break-all max-w-[200px] text-right">
                      {receiptEvent.note.replace('PayPal txn: ', '')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-steel-500">Description</span>
                  <span className="font-medium text-right max-w-[250px]">{receiptEvent.description}</span>
                </div>
              </div>

              <div className="border-t border-steel-200 pt-3 text-center text-xs text-steel-400">
                TruckFlowUS &middot; Dump Truck Dispatch Software<br />
                truckflowus.com &middot; admin@truckflowus.com
              </div>
            </div>

            {/* Receipt actions */}
            <div className="border-t border-steel-200 p-4 flex items-center justify-between print:hidden">
              <button
                onClick={() => setReceiptEvent(null)}
                className="text-sm text-steel-500 hover:text-steel-700"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-diesel text-white text-sm font-semibold hover:bg-diesel/90 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
