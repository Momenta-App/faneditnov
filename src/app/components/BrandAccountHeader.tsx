'use client';

import React from 'react';
import { Badge } from './Badge';
import { FilterBar } from './filters';

interface Stat {
  label: string;
  value: string | number;
  icon?: string;
}

interface BrandAccountHeaderProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    gradient: string;
  };
  stats?: Stat[];
  searchPlaceholder?: string;
  timeRangeValue?: string;
  onTimeRangeChange?: (value: string) => void;
  showTimeRange?: boolean;
  onSearch?: (query: string) => void;
  className?: string;
}

/**
 * BrandAccountHeader - Brand account page style header with stats and filters
 * Clean, modern design inspired by social media profile pages
 */
export function BrandAccountHeader({
  title,
  subtitle,
  badge,
  stats = [],
  searchPlaceholder = 'Search...',
  timeRangeValue = 'all',
  onTimeRangeChange,
  showTimeRange = false,
  onSearch,
  className = '',
}: BrandAccountHeaderProps) {
  return (
    <div 
      className={`bar ${className}`}
      style={{ '--bar-bg': 'var(--color-surface)' } as React.CSSProperties}
    >
      <div className="container-base max-w-[1440px] mx-auto">
        {/* Brand Account Section */}
        <div className="pt-4 md:pt-6">
          
          {/* Title, Subtitle & Badge */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {title}
              </h1>
              {badge && (
                <Badge className={`bg-gradient-to-r ${badge.gradient} text-white shrink-0 self-start sm:self-center`}>
                  {badge.text}
                </Badge>
              )}
            </div>
            
            {subtitle && (
              <p 
                className="text-base md:text-lg leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Stats Section */}
          {stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-6 md:gap-8 pb-4">
              {stats.map((stat, index) => (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {stat.icon && (
                      <span className="text-lg">{stat.icon}</span>
                    )}
                    <span 
                      className="text-2xl md:text-3xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {stat.value}
                    </span>
                  </div>
                  <span 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters Section - seamlessly connected */}
        <div className="py-3 border-t border-[var(--color-border)]">
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
    </div>
  );
}

