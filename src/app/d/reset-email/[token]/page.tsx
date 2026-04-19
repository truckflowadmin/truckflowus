'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

type Step = 'new-pin' | 'done' | 'error';

export default function EmailResetPage() {
  const router = useRouter();
  const params = useParams();
  const resetToken = params.token as string;

  const [step, setStep] = useState<Step>('new-pin');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [driverName, setDriverName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNewPin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be 4-6 digits');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setError('PIN must be numbers only');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-pin-email', resetToken, newPin }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410 || res.status === 404) {
          setError(data.error || 'This link has expired.');
          setStep('error');
        } else {
          setError(data.error || 'Reset failed');
        }
        setLoading(false);
        return;
      }

      setDriverName(data.driverName || '');
      setStep('done');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-diesel flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="text-4xl font-black text-white tracking-tight">TruckFlowUS</div>
          <p className="text-steel-400 text-sm mt-1">Reset Your PIN</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Set New PIN */}
          {step === 'new-pin' && (
            <form onSubmit={handleNewPin} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-steel-900">Create New PIN</h2>
                <p className="text-sm text-steel-500 mt-1">Choose a new 4-6 digit PIN for your account</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">New PIN (4-6 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-lg border border-steel-300 text-lg text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-lg border border-steel-300 text-lg text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || newPin.length < 4}
                className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset PIN'}
              </button>
            </form>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold text-steel-900">
                {driverName ? `Welcome back, ${driverName}!` : 'PIN Reset Successfully!'}
              </h2>
              <p className="text-sm text-steel-500">Your PIN has been updated. You can now sign in.</p>
              <button
                onClick={() => router.push('/d/login')}
                className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {/* Error / Expired */}
          {step === 'error' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold text-steel-900">Link Expired</h2>
              <p className="text-sm text-steel-500">{error || 'This reset link is no longer valid.'}</p>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/d/reset')}
                  className="w-full py-3 bg-safety text-diesel font-bold rounded-lg hover:bg-safety-dark transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push('/d/login')}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-steel-500 text-xs mt-6">
          Remember your PIN?{' '}
          <a href="/d/login" className="text-blue-400 hover:text-blue-300">Sign in</a>
        </p>
      </div>
    </div>
  );
}
