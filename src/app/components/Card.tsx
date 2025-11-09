'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

/**
 * Card - Theme-aware card component with token-based styling
 * 
 * @example
 * <Card padding="md">
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 */
export function Card({ 
  children, 
  className = '', 
  padding = 'md',
  interactive = false 
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-[var(--spacing-4)]',
    md: 'p-[var(--spacing-6)]',
    lg: 'p-[var(--spacing-8)]',
  };

  return (
    <div
      className={`
        card-base
        ${paddingClasses[padding]}
        ${interactive ? 'card-interactive' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

