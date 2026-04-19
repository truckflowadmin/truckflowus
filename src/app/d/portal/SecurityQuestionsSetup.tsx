'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SECURITY_QUESTIONS } from '@/lib/security-questions';

export default function DriverSecurityQuestionsSetup({ driverName }: { driverName: string }) {
  const router = useRouter();
  const [q1, setQ1] = useState('');
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState('');
  const [a2, setA2] = useState('');
  const [q3, setQ3] = useState('');
  const [a3, setA3] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const usedQuestions = new Set([q1, q2, q3].filter(Boolean));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!q1 || !a1 || !q2 || !a2 || !q3 || !a3) {
      setError('Please select all 3 questions and provide answers.');
      return;
    }
    if (usedQuestions.size < 3) {
      setError('Please pick 3 different questions.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/driver/security-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          securityQ1: q1, securityA1: a1,
          securityQ2: q2, securityA2: a2,
          securityQ3: q3, securityA3: a3,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-diesel flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-white tracking-tight">TruckFlowUS</div>
          <p className="text-steel-400 text-sm mt-1">Security Questions Required</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-center text-steel-900 mb-2">
            Welcome back, {driverName}
          </h2>
          <p className="text-sm text-steel-500 text-center mb-6">
            Your security questions were cleared by an administrator. Please set up new ones to protect your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Question 1', q: q1, setQ: setQ1, a: a1, setA: setA1 },
              { label: 'Question 2', q: q2, setQ: setQ2, a: a2, setA: setA2 },
              { label: 'Question 3', q: q3, setQ: setQ3, a: a3, setA: setA3 },
            ].map(({ label, q, setQ, a, setA }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-steel-600 mb-1">{label}</label>
                <select
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                >
                  <option value="">Select a question...</option>
                  {SECURITY_QUESTIONS.map((sq) => (
                    <option key={sq} value={sq} disabled={usedQuestions.has(sq) && sq !== q}>
                      {sq}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  placeholder="Your answer"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                  required
                />
              </div>
            ))}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-safety text-diesel font-bold rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Security Questions'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
