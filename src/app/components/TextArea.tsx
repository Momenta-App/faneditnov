'use client';

import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * TextArea - Theme-aware textarea component matching Input styling
 * 
 * @example
 * <TextArea label="Message" placeholder="Enter your message" rows={4} />
 */
export function TextArea({ 
  label, 
  error, 
  size = 'md',
  className = '', 
  ...props 
}: TextAreaProps) {
  const sizeClasses = {
    sm: 'px-[var(--spacing-3)] py-[var(--spacing-2)] text-sm min-h-[80px]',
    md: 'px-[var(--spacing-4)] py-[var(--spacing-2)] text-base min-h-[100px]',
    lg: 'px-[var(--spacing-4)] py-[var(--spacing-3)] text-base min-h-[120px]',
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--spacing-2)]">
          {label}
        </label>
      )}
      <textarea
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
          resize-y
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

