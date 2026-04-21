'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ResetStep = 'phone' | 'questions' | 'new-pin' | 'done' | 'locked';

export default function DriverResetPage() {
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>('phone');
  const [phone, setPhone] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [driverName, setDriverName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [emailSent, setEmailSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  // Step 1: Enter phone → get security questions
  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-questions', phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Account not found');
        setLoading(false);
        return;
      }
      setQuestions(data.questions);
      setHasEmail(!!data.hasEmail);
      setStep('questions');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  // Step 2: Answer security questions → get reset token
  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (answers.some((a) => !a.trim())) {
      setError('Please answer all 3 questions');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-verify',
          phone,
          answer1: answers[0],
          answer2: answers[1],
          answer3: answers[2],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Check if attempts exhausted → show email reset option
        if (data.attemptsExhausted) {
          if (data.hasEmail !== undefined) setHasEmail(data.hasEmail);
          setError(data.error || 'Too many failed attempts.');
          setStep('locked');
          setLoading(false);
          return;
        }
        // Show remaining attempts
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }
      setResetToken(data.resetToken);
      setDriverName(data.driverName);
      setStep('new-pin');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  // Send reset link via email
  async function handleSendResetEmail() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-reset-email', phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send email');
        setLoading(false);
        return;
      }
      setMaskedEmail(data.maskedEmail || '');
      setEmailSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  // Step 3: Set new PIN
  async function handleNewPin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setError('PIN must be exactly 6 digits');
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
        body: JSON.stringify({ action: 'reset-pin', resetToken, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Reset failed');
        setLoading(false);
        return;
      }
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
          {/* Progress */}
          {step !== 'locked' && (
            <div className="flex items-center gap-2 mb-5">
              <div className={`flex-1 h-1.5 rounded-full ${step !== 'phone' ? 'bg-safety' : 'bg-safety'}`} />
              <div className={`flex-1 h-1.5 rounded-full ${step === 'questions' || step === 'new-pin' || step === 'done' ? 'bg-safety' : 'bg-steel-200'}`} />
              <div className={`flex-1 h-1.5 rounded-full ${step === 'new-pin' || step === 'done' ? 'bg-safety' : 'bg-steel-200'}`} />
            </div>
          )}

          {/* Step 1: Phone */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-steel-900">Find Your Account</h2>
                <p className="text-sm text-steel-500 mt-1">Enter the phone number on your account</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(239) 555-1234"
                  className="w-full px-4 py-3 rounded-lg border border-steel-300 text-lg focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                  autoComplete="tel"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Looking up...' : 'Continue'}
              </button>

              <div className="text-center">
                <a href="/d/login" className="text-sm text-blue-600 hover:text-blue-800">
                  Back to Sign In
                </a>
              </div>
            </form>
          )}

          {/* Step 2: Answer Security Questions */}
          {step === 'questions' && (
            <form onSubmit={handleAnswersSubmit} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-steel-900">Security Questions</h2>
                <p className="text-sm text-steel-500 mt-1">Answer the questions you set during signup</p>
              </div>

              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-steel-600 mb-1">
                    {q}
                  </label>
                  <input
                    type="text"
                    value={answers[i]}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                    placeholder="Your answer"
                    className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                    required
                  />
                </div>
              ))}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError(''); setAnswers(['', '', '']); }}
                  className="flex-1 py-3 border border-steel-300 rounded-lg text-steel-700 font-medium hover:bg-steel-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || answers.some((a) => !a.trim())}
                  className="flex-1 py-3 bg-safety text-diesel font-bold rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Set New PIN */}
          {step === 'new-pin' && (
            <form onSubmit={handleNewPin} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-steel-900">
                  {driverName ? `Welcome back, ${driverName}!` : 'Set New PIN'}
                </h2>
                <p className="text-sm text-steel-500 mt-1">Create a new 4-6 digit PIN</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">New PIN (6 digits)</label>
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
                disabled={loading || newPin.length < 6}
                className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset PIN'}
              </button>
            </form>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">✓</div>
              <h2 className="text-lg font-bold text-steel-900">PIN Reset Successfully!</h2>
              <p className="text-sm text-steel-500">You can now sign in with your new PIN.</p>
              <button
                onClick={() => router.push('/d/login')}
                className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {/* Locked out — offer email reset */}
          {step === 'locked' && (
            <div className="space-y-4 py-2">
              {!emailSent ? (
                <>
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-steel-900">Too Many Attempts</h2>
                    <p className="text-sm text-steel-500 mt-1">
                      You&apos;ve used all 3 attempts to answer your security questions.
                    </p>
                  </div>

                  {hasEmail ? (
                    <div className="space-y-3">
                      <p className="text-sm text-steel-600 text-center">
                        We can send a reset link to the email on your account.
                      </p>
                      <button
                        onClick={handleSendResetEmail}
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                              <polyline points="22,6 12,13 2,6"/>
                            </svg>
                            Send Reset Link to My Email
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-steel-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-steel-600">
                        No email address is on file for your account.
                      </p>
                      <p className="text-sm text-steel-500 mt-1">
                        Please contact your dispatcher to reset your PIN.
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
                  )}

                  <div className="text-center pt-1">
                    <a href="/d/login" className="text-sm text-blue-600 hover:text-blue-800">
                      Back to Sign In
                    </a>
                  </div>
                </>
              ) : (
                /* Email sent confirmation */
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-steel-900">Check Your Email</h2>
                  <p className="text-sm text-steel-500">
                    We sent a reset link to <strong className="text-steel-700">{maskedEmail}</strong>
                  </p>
                  <p className="text-xs text-steel-400">
                    The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
                  </p>
                  <button
                    onClick={() => router.push('/d/login')}
                    className="w-full py-3 border border-steel-300 rounded-lg text-steel-700 font-medium hover:bg-steel-50"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
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
