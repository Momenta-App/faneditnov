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
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#ffffff',
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#000000',
            }}>
              Something went wrong!
            </h2>
            <p style={{
              marginBottom: '2rem',
              color: '#666666',
            }}>
              {error.message || 'A critical error occurred'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 2rem',
                background: '#1E90FF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

