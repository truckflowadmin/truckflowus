'use client';

import Link from 'next/link';

export default function SuperadminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Next.js redirect() throws a special error — don't catch it
  if (error.digest?.includes('NEXT_REDIRECT')) {
    throw error;
  }

  const isAuth = error.message === 'UNAUTHENTICATED';

  if (isAuth) {
    return (
      <div className="flex-1 grid place-items-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Session expired</h2>
          <p className="text-steel-500 mb-4">Please log in again.</p>
          <Link href="/login" className="btn-accent">Sign In</Link>
        </div>
      </div>
    );
  }

  // In production, error.message is stripped — provide helpful context
  const hasMessage = error.message && !error.message.includes('An error occurred in the Server Components render');
  const friendlyMessage = hasMessage
    ? error.message
    : 'A server error occurred while loading this page. This is usually temporary — try refreshing.';

  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="text-center max-w-lg">
        <div className="text-red-500 text-5xl font-black mb-3">!</div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-steel-500 mb-4">{friendlyMessage}</p>

        {error.digest && (
          <p className="text-xs text-steel-400 mb-4 font-mono">
            Error reference: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-accent">Try again</button>
          <Link href="/sa/overview" className="btn-ghost">Back to Overview</Link>
        </div>

        <p className="text-xs text-steel-400 mt-6">
          If this keeps happening, contact support at{' '}
          <a href="mailto:support@truckflowus.com" className="underline">support@truckflowus.com</a>
          {error.digest ? ` and include reference: ${error.digest}` : ''}.
        </p>
      </div>
    </div>
  );
}
