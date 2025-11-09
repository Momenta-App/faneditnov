'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    // Get values directly from form elements to handle browser autofill
    const formData = new FormData(e.currentTarget);
    const emailValue = (formData.get('email') as string) || email;

    // Update state with the form value in case it was autofilled
    if (emailValue && !email) setEmail(emailValue);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      // Success - show confirmation message
      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--color-text-primary)]">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <div className="bg-[var(--color-surface)] py-8 px-6 shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          {success ? (
            <div className="space-y-6">
              <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)] px-4 py-3 rounded-[var(--radius-md)] text-sm">
                If an account exists with that email, a password reset link has been sent.
                Please check your email and follow the instructions.
              </div>
              <div className="text-center space-y-4">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Didn't receive an email? Check your spam folder or try again.
                </p>
                <div className="flex gap-4 justify-center">
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                  >
                    Back to login
                  </Link>
                  <button
                    onClick={() => {
                      setSuccess(false);
                      setEmail('');
                    }}
                    className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                  >
                    Send another email
                  </button>
                </div>
              </div>
            </div>
          ) : (
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
                {isLoading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

