'use client';

import React from 'react';
import { FilterBar } from './filters';

interface PageFiltersProps {
  searchPlaceholder?: string;
  timeRangeValue?: string;
  onTimeRangeChange?: (value: string) => void;
  showTimeRange?: boolean;
  onSearch?: (query: string) => void;
  sticky?: boolean;
  className?: string;
  noPaddingTop?: boolean;
}

/**
 * PageFilters - Reusable filter bar wrapper with improved Apple-inspired design
 * Can be sticky for better UX when scrolling
 * Always sorts by views (highest first)
 */
export function PageFilters({
  searchPlaceholder = 'Search...',
  timeRangeValue = 'all',
  onTimeRangeChange,
  showTimeRange = false,
  onSearch,
  sticky = false,
  className = '',
  noPaddingTop = false,
}: PageFiltersProps) {
  const paddingClass = noPaddingTop ? 'pb-3' : 'py-3';
  
  return (
    <div 
      className={`bar border-y border-[var(--color-border)] ${sticky ? 'sticky top-16 z-[var(--z-sticky)]' : ''} ${className}`}
      style={{ '--bar-bg': 'var(--color-surface)' } as React.CSSProperties}
    >
      <div className={`container-base max-w-[1440px] mx-auto ${paddingClass}`}>
        <FilterBar
          searchPlaceholder={searchPlaceholder}
          timeRangeValue={timeRangeValue}
          onTimeRangeChange={onTimeRangeChange}
          showTimeRange={showTimeRange}
          onSearch={onSearch}
          className="w-full"
        />
      </div>
    </div>
  );
}
