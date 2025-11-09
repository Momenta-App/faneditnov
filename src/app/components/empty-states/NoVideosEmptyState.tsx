'use client';

import React from 'react';
import { EmptyState } from './EmptyState';

interface NoVideosEmptyStateProps {
  searchQuery?: string;
  onUpload?: () => void;
  onBrowse?: () => void;
  onClearSearch?: () => void;
}

export function NoVideosEmptyState({
  searchQuery,
  onUpload,
  onBrowse,
  onClearSearch,
}: NoVideosEmptyStateProps) {
  const illustration = (
    <svg
      className="w-full h-auto"
      fill="none"
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="400" height="300" fill="#F3F4F6" rx="20" />
      <rect x="120" y="60" width="160" height="120" rx="8" fill="#E5E7EB" />
      <circle cx="160" cy="120" r="20" fill="#9CA3AF" />
      <rect x="140" y="110" width="40" height="20" rx="2" fill="#9CA3AF" />
      <path
        d="M180 120 L200 110 L200 130 L180 120 Z"
        fill="#9CA3AF"
      />
      <text
        x="200"
        y="220"
        fontSize="20"
        fill="#9CA3AF"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
      >
        {searchQuery ? 'No results found' : 'No videos yet'}
      </text>
    </svg>
  );

  if (searchQuery) {
    return (
      <EmptyState
        illustration={illustration}
        title={`No results for "${searchQuery}"`}
        description="Try adjusting your search or browse popular content"
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
      title="No Videos Found"
      description="Start by uploading a video or scraping TikTok content to build your collection"
      actionText="Upload Video"
      onAction={onUpload}
      secondaryActionText="Browse Trending"
      onSecondaryAction={onBrowse}
    />
  );
}

