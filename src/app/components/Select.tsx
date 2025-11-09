'use client';

import React from 'react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  options: { value: string; label: string }[];
}

/**
 * Select - Theme-aware select component matching Input styling
 * 
 * @example
 * <Select 
 *   label="Choose option" 
 *   options={[
 *     { value: '1', label: 'Option 1' },
 *     { value: '2', label: 'Option 2' }
 *   ]}
 * />
 */
export function Select({ 
  label, 
  error, 
  size = 'md',
  options,
  className = '', 
  ...props 
}: SelectProps) {
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
      <select
        className={`
          w-full 
          ${sizeClasses[size]}
          border-[var(--border-width)]
          rounded-[var(--radius-md)]
          bg-[var(--color-surface)]
          text-[var(--color-text-primary)]
          transition-colors
          focus-ring
          ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
          ${!error ? 'focus:border-[var(--color-primary)]' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-[var(--spacing-1)] text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

