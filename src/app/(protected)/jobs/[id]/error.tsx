'use client';

export default function JobDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 max-w-xl mx-auto text-center">
      <div className="panel p-8">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-steel-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-steel-600 mb-6">
          {error.message || 'An unexpected error occurred while loading this job.'}
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={reset} className="btn-accent">
            Try Again
          </button>
          <a href="/jobs" className="btn-ghost">
            Back to Jobs
          </a>
        </div>
      </div>
    </div>
  );
}
