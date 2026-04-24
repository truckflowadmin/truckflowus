'use client';

export default function DriverError({
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

  const isGeneric =
    !error.message ||
    error.message.includes('An error occurred in the Server Components render') ||
    error.message.includes('digest');

  const friendlyMessage = isGeneric
    ? 'Something went wrong while loading your page. This is usually temporary — please try again.'
    : error.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">&#9888;&#65039;</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-4">
          {friendlyMessage}
        </p>

        {error.digest && (
          <p className="text-xs text-gray-400 mb-3 font-mono">
            Ref: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>

        <p className="text-xs text-gray-400 mt-4">
          If this keeps happening, let your dispatcher know
          {error.digest ? ` and mention ref: ${error.digest}` : ''}.
        </p>
      </div>
    </div>
  );
}
