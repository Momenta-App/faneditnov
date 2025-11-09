'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video } from '../types/data';

interface VideoModalProps {
  video: Video;
  onClose: () => void;
}

export function VideoModal({ video, onClose }: VideoModalProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  // Construct iframe embed URL directly
  useEffect(() => {
    if (!video.postId) {
      return;
    }
    
    // Direct iframe approach with autoplay and loop
    const iframeUrl = `https://www.tiktok.com/embed/v2/${video.postId}?autoplay=1&loop=1`;
    setIframeUrl(iframeUrl);
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
          {/* Video container - zoomed to hide white borders */}
          <div className="relative w-full h-[650px] overflow-hidden">
            {!iframeUrl ? (
              /* Loading state */
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                <div className="flex flex-col gap-4 items-center">
                  <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <p className="text-white/70 text-sm font-medium">Loading video...</p>
                </div>
              </div>
            ) : (
              /* Video iframe */
              <div className="relative w-full h-full overflow-hidden bg-black">
                <iframe
                  src={iframeUrl}
                  className="w-full h-full border-none"
                  style={{ 
                    transform: 'scale(1.2)',
                    transformOrigin: 'center top'
                  }}
                  allow="encrypted-media; autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
                  scrolling="no"
                  title={`TikTok video from @${video.creator.username}`}
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
