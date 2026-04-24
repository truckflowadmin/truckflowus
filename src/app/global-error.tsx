'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isGeneric =
    !error.message ||
    error.message.includes('An error occurred in the Server Components render') ||
    error.message.includes('digest');

  const friendlyMessage = isGeneric
    ? 'Something went wrong while loading TruckFlowUS. This is usually temporary — please try again.'
    : error.message;

  return (
    <html>
      <body style={{ margin: 0, padding: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#14171a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '24px', maxWidth: '500px' }}>
          <div style={{ color: '#FFB500', fontSize: '64px', fontWeight: 900, marginBottom: '16px' }}>!</div>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ color: '#7c8691', marginBottom: '24px', lineHeight: 1.5 }}>
            {friendlyMessage}
          </p>

          {error.digest && (
            <p style={{ color: '#4a5568', fontSize: '12px', fontFamily: 'monospace', marginBottom: '16px' }}>
              Error reference: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{ padding: '10px 20px', background: '#FFB500', color: '#1b1e22', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ padding: '10px 20px', background: 'transparent', color: '#7c8691', fontWeight: 600, borderRadius: '6px', border: '1px solid #333', textDecoration: 'none', fontSize: '14px' }}
            >
              Go to homepage
            </a>
          </div>

          <p style={{ color: '#4a5568', fontSize: '11px', marginTop: '32px' }}>
            If this keeps happening, contact{' '}
            <a href="mailto:support@truckflowus.com" style={{ color: '#7c8691', textDecoration: 'underline' }}>support@truckflowus.com</a>
            {error.digest ? ` with reference: ${error.digest}` : ''}.
          </p>
        </div>
      </body>
    </html>
  );
}
