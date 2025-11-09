'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--color-background)',
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'var(--color-text-primary)',
        }}>
          Something went wrong!
        </h2>
        <p style={{
          marginBottom: '2rem',
          color: 'var(--color-text-muted)',
        }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 2rem',
            background: 'var(--color-primary)',
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
  );
}

