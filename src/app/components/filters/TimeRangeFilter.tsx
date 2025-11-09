'use client';

import React from 'react';

interface TimeRangeFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

interface TimeRangeOption {
  value: string;
  label: string;
}

/**
 * TimeRangeFilter - Premium pill-style button group for time ranges
 * Features smooth transitions, elegant hover states, and active indicators
 */
export function TimeRangeFilter({ value, onChange, className = '' }: TimeRangeFilterProps) {
  const options: TimeRangeOption[] = [
    { value: 'all', label: 'All Time' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '1y', label: 'Last Year' },
  ];

  return (
    <div className={`premium-pill-group ${className}`}>
      <div 
        className="inline-flex flex-wrap gap-2 p-1.5 rounded-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className="premium-pill-button"
              style={{
                padding: '10px 20px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: isActive 
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))'
                  : 'transparent',
                color: isActive 
                  ? '#ffffff'
                  : 'var(--color-text-primary)',
                boxShadow: isActive 
                  ? '0 4px 12px rgba(0, 122, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : 'none',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--color-background)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

