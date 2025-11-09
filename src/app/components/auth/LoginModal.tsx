'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Alert } from '../Alert';
import { Stack } from '../layout';
import { Typography } from '../Typography';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export function LoginModal({ isOpen, onClose, onSwitchToSignup }: LoginModalProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      onClose();
      // Reset form
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Login"
      className="max-w-md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap={4}>
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
            autoComplete="current-password"
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
            Login
          </Button>
        </Stack>
      </form>

      {/* Footer */}
      <div className="mt-[var(--spacing-6)] pt-[var(--spacing-6)] border-t border-[var(--color-border)] text-center">
        <Typography.Muted className="text-sm">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToSignup}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors focus-ring rounded-[var(--radius-sm)] px-[var(--spacing-1)]"
          >
            Sign up
          </button>
        </Typography.Muted>
      </div>
    </Modal>
  );
}

