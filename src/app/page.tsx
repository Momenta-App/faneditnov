'use client';
// Build timestamp: 2025-10-31 - CSS fix deployed

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { VideoCard } from './components/VideoCard';
import { CreatorCard } from './components/CreatorCard';
import { ContactBrandModal } from './components/ContactBrandModal';
import { useHomepage } from './hooks/useData';

type TimeFilter = 'all' | 'year' | 'month';

interface Stat {
  value: string;
  label: string;
}

export default function Home() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [creatorTimeFilter, setCreatorTimeFilter] = useState<TimeFilter>('all');
  // Use homepage cache for fast loading
  const { data: homepageData, loading: loadingVideos } = useHomepage(timeFilter);
  const { data: creatorHomepageData, loading: loadingCreators } = useHomepage(creatorTimeFilter);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(700);
  const [mounted, setMounted] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallMobile, setIsSmallMobile] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Track when component is mounted and styles are loaded
  useEffect(() => {
    // Wait for next tick to ensure React has hydrated and styled-jsx styles are injected
    // This prevents flash of unstyled content
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        setMounted(true);
      });

      // Check if mobile on mount and resize
      const checkMobile = () => {
        const width = window.innerWidth;
        setIsMobile(width <= 768);
        setIsSmallMobile(width <= 600);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Track when initial data has loaded (only set once)
  useEffect(() => {
    if (mounted && !loadingVideos && !loadingCreators && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [mounted, loadingVideos, loadingCreators, hasInitiallyLoaded]);

  // Show loading state only until component is mounted and initial data is loaded
  // After initial load, don't show full loading screen for filter changes
  const isLoading = !mounted || (!hasInitiallyLoaded && (loadingVideos || loadingCreators));

  // Progress bar animation with easing that slows down near the end
  useEffect(() => {
    if (!isLoading) {
      setLoadingProgress(0);
      return;
    }

    let progress = 0;
    const duration = 2500; // 2.5 seconds total
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      
      // Easing function that slows down significantly as it approaches 100%
      // Using ease-out quartic function for more pronounced slowdown: 1 - (1 - t)^4
      // This makes it much slower near the end
      const easedProgress = 1 - Math.pow(1 - rawProgress, 4);
      
      progress = Math.min(easedProgress * 100, 99); // Cap at 99% to never fully complete
      setLoadingProgress(progress);

      if (progress < 99) {
        requestAnimationFrame(updateProgress);
      } else {
        setLoadingProgress(100);
      }
    };

    updateProgress();
  }, [isLoading]);
  // Use stats from homepage cache (faster than separate API call)
  const stats = useMemo<Stat[]>(() => {
    if (homepageData?.stats) {
      return [
        { value: homepageData.stats.videos.formatted, label: homepageData.stats.videos.label },
        { value: homepageData.stats.views.formatted, label: homepageData.stats.views.label },
        { value: homepageData.stats.creators.formatted, label: homepageData.stats.creators.label },
      ];
    }
    // Default stats if cache not loaded yet
    return [
      { value: '10K+', label: 'Epic Edits' },
      { value: '50M+', label: 'Global Views' },
      { value: '2.5K+', label: 'Talented Creators' },
    ];
  }, [homepageData]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      if (gridRef.current) {
        const height = gridRef.current.offsetHeight;
        setGridHeight(height);
      }
    };

    const timer = setTimeout(updateHeight, 100);
    window.addEventListener('resize', updateHeight);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Use videos from homepage cache (already deduplicated by creator)
  const filteredVideos = homepageData?.topVideos || [];
  
  // Transform creators from cache to match CreatorCard expected format
  const transformedCreators = useMemo(() => {
    return (creatorHomepageData?.topCreators || []).map((creator: any) => ({
      id: creator.unique_id || creator.id || '',
      username: creator.username || '',
      displayName: creator.displayName || creator.username || 'Unknown',
      bio: creator.bio || '',
      avatar: creator.avatarUrl || creator.avatar || '',
      verified: creator.verified || false,
      followers: creator.followerCount || creator.followers || 0,
      videos: creator.videoCount || creator.videos || 0,
      likes: creator.totalLikes || creator.likes || 0,
      views: creator.totalViews || creator.views || 0,
      impact: creator.impactScore || creator.impact || 0,
    }));
  }, [creatorHomepageData]);

  if (isLoading) {
    return (
      <>
        <style jsx>{`
          .loading-container {
            background: #000000;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }

          .loading-bar-wrapper {
            width: 100%;
            max-width: 400px;
            padding: 0 2rem;
          }

          .loading-bar-track {
            width: 100%;
            height: 3px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
            position: relative;
          }

          .loading-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #007AFF, #0051D5);
            border-radius: 2px;
            transition: width 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 12px rgba(0, 122, 255, 0.6);
          }

          .loading-bar-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.3),
              transparent
            );
            animation: shimmer 2s ease-in-out infinite;
          }

          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
        `}</style>
        <div className="loading-container">
          <div className="loading-bar-wrapper">
            <div className="loading-bar-track">
              <div 
                className="loading-bar-fill"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="landing-page">
      <style jsx>{`
        .landing-page {
          background: #000000;
          color: #ffffff;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        /* Acid distorted animated background */
        .acid-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .acid-blob {
          position: absolute;
          border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
          mix-blend-mode: screen;
          filter: blur(60px);
          animation: morph 20s ease-in-out infinite, float 30s ease-in-out infinite;
          opacity: 0.4;
        }

        .acid-blob-1 {
          width: 600px;
          height: 600px;
          top: -10%;
          left: -10%;
          background: linear-gradient(45deg, #00ffff, #0066ff);
          animation-delay: 0s;
        }

        .acid-blob-2 {
          width: 500px;
          height: 500px;
          top: 40%;
          right: -10%;
          background: linear-gradient(135deg, #00ff88, #0088ff);
          animation-delay: 3s;
        }

        .acid-blob-3 {
          width: 700px;
          height: 700px;
          bottom: -20%;
          left: 30%;
          background: linear-gradient(225deg, #0099ff, #ff8800);
          animation-delay: 6s;
        }

        @keyframes morph {
          0%, 100% {
            border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
          }
          25% {
            border-radius: 58% 42% 75% 25% / 76% 46% 54% 24%;
          }
          50% {
            border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%;
          }
          75% {
            border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(100px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-50px, 100px) scale(0.9);
          }
        }

        /* Grid overlay */
        .grid-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          z-index: 1;
          pointer-events: none;
        }

        /* Content wrapper */
        .content-wrapper {
          position: relative;
          z-index: 10;
        }

        /* Hero section */
        .hero {
          min-height: 90vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem 1.5rem 4rem;
          text-align: center;
        }

        .hero-content {
          max-width: 1200px;
          animation: fadeInUp 1s ease-out;
        }

        .badge {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50px;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 2rem;
          backdrop-filter: blur(10px);
          animation: glow 3s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 255, 255, 0.5);
          }
        }

        .hero-title {
          font-size: clamp(3rem, 8vw, 6rem);
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: 1.25rem;
          background: linear-gradient(135deg, #fff, #00ffff, #0066ff, #fff);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 8s ease infinite;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .hero-subtitle {
          font-size: clamp(1rem, 2vw, 1.25rem);
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 2rem;
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }

        .cta-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }

        .btn {
          padding: 1.25rem 3rem;
          font-size: 1.125rem;
          font-weight: 700;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          animation: subtle-pulse 3s ease-in-out infinite;
        }

        @keyframes subtle-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        .btn-primary {
          background: linear-gradient(135deg, #0066ff, #00ffff);
          color: #000;
          box-shadow: 0 12px 35px rgba(0, 102, 255, 0.4), 0 0 20px rgba(0, 255, 255, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 18px 50px rgba(0, 102, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.5);
          animation: none;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border: 2px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
        }

        .shine-text-bold {
          font-weight: 900 !important;
          background: linear-gradient(
            90deg,
            #a0a0a0 0%,
            #c0c0c0 20%,
            #e8e8e8 40%,
            #c0c0c0 60%,
            #a0a0a0 80%,
            #c0c0c0 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shine-text 3s ease-in-out infinite;
        }

        @keyframes shine-text {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 12px 35px rgba(255, 255, 255, 0.2);
          animation: none;
        }

        /* Stats section */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
          margin-top: 2rem;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 1.75rem 1.5rem;
          text-align: center;
          backdrop-filter: blur(20px);
          transition: all 0.3s ease;
          animation: fadeIn 1s ease-out backwards;
        }

        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.2s; }
        .stat-card:nth-child(3) { animation-delay: 0.3s; }

        .stat-card:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(0, 255, 255, 0.3);
          box-shadow: 0 20px 50px rgba(0, 255, 255, 0.2);
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 900;
          background: linear-gradient(135deg, #0066ff, #00ffff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        /* Section styling */
        .section {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5rem 1.5rem;
          position: relative;
        }

        .section-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .section-title {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          margin-bottom: 0.75rem;
          background: linear-gradient(135deg, #fff, #00ffff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .section-subtitle {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.6);
          max-width: 700px;
          margin: 0 auto;
          margin-top: 0.75rem;
        }

        /* Filter buttons */
        .filter-buttons {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: nowrap;
          margin-bottom: 2.5rem;
        }

        /* Reduce margin on mobile */
        @media (max-width: 768px) {
          .filter-buttons {
            margin-bottom: 1.25rem;
            gap: 0.5rem;
          }
        }

        .filter-btn {
          padding: 0.75rem 1.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 50px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .filter-btn {
            padding: 0.625rem 1rem;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .filter-btn {
            padding: 0.5rem 0.75rem;
            font-size: 0.7rem;
          }
        }

        .filter-btn.active {
          background: linear-gradient(135deg, #0066ff, #00ffff);
          color: #000;
          border-color: transparent;
          box-shadow: 0 10px 30px rgba(0, 102, 255, 0.3);
        }

        .filter-btn:hover:not(.active) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(0, 255, 255, 0.3);
        }

        /* How it works section */
        .how-it-works {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 0 2rem;
        }

        .how-it-works-intro {
          text-align: center;
          margin-bottom: 4rem;
        }

        .how-it-works-intro h3 {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.5rem;
        }

        .how-it-works-intro h2 {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem);
          font-weight: 900;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #fff, #00ffff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .how-it-works-intro p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          max-width: 800px;
          margin: 0 auto 0.75rem;
        }

        .features-grid-wrapper {
          position: relative;
          width: 100%;
        }

        .video-background-layer {
          position: absolute;
          top: -120px;
          right: 0;
          left: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1;
        }

        .feature-video {
          object-fit: contain;
          opacity: 0.9;
          background: transparent;
          width: 600px;
          height: auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: 1fr 400px 1fr;
          gap: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          align-items: center;
          position: relative;
          z-index: 10;
          min-height: 500px;
        }

        .features-column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          height: 100%;
          justify-content: space-between;
        }

        .features-center {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100%;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          padding: 2rem;
          transition: all 0.3s ease;
          box-shadow: 0px -2px 40px 0px rgba(187, 155, 255, 0.15),
                      0px -2px 10px 0px rgba(233, 223, 255, 0.3),
                      inset 0px 0.5px 0px 0px rgba(255, 255, 255, 0.5);
        }

        .feature-card:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(0, 255, 255, 0.3);
          box-shadow: 0 20px 50px rgba(0, 255, 255, 0.2);
        }

        .feature-icon {
          width: 50px;
          height: 50px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(0, 102, 255, 0.2), rgba(0, 255, 255, 0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }

        .feature-card h4 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #ECECEC;
          margin-bottom: 0.75rem;
          letter-spacing: -0.5px;
          line-height: 1.3;
        }

        .feature-card p {
          font-size: 0.875rem;
          line-height: 1.5;
          color: #ECECEC;
        }

        /* Video and creator grids */
        .content-grid {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 2rem;
          padding: 0 1.5rem;
        }

        /* Video grid - always 5 columns */
        .video-grid {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1.5rem;
          padding: 0 1.5rem;
          transform: scale(0.85);
          transform-origin: center;
        }

        /* Force dark mode styling for video cards on home page */
        /* Override CSS variables used by card-base to always use dark mode values */
        .video-grid :global(.card-base) {
          background: #1c1c1e !important; /* Dark mode surface */
          border-color: #38383a !important; /* Dark mode border */
          --color-surface: #1c1c1e !important;
          --color-border: #38383a !important;
          --color-text-primary: #ffffff !important;
          --color-text-muted: #98989d !important;
          --card-bg: #1c1c1e !important;
          --border: #38383a !important;
          --foreground: #ffffff !important;
          --muted: #98989d !important;
        }

        /* Creator grid - 3 columns, 2 rows for top 6 */
        .creator-grid {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          padding: 0 1.5rem;
        }

        /* Animations */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Cursor follow effect */
        .cursor-glow {
          position: fixed;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(0, 102, 255, 0.1) 0%, transparent 70%);
          pointer-events: none;
          z-index: 5;
          transform: translate(-50%, -50%);
          transition: opacity 0.3s ease;
        }

        /* View more button */
        .view-more-container {
          text-align: center;
          margin-top: 2.5rem;
        }

        /* Responsive */
        @media (max-width: 1400px) {
          .video-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 1.25rem;
          }
        }

        @media (max-width: 1200px) {
          .video-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
          }
          
          .creator-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
          }
        }

        @media (max-width: 1000px) {
          .creator-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.25rem;
          }
        }

        @media (max-width: 900px) {
          .video-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
          
          .creator-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }

          .how-it-works {
            padding: 0 1.5rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .video-background-layer {
            display: none;
          }

          .features-column {
            order: 1;
          }

          .features-center {
            order: 2;
            display: none;
          }

          /* Hide feature icons on mobile */
          .feature-icon {
            display: none;
          }

          .feature-card {
            padding: 1.25rem;
          }

          .feature-card h4 {
            font-size: 1.25rem;
          }

          .feature-card p {
            font-size: 0.8rem;
          }
        }

        @media (max-width: 768px) {
          .hero {
            padding: 3rem 1.5rem 4rem;
            min-height: auto;
          }
          
          .section {
            padding: 4rem 1.5rem;
          }
          
          .section-header {
            margin-bottom: 2rem;
          }
          
          .view-more-container {
            margin-top: 2rem;
          }

          .content-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }

          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
            max-width: 100%;
          }

          .stat-card {
            padding: 1rem 0.5rem;
          }

          .stat-value {
            font-size: 1.25rem;
            margin-bottom: 0.25rem;
          }

          .stat-label {
            font-size: 0.7rem;
          }

          .video-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 0.75rem;
            transform: scale(1);
          }

          .creator-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          /* Ensure creator cards are fully visible on mobile */
          .creator-grid :global(.creator-card-frosted) {
            min-height: auto;
            height: auto;
            padding: 1.25rem;
          }

          .how-it-works {
            padding: 0 1.5rem;
          }

          .how-it-works-intro {
            margin-bottom: 0;
          }

          .how-it-works-intro h2 {
            margin-bottom: 0.75rem;
          }

          .how-it-works-intro p {
            font-size: 1rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
            min-height: auto;
          }

          .features-center {
            order: -1;
            margin-bottom: 1rem;
            display: none;
          }

          .feature-video {
            max-width: 100%;
          }

          .features-column {
            order: 1;
            gap: 1.25rem;
          }

          .feature-card {
            padding: 1.25rem;
          }
        }

        @media (max-width: 600px) {
          .video-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }
        }
      `}</style>

      {/* Acid animated background */}
      <div className="acid-background">
        <div className="acid-blob acid-blob-1"></div>
        <div className="acid-blob acid-blob-2"></div>
        <div className="acid-blob acid-blob-3"></div>
      </div>

      {/* Grid overlay */}
      <div className="grid-overlay"></div>

      {/* Cursor glow effect */}
      <div 
        className="cursor-glow" 
        style={{ 
          left: `${mousePosition.x}px`, 
          top: `${mousePosition.y}px` 
        }}
      ></div>

      {/* Content */}
      <div className="content-wrapper">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <div className="badge">
              The Edits Community
            </div>
            
            <h1 className="hero-title">
              The Home of Edits
            </h1>
            
            <p className="hero-subtitle">
              Experience jaw-dropping fan-made trailers, edits, and mashups from the world&apos;s most talented creators. 
              Discover cinematic masterpieces, vote for your favorites, and watch creativity come alive.
            </p>

            <div className="cta-buttons">
              <Link href="/edits" className="btn btn-primary">
                Discover Epic Edits
              </Link>
              <Link href="/communities" className="btn btn-secondary">
                Join the Movement
              </Link>
            </div>

            <div className="stats-grid">
              {stats.map((stat, index) => (
                <div key={index} className="stat-card">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Edits Section */}
        <section className="section">
          <div style={{ width: '100%' }}>
          <div className="section-header">
            <h2 className="section-title">Hall of Fame</h2>
          </div>

          <div className="filter-buttons">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeFilter('all');
              }}
              className={`filter-btn ${timeFilter === 'all' ? 'active' : ''}`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeFilter('year');
              }}
              className={`filter-btn ${timeFilter === 'year' ? 'active' : ''}`}
            >
              This Year
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTimeFilter('month');
              }}
              className={`filter-btn ${timeFilter === 'month' ? 'active' : ''}`}
            >
              This Month
            </button>
          </div>

          <div className="video-grid">
            {filteredVideos.slice(0, isMobile ? 4 : 5).map((video: any, index: number) => (
              <VideoCard key={video.id} video={video} rank={index + 1} homepageVariant={true} />
            ))}
          </div>

          <div className="view-more-container">
            <Link href="/edits" className="btn btn-secondary shine-text-bold">
              Explore More Masterpieces
            </Link>
          </div>
          </div>
        </section>

        {/* Top Creators Section */}
        <section className="section">
          <div style={{ width: '100%' }}>
          <div className="section-header">
            <h2 className="section-title">World&apos;s Best Editors</h2>
            <p className="section-subtitle">
              Meet the visionaries pushing boundaries and redefining what&apos;s possible. Your masterpiece could be next.
            </p>
          </div>

          <div className="filter-buttons">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCreatorTimeFilter('all');
              }}
              className={`filter-btn ${creatorTimeFilter === 'all' ? 'active' : ''}`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCreatorTimeFilter('year');
              }}
              className={`filter-btn ${creatorTimeFilter === 'year' ? 'active' : ''}`}
            >
              This Year
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCreatorTimeFilter('month');
              }}
              className={`filter-btn ${creatorTimeFilter === 'month' ? 'active' : ''}`}
            >
              This Month
            </button>
          </div>

          <div className="creator-grid">
            {transformedCreators.slice(0, isMobile ? 3 : 6).map((creator: any, index: number) => (
              <CreatorCard key={creator.id} creator={creator} rank={index + 1} frostedGlass={true} />
            ))}
          </div>

          <div className="view-more-container">
            <Link href="/creators" className="btn btn-primary shine-text-bold">
              Meet All Creators
            </Link>
          </div>
          </div>
        </section>

        {/* How It Works / What Are Fan Edits Section */}
        <section className="section" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="how-it-works">
            <div className="how-it-works-intro">
              <h2>What Are Fan Edits?</h2>
              <p>
                Fan edits reimagine movies, sports, and music into fresh creative expressions. From cinematic trailers to viral montages, editors turn familiar moments into new stories that move audiences.
              </p>
            </div>

            <div className="features-grid-wrapper">
              {/* Video Background Layer */}
              <div className="video-background-layer" style={{ height: `${gridHeight}px` }}>
                <video 
                  src="/4.webm"
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="feature-video"
                />
              </div>

              {/* Grid Content Layer */}
              <div className="features-grid" ref={gridRef}>
                {/* Left Column */}
                <div className="features-column">
                  <div className="feature-card">
                    <div className="feature-icon">🔍</div>
                    <h4>Discover Edits</h4>
                    <p>
                      Browse standout creations across film, sports, and music. See how fans reshape culture through creativity.
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🚀</div>
                    <h4>Share Work</h4>
                    <p>
                      Upload your edits to connect with fans and industry professionals who value originality.
                    </p>
                  </div>
                </div>

                {/* Center Column - Empty for video to show through */}
                <div className="features-center"></div>

                {/* Right Column */}
                <div className="features-column">
                  <div className="feature-card">
                    <div className="feature-icon">⭐</div>
                    <h4>Find Talent</h4>
                    <p>
                      Spot rising editors with unique style and proven reach—ideal for brands, studios, and music partners.
                    </p>
                  </div>

                  <div className="feature-card">
                    <div className="feature-icon">🏆</div>
                    <h4>Earn Recognition</h4>
                    <p>
                      Climb the rankings and get featured for your creative impact and storytelling skill.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.2), rgba(0, 102, 255, 0.2), transparent)',
          margin: '3rem auto',
          maxWidth: '1400px',
          width: 'calc(100% - 6rem)',
          borderRadius: '1px'
        }}></div>

        {/* Final CTA Section */}
        <section className="section" style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          paddingTop: '8rem',
          paddingBottom: '8rem',
          marginTop: '4rem',
          marginBottom: '4rem',
          position: 'relative'
        }}>
          {/* Subtle background pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 255, 0.05) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}></div>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
            <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
              Choose Your Path
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
              padding: '0 1.5rem',
              marginTop: '2rem'
            }}>
              {([
                {
                  title: 'For Fans',
                  description: 'Dive into a world of incredible edits. Vote, share, and support the creators making magic happen every day.',
                  link: '/edits',
                  linkText: 'Explore Now',
                  isBrand: false
                },
                {
                  title: 'For Creators',
                  description: 'Unleash your creativity. Upload your edits, build your audience, and rise through the ranks. Turn your passion into recognition.',
                  link: '/auth/signup',
                  linkText: 'Start Creating',
                  isBrand: false
                },
                {
                  title: 'For Brands',
                  description: 'Connect with top-tier creative talent. Find your next collaborator and bring groundbreaking projects to life.',
                  link: '/communities',
                  linkText: 'Partner With Us',
                  isBrand: true
                }
              ] as Array<{ title: string; description: string; link: string; linkText: string; isBrand: boolean }>).map((item, index) => (
                <div key={index} className="stat-card" style={{ animation: `fadeIn 1s ease-out ${0.2 + index * 0.1}s backwards`, padding: '2rem 1.5rem', position: 'relative', zIndex: 1 }}>
                  <h3 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700', 
                    marginBottom: '0.5rem',
                    color: '#fff'
                  }}>
                    {item.title}
                  </h3>
                  <p style={{ 
                    color: 'rgba(255, 255, 255, 0.7)', 
                    marginBottom: '1rem',
                    lineHeight: '1.5',
                    fontSize: '0.875rem'
                  }}>
                    {item.description}
                  </p>
                  {item.isBrand ? (
                    <button
                      onClick={() => setIsBrandModalOpen(true)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.875rem', padding: '0.75rem 2rem' }}
                    >
                      {item.linkText}
                    </button>
                  ) : (
                    <Link href={item.link} className="btn btn-primary" style={{ fontSize: '0.875rem', padding: '0.75rem 2rem' }}>
                      {item.linkText}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      
      <ContactBrandModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
      />
    </div>
  );
}
