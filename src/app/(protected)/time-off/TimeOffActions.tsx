'use client';

import { useState } from 'react';

interface Props {
  requestId: string;
  reviewAction: (formData: FormData) => Promise<void>;
}

export default function TimeOffActions({ requestId, reviewAction }: Props) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAction(action: 'approve' | 'deny') {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('requestId', requestId);
      fd.set('action', action);
      fd.set('reviewNote', note);
      await reviewAction(fd);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-steel-200">
      {showNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)..."
          rows={2}
          className="input mb-2 text-sm"
        />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="btn bg-green-600 text-white hover:bg-green-700 px-4 py-1.5 text-sm"
        >
          {loading ? '...' : '✓ Approve'}
        </button>
        <button
          onClick={() => handleAction('deny')}
          disabled={loading}
          className="btn bg-red-600 text-white hover:bg-red-700 px-4 py-1.5 text-sm"
        >
          {loading ? '...' : '✕ Deny'}
        </button>
        {!showNote && (
          <button
            onClick={() => setShowNote(true)}
            className="text-xs text-steel-500 hover:text-steel-700 ml-2"
          >
            + Add note
          </button>
        )}
      </div>
    </div>
  );
}
