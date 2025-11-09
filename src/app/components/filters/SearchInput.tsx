'use client';

import React, { useState, useEffect } from 'react';

interface SearchInputProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

/**
 * SearchInput - Premium search input with enhanced visuals
 * Features smooth animations, elegant styling, and debounced search
 */
export function SearchInput({ placeholder = 'Search...', onSearch, className = '' }: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Call onSearch when debounced query changes
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch]);

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    if (onSearch) {
      onSearch('');
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Search Icon */}
      <div 
        className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none transition-all duration-300"
        style={{
          color: isFocused ? 'var(--color-primary)' : 'var(--color-text-muted)',
        }}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="premium-search-input"
        style={{
          width: '100%',
          padding: '14px 48px 14px 48px',
          fontSize: '15px',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          borderRadius: '16px',
          border: '2px solid var(--color-border)',
          background: 'var(--color-background)',
          color: 'var(--color-text-primary)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          outline: 'none',
          boxShadow: isFocused 
            ? '0 0 0 4px rgba(0, 122, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08)' 
            : '0 2px 8px rgba(0, 0, 0, 0.04)',
          borderColor: isFocused ? 'var(--color-primary)' : 'var(--color-border)',
        }}
      />
      
      {/* Clear Button */}
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 transition-all duration-300 rounded-full"
          aria-label="Clear search"
          style={{
            padding: '6px',
            color: 'var(--color-text-muted)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-primary)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-surface)';
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

