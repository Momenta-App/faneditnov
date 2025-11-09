'use client';

import React from 'react';
import { Container } from './Container';

export { Container } from './Container';

interface PageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page - Main page wrapper that provides standardized container
 * Uses Container component for consistent spacing and max-width
 */
export function Page({ children, className = '' }: PageProps) {
  return (
    <Container className={className}>
      {children}
    </Container>
  );
}

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'header' | 'filter' | 'content';
}

/**
 * PageSection - Sections within a page (header, filter bar, main content)
 * Header and filter variants use the full-bleed bar pattern with Container inside
 * Content variant does not use bar pattern, relies on Page component for container
 */
export function PageSection({ children, className = '', variant = 'content' }: PageSectionProps) {
  const variantClasses = {
    header: 'bar py-[var(--spacing-12)] md:py-[var(--spacing-16)]',
    filter: 'bar py-[var(--spacing-4)] border-b border-[var(--color-border)]',
    content: 'py-[var(--spacing-8)] sm:py-[var(--spacing-12)]',
  };

  // Set background color via CSS variable for header and filter variants
  const barStyle = variant === 'header' || variant === 'filter' 
    ? { '--bar-bg': 'var(--color-surface)' } as React.CSSProperties
    : undefined;

  // Only header and filter variants need Container wrapper (they are full-bleed bars)
  if (variant === 'header' || variant === 'filter') {
    return (
      <section 
        className={`${variantClasses[variant]} ${className}`}
        style={barStyle}
      >
        <Container>
          {children}
        </Container>
      </section>
    );
  }

  // Content variant - no container wrapper, Page handles that
  return (
    <section className={`${variantClasses[variant]} ${className}`}>
      {children}
    </section>
  );
}

