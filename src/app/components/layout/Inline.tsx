'use client';

import React from 'react';

type SpacingScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

interface InlineProps {
  children: React.ReactNode;
  gap?: SpacingScale;
  className?: string;
  align?: 'start' | 'center' | 'end' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
}

/**
 * Inline - Horizontal layout component for pills, chips, tags, inline elements
 * Uses design tokens for gap spacing
 */
export function Inline({
  children,
  gap = 2,
  className = '',
  align = 'center',
  justify = 'start',
  wrap = false,
}: InlineProps) {
  const gapClass = `gap-[var(--spacing-${gap})]`;
  
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    baseline: 'items-baseline',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  return (
    <div className={`flex flex-row ${gapClass} ${alignClasses[align]} ${justifyClasses[justify]} ${wrap ? 'flex-wrap' : 'flex-nowrap'} ${className}`}>
      {children}
    </div>
  );
}

