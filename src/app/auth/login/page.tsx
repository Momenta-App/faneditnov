'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Get values directly from form elements to handle browser autofill
    const formData = new FormData(e.currentTarget);
    const emailValue = (formData.get('email') as string) || email;
    const passwordValue = (formData.get('password') as string) || password;

    try {
      await signIn(emailValue, passwordValue);
      // Wait for session to be fully set and persisted
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Redirect to home or the redirect URL if provided
      const redirect = searchParams.get('redirect') || '/';
      // Use replace instead of push to avoid back button issues
      router.replace(redirect);
    } catch (err) {
      console.error('Login error in page:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--color-text-primary)]">
            Sign in
          </h2>
        </div>

        <div className="bg-[var(--color-surface)] py-8 px-6 shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <form onSubmit={handleSubmit} className="space-y-6">

            <Input
              label="Email address"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
              placeholder="you@example.com"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              placeholder="••••••••"
            />

            {error && (
              <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] px-4 py-3 rounded-[var(--radius-md)] text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              isLoading={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

