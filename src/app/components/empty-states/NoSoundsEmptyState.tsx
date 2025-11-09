'use client';

import React from 'react';
import { EmptyState } from './EmptyState';

interface NoSoundsEmptyStateProps {
  searchQuery?: string;
  onBrowse?: () => void;
  onClearSearch?: () => void;
}

export function NoSoundsEmptyState({
  searchQuery,
  onBrowse,
  onClearSearch,
}: NoSoundsEmptyStateProps) {
  const illustration = (
    <svg
      className="w-full h-auto"
      fill="none"
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="400" height="300" fill="#F3F4F6" rx="20" />
      {/* Speaker/audio wave */}
      <path
        d="M150 100 L150 200 L130 200 L130 250 L230 250 L230 200 L210 200 L210 100 Z"
        fill="#E5E7EB"
        stroke="#9CA3AF"
        strokeWidth="2"
      />
      {/* Sound waves */}
      <path
        d="M250 120 Q290 120, 290 150 Q290 180, 250 180"
        stroke="#9CA3AF"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M280 110 Q350 110, 350 150 Q350 190, 280 190"
        stroke="#9CA3AF"
        strokeWidth="4"
        fill="none"
      />
    </svg>
  );

  if (searchQuery) {
    return (
      <EmptyState
        illustration={illustration}
        title={`No sounds found for "${searchQuery}"`}
        description="Try adjusting your search or browse trending sounds"
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
      title="No Sounds Found"
      description="Try adjusting your search or filters to discover trending sounds"
      actionText="Browse Trending"
      onAction={onBrowse}
    />
  );
}

