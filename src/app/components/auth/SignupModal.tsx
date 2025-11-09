'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Alert } from '../Alert';
import { Stack } from '../layout';
import { Typography } from '../Typography';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export function SignupModal({ isOpen, onClose, onSwitchToLogin }: SignupModalProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, displayName);
      onClose();
      // Reset form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sign Up"
      className="max-w-md max-h-[95vh]"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap={4}>
          <Input
            label="Display Name (Optional)"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoading}
            autoComplete="name"
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
            minLength={6}
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />

          {error && (
            <Alert variant="danger" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
            isLoading={isLoading}
          >
            Sign Up
          </Button>
        </Stack>
      </form>

      {/* Footer */}
      <div className="mt-[var(--spacing-6)] pt-[var(--spacing-6)] border-t border-[var(--color-border)] text-center">
        <Typography.Muted className="text-sm">
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors focus-ring rounded-[var(--radius-sm)] px-[var(--spacing-1)]"
          >
            Login
          </button>
        </Typography.Muted>
      </div>
    </Modal>
  );
}

