'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video } from '../types/data';
import { detectPlatform } from '../../lib/url-utils';

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'unknown';

interface VideoModalProps {
  video: Video;
  onClose: () => void;
}

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  
  try {
    // Handle youtube.com/shorts/{videoId}
    const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/);
    if (shortsMatch && shortsMatch[1]) {
      return shortsMatch[1];
    }
    
    // Handle youtu.be/{videoId}
    const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    if (shortMatch && shortMatch[1]) {
      return shortMatch[1];
    }
    
    // Handle youtube.com/watch?v={videoId}
    const watchMatch = url.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/);
    if (watchMatch && watchMatch[1]) {
      return watchMatch[1];
    }
    
    // Handle youtube.com/embed/{videoId}
    const embedMatch = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/);
    if (embedMatch && embedMatch[1]) {
      return embedMatch[1];
    }

    // Handle live URLs: youtube.com/live/{videoId}
    const liveMatch = url.match(/youtube\.com\/live\/([A-Za-z0-9_-]+)/);
    if (liveMatch && liveMatch[1]) {
      return liveMatch[1];
    }
    
    // Try to extract from URL parameters
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return videoId;
      }
    } catch {
      // URL parsing failed, continue
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting YouTube video ID:', error);
    return null;
  }
}

function extractTikTokPostId(video: Video): string | null {
  const numeric = (value: string | undefined) =>
    value && /^\d+$/.test(value.trim()) ? value.trim() : null;

  const fromPostId = numeric(video.postId);
  if (fromPostId) {
    return fromPostId;
  }

  if (!video.videoUrl) return null;

  const explicitMatch = video.videoUrl.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/i);
  if (explicitMatch && explicitMatch[1]) {
    return explicitMatch[1];
  }

  const genericMatch = video.videoUrl.match(/video\/(\d+)/i);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1];
  }

  return null;
}

function extractInstagramEmbedData(video: Video): { shortcode: string | null; isReel: boolean } {
  let isReel = video.videoUrl ? /\/reel[s]?\//i.test(video.videoUrl) : false;
  let shortcode: string | null = null;

  if (video.videoUrl) {
    const match = video.videoUrl.match(/instagram\.com\/(reel|reels|p)\/([A-Za-z0-9_-]+)/i);
    if (match && match[2]) {
      shortcode = match[2];
      isReel = match[1] !== 'p';
    }
  }

  if (!shortcode) {
    const sanitizedPostId = video.postId?.trim();
    if (sanitizedPostId && !/^\d+$/.test(sanitizedPostId)) {
      shortcode = sanitizedPostId;
    }
  }

  return { shortcode, isReel };
}

function resolvePlatform(video: Video): Platform {
  if (video.platform && video.platform !== 'unknown') {
    return video.platform;
  }
  if (video.videoUrl) {
    const detected = detectPlatform(video.videoUrl);
    if (detected !== 'unknown') {
      return detected;
    }
  }
  return 'unknown';
}

export function VideoModal({ video, onClose }: VideoModalProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Construct iframe embed URL based on platform
  useEffect(() => {
    if (!video.videoUrl && !video.postId) {
      console.error('VideoModal: No videoUrl or postId provided', video);
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const isGooglevideoUrl = video.videoUrl?.includes('googlevideo.com') || false;
    let detectedPlatform = resolvePlatform(video);

    if (detectedPlatform === 'unknown' && isGooglevideoUrl && video.postId) {
      detectedPlatform = 'youtube';
    }

    setPlatform(detectedPlatform);
    setIsLoading(true);
    setHasError(false);

    let embedUrl: string | null = null;

    if (detectedPlatform === 'tiktok') {
      const tikTokId = extractTikTokPostId(video);
      if (tikTokId) {
        embedUrl = `https://www.tiktok.com/embed/v2/${tikTokId}`;
      }
    } else if (detectedPlatform === 'instagram') {
      const { shortcode, isReel } = extractInstagramEmbedData(video);
      if (shortcode) {
        const embedType = isReel ? 'reel' : 'p';
        embedUrl = `https://www.instagram.com/${embedType}/${shortcode}/embed`;
      } else {
        console.error('Instagram: Could not determine shortcode. videoUrl:', video.videoUrl, 'postId:', video.postId);
        setHasError(true);
        setIsLoading(false);
      }
    } else if (detectedPlatform === 'youtube') {
      let videoId: string | null = null;

      if (isGooglevideoUrl) {
        videoId = video.postId?.trim() || null;
      }

      if (!videoId && video.videoUrl) {
        videoId = extractYouTubeVideoId(video.videoUrl);
      }

      if (!videoId && video.postId) {
        videoId = video.postId;
      }

      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
      } else {
        console.error('YouTube: Could not determine video ID. videoUrl:', video.videoUrl, 'postId:', video.postId);
        setHasError(true);
        setIsLoading(false);
      }
    }

    if (embedUrl) {
      setIframeUrl(embedUrl);
    } else {
      console.error('Failed to generate embed URL for platform:', detectedPlatform, video);
      setHasError(true);
      setIsLoading(false);
    }
  }, [video]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Timeout fallback - if iframe doesn't load within 10 seconds, show error
  useEffect(() => {
    if (!iframeUrl || hasError) return;

    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Iframe load timeout after 10 seconds');
        setHasError(true);
        setIsLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [iframeUrl, isLoading, hasError]);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Dark backdrop - slightly transparent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Close button - floating */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 hover:scale-110 transition-all flex items-center justify-center group shadow-lg"
          aria-label="Close video modal"
        >
          <svg 
            className="w-8 h-8 text-white group-hover:rotate-90 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-[380px] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Video container - all platforms use portrait 9:16 aspect ratio */}
          <div className="relative w-full h-[650px] overflow-hidden">
            {!iframeUrl || hasError ? (
              /* Loading or Error state */
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                <div className="flex flex-col gap-4 items-center">
                  {hasError ? (
                    <>
                      <svg className="w-14 h-14 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-white/70 text-sm font-medium text-center px-4">
                        Failed to load video
                      </p>
                      <p className="text-white/50 text-xs text-center px-4">
                        Platform: {platform}
                        {video.videoUrl && <><br />URL: {video.videoUrl.substring(0, 50)}...</>}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                      <p className="text-white/70 text-sm font-medium">Loading video...</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Video iframe */
              <div className="relative w-full h-full overflow-hidden bg-black">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="flex flex-col gap-4 items-center">
                      <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                      <p className="text-white/70 text-sm font-medium">Loading video...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={iframeUrl}
                  className="w-full h-full border-none"
                  style={platform === 'instagram' ? {
                    transform: 'scale(1.2)',
                    transformOrigin: 'center top'
                  } : {}}
                  allow="encrypted-media; autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
                  allowFullScreen
                  scrolling="no"
                  onLoad={() => {
                    console.log('Iframe loaded successfully');
                    setIsLoading(false);
                  }}
                  onError={(e) => {
                    console.error('Iframe load error:', e);
                    setHasError(true);
                    setIsLoading(false);
                  }}
                  title={
                    platform === 'tiktok' 
                      ? `TikTok video from @${video.creator.username}`
                      : platform === 'instagram'
                      ? `Instagram post from @${video.creator.username}`
                      : `YouTube video from @${video.creator.username}`
                  }
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
