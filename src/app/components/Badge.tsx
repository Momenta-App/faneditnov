'use client';

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Badge - Theme-aware badge component with token-based styling
 * 
 * @example
 * <Badge variant="primary">New</Badge>
 * <Badge variant="success" size="sm">Active</Badge>
 */
export function Badge({ 
  children, 
  variant = 'default',
  size = 'md',
  className = '' 
}: BadgeProps) {
  // Variants using theme tokens (no purple)
  const variantClasses = {
    default: 'bg-[var(--color-border)] text-[var(--color-text-primary)]',
    primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20',
    success: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20',
    warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/20',
    danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20',
    info: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border border-[var(--color-info)]/20',
  };

  const sizeClasses = {
    sm: 'px-[var(--spacing-2)] py-[var(--spacing-1)] text-xs',
    md: 'px-[var(--spacing-3)] py-[var(--spacing-1)] text-sm',
    lg: 'px-[var(--spacing-4)] py-[var(--spacing-2)] text-base',
  };

  return (
    <span className={`inline-flex items-center rounded-[var(--radius-full)] font-medium border ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  );
}

