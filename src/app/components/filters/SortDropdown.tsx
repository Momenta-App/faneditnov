'use client';

import React from 'react';

export interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  placeholder?: string;
  className?: string;
}

/**
 * SortDropdown - Premium pill-style button group for sorting
 * Features smooth transitions, elegant hover states, and active indicators
 */
export function SortDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Sort...', 
  className = '' 
}: SortDropdownProps) {
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

// Predefined sort options
// Impact Score is the default ranking method
export const VIDEO_SORT_OPTIONS: SortOption[] = [
  { value: 'impact', label: 'Impact Score' },
  { value: 'views', label: 'Most Views' },
  { value: 'likes', label: 'Most Likes' },
];

export const CREATOR_SORT_OPTIONS: SortOption[] = [
  { value: 'impact', label: 'Impact Score' },
  { value: 'views', label: 'Most Views' },
  { value: 'followers', label: 'Most Followers' },
  { value: 'videos', label: 'Most Videos' },
];

export const HASHTAG_SORT_OPTIONS: SortOption[] = [
  { value: 'impact', label: 'Impact Score' },
  { value: 'views', label: 'Most Views' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'creators', label: 'Most Creators' },
];

export const SOUND_SORT_OPTIONS: SortOption[] = [
  { value: 'impact', label: 'Impact Score' },
  { value: 'views', label: 'Most Views' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'likes', label: 'Most Likes' },
];

export const COMMUNITY_SORT_OPTIONS: SortOption[] = [
  { value: 'impact', label: 'Impact Score' },
  { value: 'views', label: 'Most Views' },
  { value: 'videos', label: 'Most Videos' },
  { value: 'creators', label: 'Most Creators' },
];

