'use client';

import React from 'react';

interface TabsProps {
  children: React.ReactNode;
  className?: string;
}

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabProps {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

interface TabPanelsProps {
  children: React.ReactNode;
  className?: string;
}

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Tabs - Theme-aware tab component
 * Mobile: Scrollable, tap targets ≥ 44px
 * Desktop: Horizontal tabs
 */
export function Tabs({ children, className = '' }: TabsProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div className={`flex gap-[var(--spacing-2)] overflow-x-auto scrollbar-hide border-b border-[var(--color-border)] ${className}`}>
      {children}
    </div>
  );
}

export function Tab({ children, isActive = false, onClick, className = '' }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-[var(--spacing-4)] 
        py-[var(--spacing-4)] 
        min-h-[44px]
        font-medium 
        text-sm
        border-b-[var(--border-width-thick)]
        transition-colors
        focus-ring
        ${
          isActive
            ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
            : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
        }
        ${className}
      `}
      aria-selected={isActive}
      role="tab"
    >
      {children}
    </button>
  );
}

export function TabPanels({ children, className = '' }: TabPanelsProps) {
  return <div className={className}>{children}</div>;
}

export function TabPanel({ children, className = '' }: TabPanelProps) {
  return <div className={className} role="tabpanel">{children}</div>;
}

