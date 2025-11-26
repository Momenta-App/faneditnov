'use client';

import React from 'react';

interface ContestVideoPlayerProps {
  videoUrl: string;
  className?: string;
  poster?: string;
  usePopup?: boolean; // If true, opens video in popup instead of playing inline
  onPlay?: () => void; // Callback when video should be played (for popup mode)
}

/**
 * ContestVideoPlayer - Simple HTML5 video player for contest submissions
 * Uses stored MP4 files from Supabase storage
 * 
 * If usePopup is true, this component will render a clickable thumbnail that opens
 * the video in a popup modal instead of playing inline.
 */
export function ContestVideoPlayer({
  videoUrl,
  className = '',
  poster,
  usePopup = false,
  onPlay,
}: ContestVideoPlayerProps) {
  // If popup mode is enabled, render a clickable thumbnail
  if (usePopup && onPlay) {
    return (
      <div
        className={`relative group cursor-pointer ${className}`}
        onClick={onPlay}
        role="button"
        tabIndex={0}
        aria-label="Play video"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPlay();
          }
        }}
      >
        <video
          src={videoUrl}
          poster={poster}
          className="w-full rounded-lg border border-[var(--color-border)] transition-transform duration-200 group-hover:scale-105"
          preload="metadata"
        />
        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity group-hover:bg-black/50 rounded-lg">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Default inline playback
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

