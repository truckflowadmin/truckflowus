'use client';

import { useState } from 'react';
import { markTicketReviewedAction, unmarkTicketReviewedAction } from './actions';

interface Props {
  ticketId: string;
  reviewed: boolean;
  hasPhoto: boolean;
}

export default function QuickReviewButton({ ticketId, reviewed, hasPhoto }: Props) {
  const [isReviewed, setIsReviewed] = useState(reviewed);
  const [loading, setLoading] = useState(false);

  // No photo = no driver submission to review
  if (!hasPhoto) {
    return <span className="text-steel-300">—</span>;
  }

  async function handleToggle() {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('ticketId', ticketId);
      if (isReviewed) {
        await unmarkTicketReviewedAction(fd);
        setIsReviewed(false);
      } else {
        await markTicketReviewedAction(fd);
        setIsReviewed(true);
      }
    } catch {
      // revert on error
    } finally {
      setLoading(false);
    }
  }

  if (isReviewed) {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        title="Reviewed — click to undo"
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : '✓ Reviewed'}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title="Click to mark as reviewed"
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
    >
      {loading ? '...' : 'Review ✓'}
    </button>
  );
}
