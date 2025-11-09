'use client';

import React from 'react';

type SpacingScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

interface GridProps {
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
    wide?: number;
  };
  gap?: {
    mobile?: SpacingScale;
    desktop?: SpacingScale;
  };
  className?: string;
}

/**
 * Grid - Responsive grid layout component
 * Mobile: 1 column, gap from tokens (default --spacing-4)
 * Tablet (sm: 640px): 2 columns
 * Desktop (md: 768px): 3 columns, (lg: 1024px): 4 columns, (xl: 1280px): 5 columns
 * Gap: Mobile --spacing-4, Desktop --spacing-6
 */
export function Grid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
  gap = { mobile: 4, desktop: 6 },
  className = '',
}: GridProps) {
  // Map column counts to Tailwind classes
  const getGridColsClass = (count?: number) => {
    if (!count) return '';
    const map: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
    };
    return map[count] || `grid-cols-${count}`;
  };

  const gridCols = `
    ${getGridColsClass(cols.mobile || 1)}
    ${cols.tablet ? `sm:${getGridColsClass(cols.tablet)}` : ''}
    ${cols.desktop ? `md:${getGridColsClass(cols.desktop)}` : ''}
    ${cols.wide ? `xl:${getGridColsClass(cols.wide)}` : ''}
  `;

  const gapClasses = `
    gap-[var(--spacing-${gap.mobile || 4})]
    ${gap.desktop ? `md:gap-[var(--spacing-${gap.desktop})]` : ''}
  `;

  return (
    <div className={`grid ${gridCols} ${gapClasses} ${className}`}>
      {children}
    </div>
  );
}

