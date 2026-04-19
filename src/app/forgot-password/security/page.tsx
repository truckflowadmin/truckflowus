'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 'email' | 'questions' | 'new-password' | 'success' | 'locked';

export default function SecurityResetPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [lockMinutes, setLockMinutes] = useState(0);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/security-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-questions', email }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'no_questions') {
          setError('No security questions found for this email. Use the email reset link instead.');
        } else {
          setError(data.error || 'Something went wrong');
        }
        return;
      }

      setQuestions(data.questions);
      setStep('questions');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/security-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-answers',
          email,
          a1: answers[0],
          a2: answers[1],
          a3: answers[2],
        }),
      });

      const data = await res.json();

      if (data.error === 'locked') {
        setLockMinutes(data.minutesLeft || 15);
        setStep('locked');
        return;
      }

      if (data.error === 'wrong_answers') {
        setAttemptsLeft(data.attemptsLeft);
        setError(`Incorrect answers. ${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} remaining.`);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      setResetToken(data.resetToken);
      setStep('new-password');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/security-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          token: resetToken,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setStep('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">TF</div>
            <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
          </div>
          <p className="text-steel-400 text-sm mt-2">Reset password via security questions</p>
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="panel p-6 space-y-4">
            <p className="text-sm text-steel-600">
              Enter your email address to verify your identity with security questions.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-accent w-full" disabled={loading}>
              {loading ? 'Looking up…' : 'Continue'}
            </button>
            <div className="text-center space-y-2">
              <Link href="/forgot-password" className="text-sm text-steel-500 hover:text-steel-700 block">
                Reset via email instead
              </Link>
              <Link href="/login" className="text-sm text-steel-500 hover:text-steel-700 block">
                Back to sign in
              </Link>
            </div>
          </form>
        )}

        {/* Step 2: Answer Security Questions */}
        {step === 'questions' && (
          <form onSubmit={handleAnswersSubmit} className="panel p-6 space-y-4">
            <p className="text-sm text-steel-600">
              Answer your 3 security questions to verify your identity.
            </p>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            {questions.map((q, i) => (
              <div key={i}>
                <label className="label">{q}</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  autoFocus={i === 0}
                />
              </div>
            ))}
            <button type="submit" className="btn-accent w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify Answers'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); }}
                className="text-sm text-steel-500 hover:text-steel-700"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Set New Password */}
        {step === 'new-password' && (
          <form onSubmit={handlePasswordSubmit} className="panel p-6 space-y-4">
            <div className="text-center mb-2">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-sm text-green-700 font-medium">Identity verified</p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            <div>
              <label className="label" htmlFor="newPw">New Password</label>
              <input
                id="newPw"
                type="password"
                required
                minLength={6}
                autoFocus
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="confirmPw">Confirm Password</label>
              <input
                id="confirmPw"
                type="password"
                required
                minLength={6}
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-accent w-full" disabled={loading}>
              {loading ? 'Saving…' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="panel p-6 text-center">
            <div className="text-3xl mb-3">✓</div>
            <h2 className="font-bold text-lg text-steel-900 mb-2">Password updated</h2>
            <p className="text-sm text-steel-600 mb-4">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link href="/login" className="btn-accent inline-block px-8">
              Sign In
            </Link>
          </div>
        )}

        {/* Locked out */}
        {step === 'locked' && (
          <div className="panel p-6 text-center">
            <div className="text-3xl mb-3">🔒</div>
            <h2 className="font-bold text-lg text-steel-900 mb-2">Too many attempts</h2>
            <p className="text-sm text-steel-600 mb-4">
              Your account has been temporarily locked for {lockMinutes} minutes due to too many failed attempts.
            </p>
            <p className="text-sm text-steel-600 mb-4">
              You can still reset your password via email:
            </p>
            <Link href="/forgot-password" className="btn-accent inline-block px-8 mb-3">
              Reset via Email
            </Link>
            <div>
              <Link href="/login" className="text-sm text-steel-500 hover:text-steel-700">
                Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
