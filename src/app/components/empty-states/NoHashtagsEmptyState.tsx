'use client';

import React from 'react';
import { EmptyState } from './EmptyState';

interface NoHashtagsEmptyStateProps {
  searchQuery?: string;
  onRefresh?: () => void;
  onBrowse?: () => void;
  onClearSearch?: () => void;
}

export function NoHashtagsEmptyState({
  searchQuery,
  onRefresh,
  onBrowse,
  onClearSearch,
}: NoHashtagsEmptyStateProps) {
  const illustration = (
    <svg
      className="w-full h-auto"
      fill="none"
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="400" height="300" fill="#F3F4F6" rx="20" />
      {/* Hashtag symbols */}
      <g transform="translate(120, 80)">
        {/* # */}
        <rect x="0" y="10" width="60" height="10" rx="5" fill="#E5E7EB" />
        <rect x="0" y="35" width="60" height="10" rx="5" fill="#E5E7EB" />
        <rect x="0" y="0" width="10" height="60" rx="5" fill="#E5E7EB" />
        <rect x="50" y="0" width="10" height="60" rx="5" fill="#E5E7EB" />
      </g>
      <g transform="translate(220, 120)">
        {/* # */}
        <rect x="0" y="10" width="60" height="10" rx="5" fill="#E5E7EB" />
        <rect x="0" y="35" width="60" height="10" rx="5" fill="#E5E7EB" />
        <rect x="0" y="0" width="10" height="60" rx="5" fill="#E5E7EB" />
        <rect x="50" y="0" width="10" height="60" rx="5" fill="#E5E7EB" />
      </g>
    </svg>
  );

  if (searchQuery) {
    return (
      <EmptyState
        illustration={illustration}
        title={`No hashtags found for "${searchQuery}"`}
        description="Try a different search term or browse trending hashtags"
        actionText="Clear Search"
        onAction={onClearSearch}
        secondaryActionText="Browse Trending"
        onSecondaryAction={onBrowse}
      />
    );
  }

  return (
    <EmptyState
      illustration={illustration}
      title="No Hashtags Found"
      description="Start scraping TikTok content to discover hashtags and trending topics"
      actionText="Refresh"
      onAction={onRefresh}
      secondaryActionText="Browse Trending"
      onSecondaryAction={onBrowse}
    />
  );
}

