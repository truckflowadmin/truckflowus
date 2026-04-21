'use client';

export default function DriverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-4">
          An error occurred while loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
