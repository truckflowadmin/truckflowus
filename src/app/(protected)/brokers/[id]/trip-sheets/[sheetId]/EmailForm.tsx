'use client';

import { useState } from 'react';

interface Props {
  sheetId: string;
  brokerId: string;
  brokerEmail: string | null;
  disabled: boolean;
}

export function EmailForm({ sheetId, brokerId, brokerEmail, disabled }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [emailTo, setEmailTo] = useState(brokerEmail ?? '');

  async function handleSend() {
    if (!emailTo.trim()) return;
    setSending(true);
    setError('');
    setSent(false);
    try {
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheets/${sheetId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to send' }));
        throw new Error(data.error || 'Failed to send');
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label text-xs" htmlFor="emailTo">Email to</label>
          <input
            id="emailTo"
            type="email"
            className="input"
            value={emailTo}
            onChange={(e) => { setEmailTo(e.target.value); setSent(false); }}
            placeholder="broker@example.com"
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !emailTo.trim() || disabled}
          className="btn-accent"
        >
          {sending ? 'Sending…' : 'Email Trip Sheet'}
        </button>
      </div>
      {sent && <p className="text-sm text-green-700 mt-2">Sent to {emailTo}!</p>}
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
