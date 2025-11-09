'use client';

import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Input - Theme-aware input component with token-based styling
 * 
 * @example
 * <Input label="Email" type="email" placeholder="user@example.com" />
 * <Input label="Password" type="password" error="Required field" />
 */
export function Input({ 
  label, 
  error, 
  size = 'md',
  className = '', 
  ...props 
}: InputProps) {
  const sizeClasses = {
    sm: 'px-[var(--spacing-3)] py-[var(--spacing-2)] text-sm h-8',
    md: 'px-[var(--spacing-4)] py-[var(--spacing-2)] text-base h-10',
    lg: 'px-[var(--spacing-4)] py-[var(--spacing-3)] text-base h-12',
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--spacing-2)]">
          {label}
        </label>
      )}
      <input
        className={`
          w-full 
          ${sizeClasses[size]}
          border-[var(--border-width)]
          rounded-[var(--radius-md)]
          bg-[var(--color-surface)]
          text-[var(--color-text-primary)]
          transition-colors
          focus-ring
          placeholder:text-[var(--color-text-muted)]
          ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
          ${!error ? 'focus:border-[var(--color-primary)]' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-[var(--spacing-1)] text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

