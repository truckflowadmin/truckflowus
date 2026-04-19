'use client';

import Link from 'next/link';

export default function ProtectedError({
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

  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="text-center max-w-md">
        <div className="text-safety text-5xl font-black mb-3">!</div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-steel-500 mb-4">{error.message}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-accent">Try again</button>
          <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
