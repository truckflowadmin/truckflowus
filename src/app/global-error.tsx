'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen grid place-items-center p-6 bg-[#14171a]">
        <div className="text-center">
          <div className="text-[#FFB500] text-6xl font-black mb-4">!</div>
          <h1 className="text-white text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-[#7c8691] mb-6 max-w-md">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-[#FFB500] text-[#1b1e22] font-bold rounded-md hover:bg-[#CC8F00] transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
