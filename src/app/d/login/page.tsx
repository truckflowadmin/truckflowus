'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function DriverLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signedOut = searchParams.get('signedout') === '1';
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLocked(false);
    setAttemptsLeft(null);
    setLoading(true);
    try {
      const res = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'locked') {
          setLocked(true);
        } else {
          setError(data.error || 'Login failed');
          if (typeof data.attemptsLeft === 'number') {
            setAttemptsLeft(data.attemptsLeft);
          }
        }
        setLoading(false);
        return;
      }
      router.push('/d/portal');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="text-4xl font-black text-white tracking-tight">TruckFlowUS</div>
        <p className="text-steel-400 text-sm mt-1">Driver Portal</p>
      </div>

      {/* Login Card */}
      <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-center text-steel-900">Sign In</h2>

        <div>
          <label className="block text-xs font-medium text-steel-600 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(239) 555-1234"
            className="w-full px-4 py-3 rounded-lg border border-steel-300 text-lg focus:outline-none focus:ring-2 focus:ring-safety focus:border-safety"
            required
            autoComplete="tel"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-steel-600 mb-1">PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full px-4 py-3 rounded-lg border border-steel-300 text-lg text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-safety focus:border-safety"
            required
            autoComplete="current-password"
          />
        </div>

        {signedOut && !error && !locked && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg text-center">You have been signed out successfully.</div>
        )}
        {locked && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">
            <p className="font-medium">Account locked</p>
            <p className="mt-1">Too many failed attempts. Please <a href="/d/reset" className="underline font-medium">reset your PIN</a> to unlock.</p>
          </div>
        )}
        {error && !locked && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">
            <p>{error}</p>
            {attemptsLeft !== null && (
              <p className="mt-1 font-medium">
                {attemptsLeft === 0
                  ? 'This was your last attempt.'
                  : `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before your account is locked.`}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !phone || pin.length < 4}
          className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="text-center">
          <a href="/d/reset" className="text-sm text-blue-600 hover:text-blue-800">
            Forgot your PIN?
          </a>
        </div>
      </form>

      <p className="text-center text-steel-500 text-xs mt-6">
        First time? Use the link your dispatcher sent you.
      </p>
    </div>
  );
}

export default function DriverLoginPage() {
  return (
    <div className="min-h-screen bg-diesel flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <DriverLoginForm />
      </Suspense>
    </div>
  );
}
