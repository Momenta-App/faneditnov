'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MP4VideoModalProps {
  videoUrl: string;
  poster?: string;
  onClose: () => void;
}

export function MP4VideoModal({ videoUrl, poster, onClose }: MP4VideoModalProps) {
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [containerSize, setContainerSize] = useState({ width: '90vw', height: '90vh', maxWidth: '1200px', maxHeight: '800px' });

  // Load video to get its natural dimensions
  useEffect(() => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = videoUrl;
    
    video.onloadedmetadata = () => {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
      setIsLoading(false);
    };

    video.onerror = () => {
      setIsLoading(false);
    };

    return () => {
      video.src = '';
    };
  }, [videoUrl]);

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

  // Calculate optimal size based on video aspect ratio and viewport
  const calculateOptimalSize = useCallback(() => {
    if (typeof window === 'undefined') {
      return { width: '90vw', height: '90vh', maxWidth: '1200px', maxHeight: '800px' };
    }

    if (!videoDimensions) {
      return { width: '90vw', height: '90vh', maxWidth: '1200px', maxHeight: '800px' };
    }

    const aspectRatio = videoDimensions.width / videoDimensions.height;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Leave some padding (10% on each side)
    const maxWidth = viewportWidth * 0.9;
    const maxHeight = viewportHeight * 0.9;

    let width: number;
    let height: number;

    // Calculate dimensions based on aspect ratio
    if (aspectRatio > 1) {
      // Landscape video
      width = Math.min(maxWidth, maxHeight * aspectRatio);
      height = width / aspectRatio;
    } else {
      // Portrait or square video
      height = Math.min(maxHeight, maxWidth / aspectRatio);
      width = height * aspectRatio;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: '95vw',
      maxHeight: '95vh',
    };
  }, [videoDimensions]);

  // Update size when video dimensions are loaded or window resizes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateSize = () => {
      setContainerSize(calculateOptimalSize());
    };

    updateSize();

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [calculateOptimalSize]);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Dark backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Close button */}
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

        {/* Video container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative mx-4"
          style={containerSize}
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-lg">
              <div className="flex flex-col gap-4 items-center">
                <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-white/70 text-sm font-medium">Loading video...</p>
              </div>
            </div>
          ) : (
            <video
              src={videoUrl}
              controls
              autoPlay
              poster={poster}
              className="w-full h-full rounded-lg shadow-2xl"
              style={{ objectFit: 'contain' }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

