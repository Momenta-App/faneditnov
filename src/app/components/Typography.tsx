'use client';

import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Typography - Theme-aware typography components
 * All components use design tokens for font size, line height, and color
 */

export function H1({ children, className = '' }: TypographyProps) {
  return (
    <h1 className={`text-[var(--font-size-h1)] leading-[var(--line-height-h1)] font-bold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h1>
  );
}

export function H2({ children, className = '' }: TypographyProps) {
  return (
    <h2 className={`text-[var(--font-size-h2)] leading-[var(--line-height-h2)] font-bold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h2>
  );
}

export function H3({ children, className = '' }: TypographyProps) {
  return (
    <h3 className={`text-[var(--font-size-h3)] leading-[var(--line-height-h3)] font-bold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h3>
  );
}

export function H4({ children, className = '' }: TypographyProps) {
  return (
    <h4 className={`text-[var(--font-size-h4)] leading-[var(--line-height-h4)] font-bold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h4>
  );
}

export function H5({ children, className = '' }: TypographyProps) {
  return (
    <h5 className={`text-[var(--font-size-h5)] leading-[var(--line-height-h5)] font-bold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h5>
  );
}

export function H6({ children, className = '' }: TypographyProps) {
  return (
    <h6 className={`text-[var(--font-size-h6)] leading-[var(--line-height-h6)] font-bold text-[var(--color-text-primary)] ${className}`}>
      {children}
    </h6>
  );
}

export function Text({ children, className = '' }: TypographyProps) {
  return (
    <p className={`text-[var(--font-size-body)] leading-[var(--line-height-body)] text-[var(--color-text-primary)] ${className}`}>
      {children}
    </p>
  );
}

export function Muted({ children, className = '' }: TypographyProps) {
  return (
    <p className={`text-[var(--font-size-small)] leading-[var(--line-height-small)] text-[var(--color-text-muted)] ${className}`}>
      {children}
    </p>
  );
}

// Export as namespace for cleaner API: <Typography.H1>, <Typography.Text>
export const Typography = {
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Text,
  Muted,
};

