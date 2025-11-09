'use client';

import React from 'react';

type SpacingScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

interface StackProps {
  children: React.ReactNode;
  gap?: SpacingScale;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside' | 'main' | 'nav';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * Stack - Vertical layout component with consistent gap spacing
 * Uses design tokens for gap values
 * Mobile: Smaller gaps, Desktop: Standard gaps
 */
export function Stack({
  children,
  gap = 4,
  className = '',
  as: Component = 'div',
  align = 'stretch',
}: StackProps) {
  const gapClass = `gap-[var(--spacing-${gap})]`;
  
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  return (
    <Component className={`flex flex-col ${gapClass} ${alignClasses[align]} ${className}`}>
      {children}
    </Component>
  );
}

