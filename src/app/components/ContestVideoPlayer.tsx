'use client';

import React from 'react';

interface ContestVideoPlayerProps {
  videoUrl: string;
  className?: string;
  poster?: string;
}

/**
 * ContestVideoPlayer - Simple HTML5 video player for contest submissions
 * Uses stored MP4 files from Supabase storage
 */
export function ContestVideoPlayer({
  videoUrl,
  className = '',
  poster,
}: ContestVideoPlayerProps) {
  return (
    <video
      src={videoUrl}
      controls
      poster={poster}
      className={`w-full rounded-lg border border-[var(--color-border)] ${className}`}
      preload="metadata"
    >
      Your browser does not support the video tag.
    </video>
  );
}

