'use client';

import React from 'react';
import { Stack, Inline } from '../layout';
import { SearchInput } from './SearchInput';
import { TimeRangeFilter } from './TimeRangeFilter';
import { SortDropdown, SortOption } from './SortDropdown';

interface FilterBarProps {
  searchPlaceholder?: string;
  timeRangeValue?: string;
  onTimeRangeChange?: (value: string) => void;
  showTimeRange?: boolean;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: SortOption[];
  onSearch?: (query: string) => void;
  className?: string;
}

/**
 * FilterBar - Premium filter bar with pill-style controls
 * Features elegant spacing, refined interactions, and responsive layout
 */
export function FilterBar({
  searchPlaceholder = 'Search...',
  timeRangeValue = 'all',
  onTimeRangeChange,
  showTimeRange = false,
  sortValue,
  onSortChange,
  sortOptions,
  onSearch,
  className = '',
}: FilterBarProps) {
  return (
    <div className={`premium-filter-bar ${className}`}>
      <div className="flex flex-col gap-5 items-stretch">
        {/* Search Input - Full width on mobile, prominent on desktop */}
        <div className="w-full">
          {onSearch ? (
            <SearchInput placeholder={searchPlaceholder} onSearch={onSearch} />
          ) : (
            <SearchInput placeholder={searchPlaceholder} />
          )}
        </div>

        {/* Sort & Time Range Controls - Premium pill style */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          {/* Sort Options - Pill buttons */}
          {sortOptions && sortValue && onSortChange && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Sort by
                </span>
              </div>
              <SortDropdown
                value={sortValue}
                onChange={onSortChange}
                options={sortOptions}
              />
            </div>
          )}
          
          {/* Time Range Filter - Pill buttons */}
          {showTimeRange && onTimeRangeChange && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Time period
                </span>
              </div>
              <TimeRangeFilter
                value={timeRangeValue}
                onChange={onTimeRangeChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

