import Link from 'next/link';

export default function NotFound() {
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
        <h1 style={{
          fontSize: '6rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'var(--color-primary)',
        }}>
          404
        </h1>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: 'var(--color-text-primary)',
        }}>
          Page Not Found
        </h2>
        <p style={{
          marginBottom: '2rem',
          color: 'var(--color-text-muted)',
        }}>
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: '600',
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

