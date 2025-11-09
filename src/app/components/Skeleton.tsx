'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton - Theme-aware loading skeleton component
 * Uses border color token for subtle, visible skeleton in both themes
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-[var(--color-border)] rounded-[var(--radius-sm)] ${className}`} 
      role="status" 
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="card-base overflow-hidden">
      <Skeleton className="w-full aspect-[9/16] mb-3" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div className="card-base p-6">
      <div className="flex items-start gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-4 mt-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

