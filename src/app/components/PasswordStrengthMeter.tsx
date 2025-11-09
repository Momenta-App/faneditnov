'use client';

import { calculatePasswordStrength } from '@/lib/password-utils';

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

export function PasswordStrengthMeter({ password, className = '' }: PasswordStrengthMeterProps) {
  if (!password) {
    return null;
  }

  const { strength, score } = calculatePasswordStrength(password);

  const strengthColors = {
    weak: 'bg-[var(--color-danger)]',
    medium: 'bg-yellow-500',
    strong: 'bg-blue-500',
    'very-strong': 'bg-green-500',
  };

  const strengthLabels = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    'very-strong': 'Very Strong',
  };

  const strengthTextColors = {
    weak: 'text-[var(--color-danger)]',
    medium: 'text-yellow-600',
    strong: 'text-blue-600',
    'very-strong': 'text-green-600',
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Progress bar */}
      <div className="w-full bg-[var(--color-border)] rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${strengthColors[strength]}`}
          style={{ width: `${score}%` }}
        />
      </div>
      
      {/* Strength label */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">Password strength:</span>
        <span className={`font-medium ${strengthTextColors[strength]}`}>
          {strengthLabels[strength]}
        </span>
      </div>
    </div>
  );
}

