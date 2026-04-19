'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SECURITY_QUESTIONS = [
  'What is the name of your first pet?',
  "What city were you born in?",
  "What is your mother's maiden name?",
  'What was the name of your first school?',
  'What is your favorite sports team?',
  'What was the make of your first car?',
  'What street did you grow up on?',
  'What is your favorite food?',
  'What is your childhood nickname?',
  'What was your first job?',
];

export default function DriverSetup({
  token,
  driverName,
}: {
  token: string;
  driverName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: PIN, 2: Security Questions
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [email, setEmail] = useState('');
  const [q1, setQ1] = useState('');
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState('');
  const [a2, setA2] = useState('');
  const [q3, setQ3] = useState('');
  const [a3, setA3] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get available questions (exclude already selected)
  function availableQuestions(exclude: string[]) {
    return SECURITY_QUESTIONS.filter((q) => !exclude.includes(q));
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4-6 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!q1 || !a1 || !q2 || !a2 || !q3 || !a3) {
      setError('Please select and answer all 3 security questions');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup',
          token,
          pin,
          email: email || null,
          securityQ1: q1,
          securityA1: a1,
          securityQ2: q2,
          securityA2: a2,
          securityQ3: q3,
          securityA3: a3,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Setup failed');
        setLoading(false);
        return;
      }
      // Auto-logged in, go to portal
      router.push('/d/portal');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-diesel flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="text-4xl font-black text-white tracking-tight">TruckFlowUS</div>
          <p className="text-steel-400 text-sm mt-1">Driver Portal Setup</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-steel-900">Welcome, {driverName}!</h2>
            <p className="text-sm text-steel-500 mt-1">
              {step === 1
                ? 'Create a PIN to secure your account.'
                : 'Set up security questions for PIN recovery.'}
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-5">
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-safety' : 'bg-steel-200'}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-safety' : 'bg-steel-200'}`} />
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  Create a PIN (4-6 digits)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-lg border border-steel-300 text-lg text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  Confirm PIN
                </label>
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

              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  Email <span className="text-steel-400">(optional, for PIN reset)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-lg border border-steel-300 focus:outline-none focus:ring-2 focus:ring-safety"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
              )}

              <button
                type="submit"
                disabled={pin.length < 4}
                className="w-full py-3 bg-safety text-diesel font-bold text-lg rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
              >
                Next →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Question 1 */}
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  Security Question 1
                </label>
                <select
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                >
                  <option value="">Select a question...</option>
                  {availableQuestions([q2, q3]).map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  placeholder="Your answer"
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                />
              </div>

              {/* Question 2 */}
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  Security Question 2
                </label>
                <select
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                >
                  <option value="">Select a question...</option>
                  {availableQuestions([q1, q3]).map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={a2}
                  onChange={(e) => setA2(e.target.value)}
                  placeholder="Your answer"
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                />
              </div>

              {/* Question 3 */}
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">
                  Security Question 3
                </label>
                <select
                  value={q3}
                  onChange={(e) => setQ3(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                >
                  <option value="">Select a question...</option>
                  {availableQuestions([q1, q2]).map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={a3}
                  onChange={(e) => setA3(e.target.value)}
                  placeholder="Your answer"
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm mt-1.5 focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="flex-1 py-3 border border-steel-300 rounded-lg text-steel-700 font-medium hover:bg-steel-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !q1 || !a1 || !q2 || !a2 || !q3 || !a3}
                  className="flex-1 py-3 bg-safety text-diesel font-bold rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
