'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { validatePassword, getPasswordRequirements } from '@/lib/password-utils';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);
  const [signupEmail, setSignupEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Get values directly from form elements to handle browser autofill
    const formData = new FormData(e.currentTarget);
    const emailValue = (formData.get('email') as string) || email;
    const passwordValue = (formData.get('password') as string) || password;
    const confirmPasswordValue = (formData.get('confirmPassword') as string) || confirmPassword;
    const displayNameValue = (formData.get('displayName') as string) || displayName;
    const inviteCodeValue = (formData.get('inviteCode') as string) || inviteCode;

    // Update state with the form values in case they were autofilled
    if (emailValue && !email) setEmail(emailValue);
    if (passwordValue && !password) setPassword(passwordValue);
    if (confirmPasswordValue && !confirmPassword) setConfirmPassword(confirmPasswordValue);
    if (displayNameValue && !displayName) setDisplayName(displayNameValue);

    // Validate passwords match
    if (passwordValue !== confirmPasswordValue) {
      setError('Passwords do not match');
      return;
    }

    // Validate password requirements
    const passwordValidation = validatePassword(passwordValue);
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    setIsLoading(true);

    try {
      // Call the API directly to check if session is returned
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: emailValue, 
          password: passwordValue, 
          display_name: displayNameValue,
          invite_code: inviteCodeValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed. Please try again.');
      }

      // Check if email confirmation is required (no session returned)
      if (!data.session) {
        // Email confirmation required - show confirmation message
        setEmailConfirmationRequired(true);
        setSignupEmail(emailValue);
      } else {
        // User is auto-logged in (email confirmation disabled)
        // Use AuthContext to update session state, then redirect
        await signUp(emailValue, passwordValue, displayNameValue);
        router.push('/');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      console.error('Signup error:', err);
      setError(errorMessage);
      
      // If it's a database error, show more details
      if (errorMessage.includes('Database error')) {
        setError(errorMessage + ' (Check server logs for details)');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show email confirmation message if required
  if (emailConfirmationRequired && signupEmail) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-[var(--color-surface)] py-8 px-6 shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] border border-[var(--color-border)] text-center">
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[var(--color-primary)]/10 mb-4">
                <svg className="h-8 w-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                Check your email
              </h2>
              <p className="text-[var(--color-text-muted)]">
                We've sent a verification link to
              </p>
              <p className="font-medium text-[var(--color-text-primary)] mt-1">
                {signupEmail}
              </p>
            </div>

            <div className="space-y-4 text-sm text-[var(--color-text-muted)] mb-6">
              <p>
                Click the link in the email to verify your account and complete signup.
              </p>
              <p>
                Didn't receive the email? Check your spam folder or try signing up again.
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/auth/login">
                <Button className="w-full">
                  Back to login
                </Button>
              </Link>
              <button
                onClick={() => {
                  setEmailConfirmationRequired(false);
                  setSignupEmail(null);
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setDisplayName('');
                  setInviteCode('');
                }}
                className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Sign up with a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--color-text-primary)]">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <div className="bg-[var(--color-surface)] py-8 px-6 shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Display Name (Optional)"
              type="text"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              autoComplete="name"
              placeholder="Your name"
            />

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
              label="Invite Code"
              type="text"
              name="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="off"
              placeholder="Enter your invite code"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters with uppercase, lowercase, and number"
            />

            {/* Password Requirements */}
            <div className="space-y-1.5 text-sm">
              <p className="text-[var(--color-text-muted)] font-medium mb-2">Password must contain:</p>
              <div className="space-y-1.5">
                {getPasswordRequirements().map((requirement) => {
                  let isValid = false;
                  
                  if (requirement === 'At least 8 characters') {
                    isValid = password.length >= 8;
                  } else if (requirement === 'At least one uppercase letter') {
                    isValid = /[A-Z]/.test(password);
                  } else if (requirement === 'At least one lowercase letter') {
                    isValid = /[a-z]/.test(password);
                  } else if (requirement === 'At least one number') {
                    isValid = /[0-9]/.test(password);
                  }
                  
                  return (
                    <div key={requirement} className="flex items-center gap-2">
                      <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full ${
                        isValid 
                          ? 'bg-green-500 text-white' 
                          : 'border-2 border-[var(--color-border)]'
                      }`}>
                        {isValid && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`${isValid ? 'text-green-600' : 'text-[var(--color-text-muted)]'}`}>
                        {requirement}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {password && (
              <PasswordStrengthMeter password={password} />
            )}

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
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
              {isLoading ? 'Creating account...' : 'Create account'}
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

