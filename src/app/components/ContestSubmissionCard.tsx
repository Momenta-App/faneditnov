'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ContestVideoPlayer } from './ContestVideoPlayer';
import { MP4VideoModal } from './MP4VideoModal';
import { VideoModal } from './VideoModal';
import { Button } from './Button';
import { ImpactBadge } from './ImpactBadge';
import { CreatorLink } from './CreatorLink';
import { getContestVideoUrl, getStoragePublicUrl } from '@/lib/storage-utils';
import { detectPlatform } from '@/lib/url-utils';
import type { Platform } from '@/lib/url-utils';
import { Video } from '../types/data';
import { envClient } from '@/lib/env-client';

interface Submission {
  id: number;
  mp4_bucket?: string;
  mp4_path?: string;
  original_video_url?: string;
  platform?: string;
  video_id?: string;
  video_hot_id?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  saves_count?: number;
  impact_score?: number;
  processing_status?: string;
  content_review_status?: string;
  created_at?: string;
  updated_at?: string;
  invalid_stats_flag?: boolean;
  profiles?: {
    id: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
  };
  videos_hot?: {
    video_id?: string;
    post_id?: string;
    creator_id?: string;
    url?: string;
    caption?: string;
    description?: string;
    cover_url?: string;
    thumbnail_url?: string;
    video_url?: string;
    platform?: string;
    views_count?: number;
    likes_count?: number;
    comments_count?: number;
    shares_count?: number;
    collect_count?: number;
    impact_score?: number;
    creators_hot?: {
      creator_id?: string;
      username?: string;
      display_name?: string;
      avatar_url?: string;
      verified?: boolean;
    };
  };
}

interface ContestSubmissionCardProps {
  submission: Submission;
  showStats: boolean;
  showCreator: boolean;
  isUserSubmission: boolean;
  hideCreatorInfo?: boolean;
  onClick?: () => void;
  rank?: number;
  status?: string;
}

export function ContestSubmissionCard({
  submission,
  showStats,
  showCreator,
  isUserSubmission,
  hideCreatorInfo = false,
  onClick,
  rank,
  status,
}: ContestSubmissionCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMP4Popup, setShowMP4Popup] = useState(false);
  const [showEmbeddedPopup, setShowEmbeddedPopup] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getSubmissionStatusColor = (statusText: string) => {
    const lowerStatus = statusText.toLowerCase();
    if (lowerStatus.includes('approved')) {
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
    if (lowerStatus.includes('pending')) {
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
    if (lowerStatus.includes('rejected') || lowerStatus.includes('failed')) {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    switch (statusText) {
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

  // Get video data from videos_hot if available, otherwise use submission data
  // Prioritize Supabase storage bucket URLs for cover images (video-cover folder)
  const videoHot = submission.videos_hot;
  
  // Helper to check if URL is a Supabase storage URL (bucket-stored)
  // Images are stored in the bucket at paths like: video-cover/{video_id}-{hash}.{ext}
  const isSupabaseStorageUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    // Check if URL is a Supabase storage URL (contains /storage/v1/object/public/)
    // The cover_url in videos_hot should be the bucket URL if properly migrated
    return url.includes(supabaseUrl) && url.includes('/storage/v1/object/public/');
  };
  
  // Get cover URLs from videos_hot - prioritize bucket-stored images
  // DO NOT use MP4 video as cover image - only use actual image URLs
  const coverUrlFromHot = videoHot?.cover_url || '';
  const thumbnailUrlFromHot = videoHot?.thumbnail_url || '';
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development' && submission.id) {
    console.log('[ContestSubmissionCard] Cover image selection:', {
      submissionId: submission.id,
      videoHotId: videoHot?.video_id,
      coverUrlFromHot: coverUrlFromHot ? coverUrlFromHot.substring(0, 100) : 'empty',
      thumbnailUrlFromHot: thumbnailUrlFromHot ? thumbnailUrlFromHot.substring(0, 100) : 'empty',
      isCoverUrlBucket: isSupabaseStorageUrl(coverUrlFromHot),
      isThumbnailUrlBucket: isSupabaseStorageUrl(thumbnailUrlFromHot),
    });
  }
  
  // Prioritize bucket-stored cover images (Supabase storage URLs)
  // The cover_url in videos_hot should be the bucket URL if properly migrated
  let coverUrl = '';
  
  // First priority: cover_url if it's a Supabase storage bucket URL (video-cover folder)
  if (isSupabaseStorageUrl(coverUrlFromHot)) {
    coverUrl = coverUrlFromHot;
  } 
  // Second priority: thumbnail_url if it's a Supabase storage bucket URL
  else if (isSupabaseStorageUrl(thumbnailUrlFromHot)) {
    coverUrl = thumbnailUrlFromHot;
  } 
  // Third priority: cover_url even if external (might be valid external image URL)
  // Only use if it's an image URL, not a video URL
  else if (coverUrlFromHot && !coverUrlFromHot.match(/\.(mp4|webm|mov|avi)$/i) && !coverUrlFromHot.includes('video')) {
    coverUrl = coverUrlFromHot;
  } 
  // Last resort: thumbnail_url (only if it's an image, not video)
  else if (thumbnailUrlFromHot && !thumbnailUrlFromHot.match(/\.(mp4|webm|mov|avi)$/i) && !thumbnailUrlFromHot.includes('video')) {
    coverUrl = thumbnailUrlFromHot;
  }
  
  // DO NOT fallback to MP4 video - we want actual cover images only
  const mp4VideoUrl = submission.mp4_bucket && submission.mp4_path
    ? getContestVideoUrl(submission.mp4_bucket, submission.mp4_path)
    : null;
  const originalVideoUrl = videoHot?.video_url || videoHot?.url || '';
  
  // Get creator info from videos_hot or profiles (fallback to profiles if videoHot not available)
  const creatorFromHot = videoHot?.creators_hot;
  const creator = creatorFromHot ? {
    id: creatorFromHot.creator_id || '',
    username: creatorFromHot.username || creatorFromHot.display_name || 'Unknown',
    avatar: creatorFromHot.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorFromHot.username || 'U')}&background=120F23&color=fff`,
    verified: creatorFromHot.verified || false,
  } : submission.profiles ? {
    id: submission.profiles.id || '',
    username: submission.profiles.display_name || submission.profiles.email || 'Unknown',
    avatar: submission.profiles.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(submission.profiles.display_name || submission.profiles.email || 'U')}&background=120F23&color=fff`,
    verified: false,
  } : {
    id: '',
    username: 'Unknown',
    avatar: 'https://ui-avatars.com/api/?name=U&background=120F23&color=fff',
    verified: false,
  };

  // Get stats from videos_hot (single source of truth)
  const views = videoHot?.views_count ?? 0;
  const likes = videoHot?.likes_count ?? 0;
  const comments = videoHot?.comments_count ?? 0;
  const shares = videoHot?.shares_count ?? 0;
  const impact = Number(videoHot?.impact_score ?? 0);

  // Check if stats are currently being fetched (not stuck/failed)
  const statsAreLoading = (() => {
    if (submission.processing_status === 'fetching_stats') {
      // If invalid_stats_flag is set, it's failed, not loading
      if (submission.invalid_stats_flag === true) {
        return false;
      }
      // Check if it's stuck (> 30 minutes)
      const updatedAt = submission.updated_at || submission.created_at;
      if (updatedAt) {
        const updatedTime = new Date(updatedAt).getTime();
        const now = Date.now();
        const minutesSinceUpdate = (now - updatedTime) / (1000 * 60);
        // If it's been more than 30 minutes, consider it stuck/failed
        if (minutesSinceUpdate > 30) {
          return false;
        }
      }
      // If all stats are 0, they're likely still loading
      if (views === 0 && likes === 0 && comments === 0) {
        return true;
      }
    }
    return false;
  })();

  // Detect platform from videos_hot
  const videoPlatform: Platform = useMemo(() => {
    if (videoHot?.platform && videoHot.platform !== 'unknown') {
      return videoHot.platform as Platform;
    }
    if (originalVideoUrl) {
      return detectPlatform(originalVideoUrl);
    }
    return 'unknown';
  }, [videoHot?.platform, originalVideoUrl]);

  const platformMeta: Record<Platform, { label: string; bg: string; color: string; icon: React.ReactElement }> = {
    tiktok: {
      label: 'TikTok',
      bg: 'rgba(0,0,0,0.75)',
      color: '#fff',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M16 4.5c1 .9 2.2 1.5 3.5 1.5v3.4c-1.3.1-2.7-.3-3.9-1V16a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.3a2.1 2.1 0 00-1-.2 2.2 2.2 0 102.2 2.2V4.5h3.2Z" />
        </svg>
      ),
    },
    instagram: {
      label: 'Instagram',
      bg: 'rgba(255,255,255,0.9)',
      color: '#000',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    youtube: {
      label: 'YouTube',
      bg: 'rgba(255,0,0,0.85)',
      color: '#fff',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M21.5 7.5a2.7 2.7 0 00-1.9-1.9C17.3 5 12 5 12 5s-5.3 0-7.6.6A2.7 2.7 0 002.5 7.4 28.8 28.8 0 002 12a28.8 28.8 0 00.5 4.6 2.7 2.7 0 001.9 1.9C6.7 19 12 19 12 19s5.3 0 7.6-.6a2.7 2.7 0 001.9-1.9 28.8 28.8 0 00.5-4.6 28.8 28.8 0 00-.5-4.4zM10 15.2V8.8l5 3.2-5 3.2z" />
        </svg>
      ),
    },
    unknown: {
      label: 'Unknown',
      bg: 'rgba(0,0,0,0.65)',
      color: '#fff',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 9a3 3 0 116 0c0 2-3 2-3 4" />
          <circle cx="12" cy="17" r="1" />
        </svg>
      ),
    },
  };

  // Create Video object for VideoModal
  const videoForModal: Video = {
    id: videoHot?.video_id || submission.id.toString(),
    postId: videoHot?.post_id || videoHot?.video_id || submission.id.toString(),
    title: videoHot?.caption || videoHot?.description || 'Contest Submission',
    description: videoHot?.description || '',
    thumbnail: coverUrl,
    videoUrl: originalVideoUrl,
    platform: videoPlatform,
    creator,
    views,
    likes,
    comments,
    shares,
    saves: videoHot?.collect_count ?? submission.saves_count ?? 0,
    impact,
    duration: 0,
    createdAt: submission.created_at || new Date().toISOString(),
    hashtags: [],
  };

  const handleVideoClick = () => {
    if (onClick) {
      onClick();
    } else if (mp4VideoUrl) {
      // If MP4 is available, show MP4 modal
      setShowMP4Popup(true);
    } else if (originalVideoUrl) {
      // Otherwise show embedded video modal
      setShowEmbeddedPopup(true);
    }
  };

  // Determine rank class for top 3
  const rankClass = rank ? 
    (rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '') : '';

  return (
    <>
      {showMP4Popup && mp4VideoUrl && (
        <MP4VideoModal
          videoUrl={mp4VideoUrl}
          poster={coverUrl}
          onClose={() => setShowMP4Popup(false)}
        />
      )}
      {showEmbeddedPopup && originalVideoUrl && (
        <VideoModal
          video={videoForModal}
          onClose={() => setShowEmbeddedPopup(false)}
        />
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`card-base overflow-hidden relative ${rankClass}`}
      >
        <div>
          {/* Video/Image Section - Square aspect ratio */}
          <div 
            className="relative group cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
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
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={videoForModal.title}
                className="w-full aspect-square object-cover transition-transform duration-200 group-hover:scale-105 rounded-t-[var(--radius-xl)]"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('ui-avatars.com')) {
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(videoForModal.title)}&background=6366f1&color=fff&size=400`;
                  }
                }}
              />
            ) : (
              // DO NOT use MP4 video as cover - only show placeholder if no cover image available
              <div className="w-full aspect-square bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center rounded-t-[var(--radius-xl)]">
                <p className="text-white text-sm">No cover image available</p>
              </div>
            )}
            
            {/* Platform badge */}
            {videoPlatform !== 'unknown' && (
              <div
                className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg border backdrop-blur-sm z-10"
                style={{
                  background: platformMeta[videoPlatform].bg,
                  color: platformMeta[videoPlatform].color,
                  borderColor: platformMeta[videoPlatform].color,
                }}
                aria-label={`Platform: ${platformMeta[videoPlatform].label}`}
              >
                {platformMeta[videoPlatform].icon}
                <span>{platformMeta[videoPlatform].label}</span>
              </div>
            )}
            
            {/* Rank badge */}
            {rank && (
              <div 
                className={`absolute top-3 left-3 font-black text-base w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl backdrop-blur-sm z-20 ${
                  rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'bg-gradient-to-br from-purple-600 to-blue-600 text-white border-2 border-white/20'
                }`}
                style={
                  rank === 1 ? { 
                    background: 'linear-gradient(135deg, #ffd700, #ffed4e)', 
                    color: '#000', 
                    border: '2px solid #ffd700',
                    zIndex: 20
                  } :
                  rank === 2 ? { 
                    background: 'linear-gradient(135deg, #c0c0c0, #e8e8e8)', 
                    color: '#000', 
                    border: '2px solid #c0c0c0',
                    zIndex: 20
                  } :
                  rank === 3 ? { 
                    background: 'linear-gradient(135deg, #cd7f32, #e6a04f)', 
                    color: '#fff', 
                    border: '2px solid #cd7f32',
                    zIndex: 20
                  } : undefined
                }
              >
                {rank}
              </div>
            )}
            
            {/* Play button overlay on hover */}
            {isHovered && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity rounded-t-[var(--radius-xl)]">
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
            )}
          </div>

          {/* Content Section */}
          <div className="p-4">
            {/* User Submission Status Badge */}
            {isUserSubmission && status && (
              <div className="mb-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium border ${getSubmissionStatusColor(status)}`}
                >
                  {status}
                </span>
              </div>
            )}

            {/* Creator Info or Upload Date */}
            {hideCreatorInfo ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(submission.created_at)}</span>
                </div>
              </div>
            ) : showCreator && (
              <div className="flex items-center gap-2 mb-3">
                <img
                  src={creator.avatar}
                  alt={creator.username}
                  className="w-8 h-8 rounded-full border-2 border-[var(--color-border)]"
                />
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <CreatorLink
                    creatorId={creator.id}
                    username={creator.username}
                    className="text-sm font-medium truncate"
                  >
                    {creator.username}
                  </CreatorLink>
                  {creator.verified && (
                    <svg className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Stats - Completely hidden when hideCreatorInfo is true (public_hide_metrics setting) or for user submissions */}
            {!hideCreatorInfo && showStats ? (
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                {/* Removed ImpactBadge - impact score not displayed */}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  {statsAreLoading && views === 0 ? (
                    <svg className="w-3 h-3 animate-spin text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span className="font-medium">{formatNumber(views)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {statsAreLoading && likes === 0 ? (
                    <svg className="w-3 h-3 animate-spin text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span className="font-medium">{formatNumber(likes)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h11c.55 0 1-.45 1-1z"/>
                  </svg>
                  {statsAreLoading && comments === 0 ? (
                    <svg className="w-3 h-3 animate-spin text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span className="font-medium">{formatNumber(comments)}</span>
                  )}
                </div>
              </div>
            ) : null}

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
