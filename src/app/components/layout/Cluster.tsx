'use client';

import React from 'react';

type SpacingScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

interface ClusterProps {
  children: React.ReactNode;
  gap?: SpacingScale;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
}

/**
 * Cluster - Flex-wrap layout for filters, badges, tags that wrap
 * Uses design tokens for gap spacing
 */
export function Cluster({
  children,
  gap = 2,
  className = '',
  align = 'center',
  justify = 'start',
}: ClusterProps) {
  const gapClass = `gap-[var(--spacing-${gap})]`;
  
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
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
    <div className={`flex flex-wrap ${gapClass} ${alignClasses[align]} ${justifyClasses[justify]} ${className}`}>
      {children}
    </div>
  );
}

