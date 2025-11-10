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

    // For YouTube, the videoUrl might be a googlevideo.com CDN URL
    // We need to use postId as the video ID, or detect platform from the stored platform field
    // If platform is unknown but we have a postId, assume it's YouTube if videoUrl contains googlevideo
    const isGooglevideoUrl = video.videoUrl?.includes('googlevideo.com') || false;
    
    // Use platform from video object if available, otherwise detect from URL
    let detectedPlatform = video.platform && video.platform !== 'unknown'
      ? video.platform
      : (video.videoUrl ? detectPlatform(video.videoUrl) : 'unknown');
    
    // Special handling: if we have googlevideo.com URL and platform is unknown, it's likely YouTube
    // and the postId should be the YouTube video ID
    if (detectedPlatform === 'unknown' && isGooglevideoUrl && video.postId) {
      console.log('Detected googlevideo.com URL, assuming YouTube. Using postId as video ID:', video.postId);
      detectedPlatform = 'youtube';
    }
    
    setPlatform(detectedPlatform);
    setIsLoading(true);
    setHasError(false);

    let embedUrl: string | null = null;

    if (detectedPlatform === 'tiktok') {
      // TikTok embed: https://www.tiktok.com/embed/v2/{postId}
      if (video.postId) {
        embedUrl = `https://www.tiktok.com/embed/v2/${video.postId}`;
      }
    } else if (detectedPlatform === 'instagram') {
      // Instagram embed: supports both posts (/p/) and reels (/reel/)
      // Instagram embeds require the shortcode (alphanumeric), not the numeric post_id
      // Extract shortcode from URL if postId is numeric
      let instagramShortcode: string | null = null;
      let isReel = false;
      
      if (video.videoUrl) {
        // Check if videoUrl is a CDN URL (scontent-*.cdninstagram.com)
        const isCdnUrl = video.videoUrl.includes('cdninstagram.com');
        
        if (isCdnUrl) {
          // If it's a CDN URL, we can't extract shortcode from it
          // Use postId if it's already a shortcode, otherwise we need the post URL
          console.warn('Instagram: videoUrl is a CDN URL, cannot extract shortcode. postId:', video.postId);
        } else {
          // Try to extract shortcode from post URL: /p/{shortcode} or /reel/{shortcode}
          const urlMatch = video.videoUrl.match(/instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/);
          if (urlMatch && urlMatch[2]) {
            instagramShortcode = urlMatch[2];
            isReel = urlMatch[1] === 'reel';
          }
        }
      }
      
      // Use shortcode from URL if available, otherwise check if postId is already a shortcode
      // If postId is numeric (all digits), it's not a valid shortcode for embeds
      const isNumericPostId = video.postId && /^\d+$/.test(video.postId);
      const shortcode = instagramShortcode || (isNumericPostId ? null : video.postId);
      
      if (shortcode) {
        // Determine if it's a reel or post
        if (!isReel && video.videoUrl) {
          isReel = video.videoUrl.includes('/reel/');
        }
        const embedType = isReel ? 'reel' : 'p';
        embedUrl = `https://www.instagram.com/${embedType}/${shortcode}/embed`;
      } else {
        console.error('Instagram: Could not determine shortcode. videoUrl:', video.videoUrl, 'postId:', video.postId);
        setHasError(true);
        setIsLoading(false);
      }
    } else if (detectedPlatform === 'youtube') {
      // YouTube embed: https://www.youtube.com/embed/{videoId}
      // Try to extract from videoUrl first, but if it's a googlevideo.com URL, use postId
      let videoId: string | null = null;
      
      if (isGooglevideoUrl) {
        // If it's a googlevideo.com URL, the postId should be the YouTube video ID
        videoId = video.postId || null;
        console.log('YouTube: Using postId as video ID (googlevideo.com detected):', videoId);
      } else {
        // Try to extract from the URL
        videoId = video.videoUrl ? extractYouTubeVideoId(video.videoUrl) : null;
      }
      
      console.log('YouTube video detection:', { 
        videoUrl: video.videoUrl, 
        videoId, 
        postId: video.postId,
        isGooglevideoUrl 
      });
      
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
      } else {
        console.error('YouTube: Could not determine video ID. videoUrl:', video.videoUrl, 'postId:', video.postId);
        setHasError(true);
        setIsLoading(false);
      }
    }

    if (embedUrl) {
      console.log('Setting embed URL:', embedUrl);
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
