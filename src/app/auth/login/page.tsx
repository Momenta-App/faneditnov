'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import Link from 'next/link';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    // Check if redirected from successful password reset
    if (searchParams.get('reset') === 'success') {
      setResetSuccess(true);
      // Clear the query param from URL
      router.replace('/auth/login', { scroll: false });
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Get values directly from form elements to handle browser autofill
    const formData = new FormData(e.currentTarget);
    const emailValue = (formData.get('email') as string) || email;
    const passwordValue = (formData.get('password') as string) || password;

    // Debug logging
    console.log('📝 Form submitted with:', { 
      stateEmail: email || '(empty)',
      formEmail: emailValue || '(empty)', 
      emailLength: emailValue?.length || 0,
      statePassword: password ? '(provided)' : '(empty)',
      formPassword: passwordValue ? '(provided)' : '(empty)',
      passwordLength: passwordValue?.length || 0,
    });

    // Update state with the form values in case they were autofilled
    if (emailValue && !email) setEmail(emailValue);
    if (passwordValue && !password) setPassword(passwordValue);

    try {
      await signIn(emailValue, passwordValue);
      // Small delay to ensure session is persisted before redirect
      await new Promise(resolve => setTimeout(resolve, 200));
      // Redirect to home after successful login
      router.push('/');
    } catch (err) {
      console.error('Login error in page:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setIsLoading(false); // Ensure loading stops on error
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--color-text-primary)]">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
            Or{' '}
            <Link
              href="/auth/signup"
              className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
            >
              create a new account
            </Link>
          </p>
        </div>

        <div className="bg-[var(--color-surface)] py-8 px-6 shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {resetSuccess && (
              <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)] px-4 py-3 rounded-[var(--radius-md)] text-sm">
                Password reset successfully! You can now sign in with your new password.
              </div>
            )}

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

            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

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

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              ← Back to home
            </Link>
          </div>
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

