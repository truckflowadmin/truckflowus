'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setTrialEndDateAction,
  setNextPaymentDueAction,
  setGracePeriodAction,
  toggleAutoSuspendAction,
  suspendForNonPaymentAction,
  reactivateAccountAction,
  logPaymentReminderAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from './actions';

interface BillingControlsProps {
  companyId: string;
  companyName: string;
  actorEmail: string;
  trialEndsAt: string | null;
  nextPaymentDue: string | null;
  gracePeriodDays: number;
  autoSuspendOnOverdue: boolean;
  suspended: boolean;
  subscriptionPausedAt: string | null;
  lastPaymentDate: string | null;
  currentStatus: string;
}

export function BillingControls({
  companyId,
  companyName,
  actorEmail,
  trialEndsAt,
  nextPaymentDue,
  gracePeriodDays,
  autoSuspendOnOverdue,
  suspended,
  subscriptionPausedAt,
  lastPaymentDate,
  currentStatus,
}: BillingControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  // Trial
  const [trialDate, setTrialDate] = useState(trialEndsAt ? trialEndsAt.slice(0, 10) : '');
  // Next payment
  const [payDueDate, setPayDueDate] = useState(nextPaymentDue ? nextPaymentDue.slice(0, 10) : '');
  // Grace period
  const [grace, setGrace] = useState(String(gracePeriodDays));
  // Auto-suspend
  const [autoSuspend, setAutoSuspend] = useState(autoSuspendOnOverdue);
  // Reminder
  const [showReminder, setShowReminder] = useState(false);
  const [reminderMethod, setReminderMethod] = useState('Phone Call');
  const [reminderNote, setReminderNote] = useState('');
  // Suspend/reactivate note
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [suspendNote, setSuspendNote] = useState('');
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [reactivateNote, setReactivateNote] = useState('');

  function flash(msg: string, type: 'success' | 'error' = 'success') {
    setMessage(msg);
    setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  }

  // ── Overdue calculation ──────────────────────────────────
  const now = new Date();
  let overdueDays = 0;
  if (nextPaymentDue) {
    const due = new Date(nextPaymentDue);
    if (now > due) {
      overdueDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  let trialDaysLeft = 0;
  if (trialEndsAt) {
    const end = new Date(trialEndsAt);
    trialDaysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // ── Handlers ──────────────────────────────────────────────

  async function handleSetTrialDate() {
    startTransition(async () => {
      try {
        await setTrialEndDateAction(
          companyId,
          trialDate ? new Date(trialDate + 'T23:59:59') : null,
          actorEmail,
        );
        flash(trialDate ? `Trial end date set to ${trialDate}` : 'Trial end date cleared');
        router.refresh();
      } catch {
        flash('Failed to update trial date', 'error');
      }
    });
  }

  async function handleSetPayDue() {
    startTransition(async () => {
      try {
        await setNextPaymentDueAction(
          companyId,
          payDueDate ? new Date(payDueDate + 'T00:00:00') : null,
          actorEmail,
        );
        flash(payDueDate ? `Next payment due set to ${payDueDate}` : 'Payment due date cleared');
        router.refresh();
      } catch {
        flash('Failed to update payment due date', 'error');
      }
    });
  }

  async function handleSetGrace() {
    const days = parseInt(grace, 10);
    if (isNaN(days) || days < 0 || days > 90) {
      flash('Enter a value between 0 and 90', 'error');
      return;
    }
    startTransition(async () => {
      try {
        await setGracePeriodAction(companyId, days, actorEmail);
        flash(`Grace period set to ${days} days`);
        router.refresh();
      } catch {
        flash('Failed to update grace period', 'error');
      }
    });
  }

  async function handleToggleAutoSuspend() {
    const newVal = !autoSuspend;
    setAutoSuspend(newVal);
    startTransition(async () => {
      try {
        await toggleAutoSuspendAction(companyId, newVal, actorEmail);
        flash(`Auto-suspend ${newVal ? 'enabled' : 'disabled'}`);
        router.refresh();
      } catch {
        setAutoSuspend(!newVal);
        flash('Failed to toggle auto-suspend', 'error');
      }
    });
  }

  async function handleSuspend() {
    startTransition(async () => {
      try {
        await suspendForNonPaymentAction(companyId, actorEmail, suspendNote || undefined);
        flash('Account suspended for non-payment');
        setShowSuspendConfirm(false);
        setSuspendNote('');
        router.refresh();
      } catch {
        flash('Failed to suspend account', 'error');
      }
    });
  }

  async function handleReactivate() {
    startTransition(async () => {
      try {
        await reactivateAccountAction(companyId, actorEmail, reactivateNote || undefined);
        flash('Account reactivated');
        setShowReactivateConfirm(false);
        setReactivateNote('');
        router.refresh();
      } catch {
        flash('Failed to reactivate account', 'error');
      }
    });
  }

  async function handleLogReminder() {
    startTransition(async () => {
      try {
        await logPaymentReminderAction(companyId, reminderMethod, actorEmail, reminderNote || undefined);
        flash(`Payment reminder logged (${reminderMethod})`);
        setShowReminder(false);
        setReminderNote('');
        router.refresh();
      } catch {
        flash('Failed to log reminder', 'error');
      }
    });
  }

  async function handlePause() {
    startTransition(async () => {
      try {
        await pauseSubscriptionAction(companyId, actorEmail);
        flash('Subscription paused');
        router.refresh();
      } catch {
        flash('Failed to pause subscription', 'error');
      }
    });
  }

  async function handleResume() {
    startTransition(async () => {
      try {
        await resumeSubscriptionAction(companyId, actorEmail);
        flash('Subscription resumed');
        router.refresh();
      } catch {
        flash('Failed to resume subscription', 'error');
      }
    });
  }

  return (
    <div className="panel-sa space-y-5">
      <h2 className="font-semibold text-white">Tenant Controls</h2>

      {message && (
        <div className={`px-3 py-2 rounded text-sm border ${
          msgType === 'success'
            ? 'bg-green-900/40 border-green-700 text-green-200'
            : 'bg-red-900/40 border-red-700 text-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* ── Status Alerts ── */}
      {overdueDays > 0 && (
        <div className="px-3 py-2 rounded bg-red-900/40 border border-red-700 text-red-200 text-sm flex items-center justify-between">
          <span>Payment is <strong>{overdueDays} day{overdueDays !== 1 ? 's' : ''}</strong> overdue
            {gracePeriodDays > 0 && overdueDays <= gracePeriodDays && (
              <> — within {gracePeriodDays}-day grace period</>
            )}
            {gracePeriodDays > 0 && overdueDays > gracePeriodDays && (
              <> — <strong>past grace period</strong></>
            )}
          </span>
        </div>
      )}

      {trialEndsAt && trialDaysLeft > 0 && trialDaysLeft <= 7 && (
        <div className="px-3 py-2 rounded bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm">
          Trial ends in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong>
        </div>
      )}

      {suspended && (
        <div className="px-3 py-2 rounded bg-red-900/50 border border-red-600 text-red-100 text-sm font-medium">
          This account is currently <strong>SUSPENDED</strong>
        </div>
      )}

      {subscriptionPausedAt && !suspended && (
        <div className="px-3 py-2 rounded bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm">
          Subscription is <strong>PAUSED</strong> since {new Date(subscriptionPausedAt).toLocaleDateString()}
        </div>
      )}

      {/* ── Trial Management ── */}
      <div className="border border-purple-800/60 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-purple-300">Trial Period</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-purple-400 mb-1">Trial End Date</label>
            <input
              type="date"
              value={trialDate}
              onChange={(e) => setTrialDate(e.target.value)}
              className="input-sa"
            />
          </div>
          <button onClick={handleSetTrialDate} disabled={isPending} className="btn-sa-primary text-sm">
            {isPending ? 'Saving...' : 'Set Trial Date'}
          </button>
          {trialEndsAt && (
            <button
              onClick={() => { setTrialDate(''); }}
              className="btn-sa-secondary text-sm text-red-400"
            >
              Clear
            </button>
          )}
        </div>
        {trialEndsAt && (
          <p className="text-xs text-purple-400">
            Current: {new Date(trialEndsAt).toLocaleDateString()}
            {trialDaysLeft > 0 ? ` (${trialDaysLeft} days left)` : ' (expired)'}
          </p>
        )}
      </div>

      {/* ── Payment Due Date & Grace Period ── */}
      <div className="border border-purple-800/60 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-purple-300">Payment Schedule</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs text-purple-400">Next Payment Due</label>
            <div className="flex items-end gap-2">
              <input
                type="date"
                value={payDueDate}
                onChange={(e) => setPayDueDate(e.target.value)}
                className="input-sa"
              />
              <button onClick={handleSetPayDue} disabled={isPending} className="btn-sa-primary text-sm">
                Set
              </button>
            </div>
            {nextPaymentDue && (
              <p className="text-xs text-purple-400">
                Current: {new Date(nextPaymentDue).toLocaleDateString()}
                {overdueDays > 0 && <span className="text-red-400 ml-1">({overdueDays}d overdue)</span>}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-purple-400">Grace Period (days)</label>
            <div className="flex items-end gap-2">
              <input
                type="number"
                min="0"
                max="90"
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
                className="input-sa w-20"
              />
              <button onClick={handleSetGrace} disabled={isPending} className="btn-sa-primary text-sm">
                Set
              </button>
            </div>
            <p className="text-xs text-purple-400">Days allowed after due date before action is taken</p>
          </div>
        </div>
        {lastPaymentDate && (
          <p className="text-xs text-purple-400">
            Last payment received: {new Date(lastPaymentDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* ── Auto-Suspend Toggle ── */}
      <div className="border border-purple-800/60 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-purple-300">Enforcement</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={handleToggleAutoSuspend}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              autoSuspend ? 'bg-red-600' : 'bg-purple-800'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              autoSuspend ? 'translate-x-5' : ''
            }`} />
          </div>
          <span className="text-sm text-purple-200">
            Auto-suspend when payment overdue past grace period
          </span>
        </label>
        <p className="text-xs text-purple-500">
          When enabled, the account will be automatically suspended if payment is not received within {gracePeriodDays} day{gracePeriodDays !== 1 ? 's' : ''} of the due date.
        </p>
      </div>

      {/* ── Pause / Resume Subscription ── */}
      <div className="border border-purple-800/60 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-purple-300">Subscription Control</h3>
        <div className="flex flex-wrap gap-3">
          {!subscriptionPausedAt && currentStatus !== 'PAUSED' ? (
            <button
              onClick={handlePause}
              disabled={isPending || suspended}
              className="btn-sa-secondary text-yellow-400 text-sm"
            >
              Pause Subscription
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={isPending}
              className="btn-sa-secondary text-green-400 text-sm"
            >
              Resume Subscription
            </button>
          )}

          {!suspended ? (
            <button
              onClick={() => setShowSuspendConfirm(true)}
              disabled={isPending}
              className="btn-sa-secondary text-red-400 text-sm"
            >
              Suspend Account
            </button>
          ) : (
            <button
              onClick={() => setShowReactivateConfirm(true)}
              disabled={isPending}
              className="btn-sa-secondary text-green-400 text-sm"
            >
              Reactivate Account
            </button>
          )}

          <button
            onClick={() => setShowReminder(!showReminder)}
            className="btn-sa-secondary text-sm"
          >
            Log Payment Reminder
          </button>
        </div>

        {/* Suspend confirmation */}
        {showSuspendConfirm && (
          <div className="border border-red-700 rounded p-3 space-y-2 bg-red-900/20">
            <p className="text-sm text-red-200">
              Suspend <strong>{companyName}</strong>? Dispatchers and drivers will lose access.
            </p>
            <textarea
              value={suspendNote}
              onChange={(e) => setSuspendNote(e.target.value)}
              placeholder="Reason for suspension (optional)..."
              rows={2}
              className="input-sa w-full"
            />
            <div className="flex gap-2">
              <button onClick={handleSuspend} disabled={isPending} className="btn-sa-primary bg-red-700 hover:bg-red-600 text-sm">
                {isPending ? 'Suspending...' : 'Confirm Suspend'}
              </button>
              <button onClick={() => setShowSuspendConfirm(false)} className="btn-sa-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Reactivate confirmation */}
        {showReactivateConfirm && (
          <div className="border border-green-700 rounded p-3 space-y-2 bg-green-900/20">
            <p className="text-sm text-green-200">
              Reactivate <strong>{companyName}</strong>? Access will be restored immediately.
            </p>
            <textarea
              value={reactivateNote}
              onChange={(e) => setReactivateNote(e.target.value)}
              placeholder="Note (optional)..."
              rows={2}
              className="input-sa w-full"
            />
            <div className="flex gap-2">
              <button onClick={handleReactivate} disabled={isPending} className="btn-sa-primary text-sm">
                {isPending ? 'Reactivating...' : 'Confirm Reactivate'}
              </button>
              <button onClick={() => setShowReactivateConfirm(false)} className="btn-sa-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Reminder form */}
        {showReminder && (
          <div className="border border-purple-800 rounded p-3 space-y-2">
            <p className="text-xs text-purple-400">Log that a payment reminder was sent to this tenant.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-purple-400 mb-1">Method</label>
                <select
                  value={reminderMethod}
                  onChange={(e) => setReminderMethod(e.target.value)}
                  className="input-sa"
                >
                  <option value="Phone Call">Phone Call</option>
                  <option value="Text/SMS">Text/SMS</option>
                  <option value="Email">Email</option>
                  <option value="In-Person">In-Person</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-purple-400 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="e.g. Left voicemail"
                  className="input-sa w-full"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleLogReminder} disabled={isPending} className="btn-sa-primary text-sm">
                {isPending ? 'Logging...' : 'Log Reminder'}
              </button>
              <button onClick={() => setShowReminder(false)} className="btn-sa-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
