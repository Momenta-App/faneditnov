'use client';

import React from 'react';
import { EmptyState } from './EmptyState';

interface NoCreatorsEmptyStateProps {
  searchQuery?: string;
  onRefresh?: () => void;
  onBrowse?: () => void;
  onClearSearch?: () => void;
}

export function NoCreatorsEmptyState({
  searchQuery,
  onRefresh,
  onBrowse,
  onClearSearch,
}: NoCreatorsEmptyStateProps) {
  const illustration = (
    <svg
      className="w-full h-auto"
      fill="none"
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="400" height="300" fill="#F3F4F6" rx="20" />
      {/* Person 1 */}
      <circle cx="180" cy="100" r="30" fill="#E5E7EB" />
      <rect x="150" y="130" width="60" height="80" rx="30" fill="#E5E7EB" />
      {/* Person 2 */}
      <circle cx="280" cy="100" r="30" fill="#E5E7EB" />
      <rect x="250" y="130" width="60" height="80" rx="30" fill="#E5E7EB" />
      {/* Person 3 */}
      <circle cx="380" cy="100" r="30" fill="#E5E7EB" />
      <rect x="350" y="130" width="60" height="80" rx="30" fill="#E5E7EB" />
    </svg>
  );

  if (searchQuery) {
    return (
      <EmptyState
        illustration={illustration}
        title={`No creators found for "${searchQuery}"`}
        description="Try a different search term or browse popular creators"
        actionText="Clear Search"
        onAction={onClearSearch}
        secondaryActionText="Browse Popular"
        onSecondaryAction={onBrowse}
      />
    );
  }

  return (
    <EmptyState
      illustration={illustration}
      title="No Creators Found"
      description="Start scraping TikTok content to discover creators and build your database"
      actionText="Refresh"
      onAction={onRefresh}
      secondaryActionText="Browse Popular"
      onSecondaryAction={onBrowse}
    />
  );
}

