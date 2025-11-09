'use client';

import React from 'react';
import { Button } from './Button';
import { FilterBar, type SortOption } from './filters';

interface PageHeaderWithFiltersProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  };
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
 * PageHeaderWithFilters - Premium header with integrated filters
 * Features gradient backgrounds, glassmorphism, and refined typography
 */
export function PageHeaderWithFilters({
  title,
  description,
  action,
  searchPlaceholder = 'Search...',
  timeRangeValue = 'all',
  onTimeRangeChange,
  showTimeRange = false,
  sortValue,
  onSortChange,
  sortOptions,
  onSearch,
  className = '',
}: PageHeaderWithFiltersProps) {
  return (
    <div 
      className={`premium-header-container ${className}`}
      style={{ 
        '--bar-bg': 'var(--color-surface)',
        position: 'relative',
        overflow: 'hidden'
      } as React.CSSProperties}
    >
      {/* Premium gradient background */}
      <div 
        className="premium-gradient-bg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
          opacity: 0.7,
          zIndex: 0
        }}
      />
      
      {/* Subtle accent gradient overlay */}
      <div 
        className="premium-accent-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, var(--color-primary) 50%, transparent 100%)',
          opacity: 0.3
        }}
      />

      <div className="container-base max-w-[1440px] mx-auto" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <div className="pt-16 md:pt-20 pb-8 md:pb-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            {/* Title and Description */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="inline-flex items-center gap-3 mb-2">
                {/* Decorative accent line */}
                <div 
                  style={{
                    width: '4px',
                    height: '40px',
                    background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-light))',
                    borderRadius: '2px',
                    boxShadow: '0 0 20px var(--color-primary)'
                  }}
                />
                <h1 
                  className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight premium-title"
                  style={{ 
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.1'
                  }}
                >
                  {title}
                </h1>
              </div>
              {description && (
                <p 
                  className="text-xl md:text-2xl max-w-3xl leading-relaxed premium-description"
                  style={{ 
                    color: 'var(--color-text-muted)',
                    fontWeight: 400,
                    letterSpacing: '-0.01em'
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            {/* Action Button */}
            {action && (
              <div className="shrink-0 lg:pt-2">
                <Button 
                  variant={action.variant || 'primary'}
                  onClick={action.onClick}
                  className="w-full lg:w-auto premium-cta-button shadow-lg hover:shadow-xl transition-all duration-300"
                  style={{
                    padding: '14px 32px',
                    fontSize: '16px',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    backgroundColor: '#1E90FF',
                    color: 'white'
                  }}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Premium Filters Section - glassmorphism card */}
        <div 
          className="premium-filter-card mb-6 md:mb-8"
          style={{
            background: 'var(--color-background)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <FilterBar
            searchPlaceholder={searchPlaceholder}
            timeRangeValue={timeRangeValue}
            onTimeRangeChange={onTimeRangeChange}
            showTimeRange={showTimeRange}
            sortValue={sortValue}
            onSortChange={onSortChange}
            sortOptions={sortOptions}
            onSearch={onSearch}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

