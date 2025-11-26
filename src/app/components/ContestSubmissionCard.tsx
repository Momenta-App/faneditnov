'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ContestVideoPlayer } from './ContestVideoPlayer';
import { MP4VideoModal } from './MP4VideoModal';
import { Button } from './Button';
import { getContestVideoUrl } from '@/lib/storage-utils';

interface Submission {
  id: number;
  mp4_bucket?: string;
  mp4_path?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  impact_score?: number;
  processing_status?: string;
  content_review_status?: string;
  profiles?: {
    id: string;
    display_name?: string;
    email?: string;
  };
}

interface ContestSubmissionCardProps {
  submission: Submission;
  showStats: boolean;
  showCreator: boolean;
  isUserSubmission: boolean;
  onClick?: () => void;
  rank?: number;
}

export function ContestSubmissionCard({
  submission,
  showStats,
  showCreator,
  isUserSubmission,
  onClick,
  rank,
}: ContestSubmissionCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'waiting_review':
      case 'pending':
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'failed':
      case 'rejected':
      case 'fail':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getProcessingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      fetching_stats: 'Fetching stats',
      checking_hashtags: 'Checking hashtags',
      checking_description: 'Checking description',
      waiting_review: 'Waiting review',
      approved: 'Approved',
    };
    return labels[status] || status;
  };

  const videoUrl = submission.mp4_bucket && submission.mp4_path
    ? getContestVideoUrl(submission.mp4_bucket, submission.mp4_path)
    : null;

  const handleVideoClick = () => {
    if (onClick) {
      onClick();
    } else if (videoUrl) {
      // Open video in popup instead of inline playback
      setShowPopup(true);
    }
  };

  return (
    <>
      {showPopup && videoUrl && (
        <MP4VideoModal
          videoUrl={videoUrl}
          onClose={() => setShowPopup(false)}
        />
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="card-base overflow-hidden relative"
      >
        <div>
          {/* Video Section */}
          {videoUrl ? (
            <div className="relative">
              <div
                className="relative group cursor-pointer"
                onClick={handleVideoClick}
                role="button"
                tabIndex={0}
                aria-label="Play video"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleVideoClick();
                  }
                }}
              >
                <video
                  src={videoUrl}
                  className="w-full aspect-[3/4] object-cover transition-transform duration-200 group-hover:scale-105 rounded-t-[var(--radius-xl)]"
                  preload="metadata"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity group-hover:bg-black/50">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                  >
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </motion.div>
                </div>
                {/* Rank badge */}
                {rank && (
                  <div className="absolute top-3 left-3 font-black text-base w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl backdrop-blur-sm z-20 bg-gradient-to-br from-purple-600 to-blue-600 text-white border-2 border-white/20">
                    {rank}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full aspect-[3/4] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center rounded-t-[var(--radius-xl)]">
              <p className="text-white text-sm">No video available</p>
            </div>
          )}

        {/* Content Section */}
        <div className="p-4">
          {/* User Submission Status Badge */}
          {isUserSubmission && submission.processing_status && (
            <div className="mb-3">
              <span
                className={`px-2 py-1 rounded text-xs font-medium border ${getSubmissionStatusColor(
                  submission.processing_status
                )}`}
              >
                {getProcessingStatusLabel(submission.processing_status)}
              </span>
            </div>
          )}

          {/* Creator Info - Only show if showCreator is true and not user's submission */}
          {showCreator && !isUserSubmission && submission.profiles && (
            <div className="mb-3">
              <Link
                href={`/creator/${submission.profiles.id}`}
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {submission.profiles.display_name || submission.profiles.email || 'Unknown Creator'}
              </Link>
            </div>
          )}

          {/* Stats - Only show if showStats is true */}
          {showStats && (
            <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {submission.views_count !== undefined && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  <span className="font-medium">{formatNumber(submission.views_count)}</span>
                </div>
              )}
              {submission.likes_count !== undefined && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="font-medium">{formatNumber(submission.likes_count)}</span>
                </div>
              )}
              {submission.comments_count !== undefined && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h11c.55 0 1-.45 1-1z"/>
                  </svg>
                  <span className="font-medium">{formatNumber(submission.comments_count)}</span>
                </div>
              )}
            </div>
          )}

          {/* View Details Button - Only for user submissions */}
          {isUserSubmission && (
            <div className="mt-3">
              <Link href="/settings?tab=contests">
                <Button variant="secondary" size="sm" className="w-full">
                  View Details
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
    </>
  );
}

