'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Video } from '../types/data';
import { useModal } from '../contexts/ModalContext';
import { CreatorLink } from './CreatorLink';
import { ImpactBadge } from './ImpactBadge';

interface VideoCardProps {
  video: Video;
  rank?: number;
  homepageVariant?: boolean;
  ranked?: boolean; // Enable gold/silver/bronze styling for rankings
  hideLikes?: boolean; // Hide likes count (useful for compact layouts)
}

export function VideoCard({ video, rank, homepageVariant = false, ranked = false, hideLikes = false }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { openModal } = useModal();

  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Ensure avatar always has a valid URL
  const getAvatarUrl = () => {
    const avatar = video.creator?.avatar;
    if (avatar && avatar.trim()) {
      return avatar;
    }
    const username = video.creator?.username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=120F23&color=fff`;
  };

  const handleVideoClick = () => {
    openModal('video-preview', video);
  };

  // Determine rank class for top 3 (homepage or ranked pages)
  const rankClass = (homepageVariant || ranked) && rank ? 
    (rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '') : '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`card-base overflow-hidden relative ${rankClass}`}
    >
      <div>
        <div 
          className="relative group cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleVideoClick}
          role="button"
          tabIndex={0}
          aria-label={`Play video: ${video.title}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleVideoClick();
            }
          }}
        >
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full aspect-[3/4] object-cover transition-transform duration-200 group-hover:scale-105 rounded-t-[var(--radius-xl)]"
          />
          {/* Rank overlay (top-left) */}
          {rank && (
            <div 
              className={`absolute top-3 left-3 font-black text-base w-8 h-8 rounded-lg flex items-center justify-center shadow-2xl backdrop-blur-sm z-20 ${(homepageVariant || ranked) ? `video-rank-badge ${rankClass}` : 'bg-gradient-to-br from-purple-600 to-blue-600 text-white border-2 border-white/20'}`} 
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
                } :
                (homepageVariant || ranked) ? { 
                  background: '#000', 
                  color: '#fff', 
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  zIndex: 20
                } : undefined
              }
            >
              {rank}
            </div>
          )}
          {/* Sound indicator (top-left) */}
          {(video as any).sound && !rank && (
            <div className="absolute top-3 left-3 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
          {/* Play button overlay on hover */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
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
        <div className="p-4" onMouseEnter={() => setIsHovered(false)}>
          {(homepageVariant || ranked) && (
            <style jsx>{`
              /* Card border styling for top 3 ranks - thicker colored borders with glow */
              :global(.card-base.rank-gold) {
                border: 4px solid #ffd700 !important; /* Gold - matches badge color */
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.6) !important; /* Visible glow even without hover */
              }

              :global(.card-base.rank-gold:hover) {
                border-color: #ffed4e !important;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 20px 50px rgba(255, 215, 0, 0.4) !important;
              }

              :global(.card-base.rank-silver) {
                border: 4px solid #c0c0c0 !important; /* Silver - matches badge color */
                box-shadow: 0 0 20px rgba(192, 192, 192, 0.6) !important; /* Visible glow even without hover */
              }

              :global(.card-base.rank-silver:hover) {
                border-color: #e8e8e8 !important;
                box-shadow: 0 0 30px rgba(192, 192, 192, 0.8), 0 20px 50px rgba(192, 192, 192, 0.4) !important;
              }

              :global(.card-base.rank-bronze) {
                border: 4px solid #cd7f32 !important; /* Bronze - matches badge color */
                box-shadow: 0 0 20px rgba(205, 127, 50, 0.6) !important; /* Visible glow even without hover */
              }

              :global(.card-base.rank-bronze:hover) {
                border-color: #e6a04f !important;
                box-shadow: 0 0 30px rgba(205, 127, 50, 0.8), 0 20px 50px rgba(205, 127, 50, 0.4) !important;
              }

              /* Default black badge for ranks 4+ */
              :global(.video-rank-badge) {
                background: #000 !important;
                color: #fff !important;
                border: 2px solid rgba(255, 255, 255, 0.3) !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
                font-size: 1rem !important;
                font-weight: 900 !important;
                width: 32px !important;
                height: 32px !important;
                border-radius: 8px !important;
                backdrop-filter: blur(10px) !important;
                z-index: 20 !important;
                position: absolute !important;
              }

              /* Gold badge for rank 1 - matches creator card styling */
              :global(.video-rank-badge.rank-gold) {
                background: linear-gradient(135deg, #ffd700, #ffed4e) !important;
                color: #000000 !important; /* Black text on gold */
                border: 2px solid #ffd700 !important;
                box-shadow: 0 10px 30px rgba(255, 215, 0, 0.5) !important;
                font-weight: 900 !important;
                z-index: 20 !important;
              }

              /* Silver badge for rank 2 - matches creator card styling */
              :global(.video-rank-badge.rank-silver) {
                background: linear-gradient(135deg, #c0c0c0, #e8e8e8) !important;
                color: #000000 !important; /* Black text on silver */
                border: 2px solid #c0c0c0 !important;
                box-shadow: 0 10px 30px rgba(192, 192, 192, 0.5) !important;
                font-weight: 900 !important;
                z-index: 20 !important;
              }

              /* Bronze badge for rank 3 - matches creator card styling */
              :global(.video-rank-badge.rank-bronze) {
                background: linear-gradient(135deg, #cd7f32, #e6a04f) !important;
                color: #ffffff !important; /* White text on bronze */
                border: 2px solid #cd7f32 !important;
                box-shadow: 0 10px 30px rgba(205, 127, 50, 0.5) !important;
                font-weight: 900 !important;
                z-index: 20 !important;
              }
            `}</style>
          )}
          {homepageVariant ? (
            <>
              {/* Homepage Variant - Creator Name as Primary Focus */}
              <div className="video-card-homepage-info">
                {/* Creator Name - Primary Focus */}
                <div className="flex items-center gap-2 mb-2 creator-avatar-wrapper">
                  <img
                    src={getAvatarUrl()}
                    alt={video.creator.username}
                    className="w-8 h-8 rounded-full border-2 creator-avatar-img"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
                  />
                  <CreatorLink
                    creatorId={video.creator.id}
                    username={video.creator.username}
                    className="video-card-creator-name"
                  >
                    {video.creator.username}
                  </CreatorLink>
                  {video.creator.verified && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#3b82f6' }}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </div>
                
                {/* Impact Score - Secondary */}
                <div className="mb-2 flex items-baseline gap-2">
                  <div className="video-impact-score-value">
                    {formatNumber(video.impact || 0)}
                  </div>
                  <div className="video-impact-score-label">
                    Impact Score
                  </div>
                </div>
                
                {/* Views - Tertiary */}
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  <span className="font-medium">{formatNumber(video.views)}</span>
                  <span className="opacity-75">views</span>
                </div>
              </div>
              
              <style jsx>{`
                .video-card-homepage-info {
                  display: flex;
                  flex-direction: column;
                }

                .video-card-creator-name {
                  font-size: 1.125rem;
                  font-weight: 700;
                  color: #fff;
                  line-height: 1.2;
                }

                @media (max-width: 768px) {
                  .video-card-creator-name {
                    font-size: 0.2rem;
                  }
                }

                @media (max-width: 480px) {
                  .video-card-creator-name {
                    font-size: 0.15rem;
                  }
                }

                @media (max-width: 390px) {
                  .video-card-creator-name {
                    font-size: 0.1rem;
                  }
                }

                @media (max-width: 768px) {
                  .creator-avatar-img {
                    width: 1.25rem !important;
                    height: 1.25rem !important;
                  }
                  
                  .creator-avatar-wrapper {
                    gap: 0.375rem !important;
                  }
                }

                @media (max-width: 480px) {
                  .creator-avatar-img {
                    width: 1rem !important;
                    height: 1rem !important;
                  }
                  
                  .creator-avatar-wrapper {
                    gap: 0.25rem !important;
                  }
                }

                .video-impact-score-value,
                .video-impact-score-label {
                  font-size: 1.1rem;
                  font-weight: 700;
                  color: #c0c0c0;
                  line-height: 1.2;
                }

                @media (max-width: 768px) {
                  .video-impact-score-value,
                  .video-impact-score-label {
                    font-size: 0.65rem;
                    line-height: 1.1;
                  }
                }

                @media (max-width: 480px) {
                  .video-impact-score-value,
                  .video-impact-score-label {
                    font-size: 0.55rem;
                    line-height: 1;
                  }
                }


                /* Card border styling for top 3 ranks - thicker colored borders with glow */
                :global(.card-base.rank-gold) {
                  border: 4px solid #ffd700 !important; /* Gold - matches badge color */
                  box-shadow: 0 0 20px rgba(255, 215, 0, 0.6) !important; /* Visible glow even without hover */
                }

                :global(.card-base.rank-gold:hover) {
                  border-color: #ffed4e !important;
                  box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 20px 50px rgba(255, 215, 0, 0.4) !important;
                }

                :global(.card-base.rank-silver) {
                  border: 4px solid #c0c0c0 !important; /* Silver - matches badge color */
                  box-shadow: 0 0 20px rgba(192, 192, 192, 0.6) !important; /* Visible glow even without hover */
                }

                :global(.card-base.rank-silver:hover) {
                  border-color: #e8e8e8 !important;
                  box-shadow: 0 0 30px rgba(192, 192, 192, 0.8), 0 20px 50px rgba(192, 192, 192, 0.4) !important;
                }

                :global(.card-base.rank-bronze) {
                  border: 4px solid #cd7f32 !important; /* Bronze - matches badge color */
                  box-shadow: 0 0 20px rgba(205, 127, 50, 0.6) !important; /* Visible glow even without hover */
                }

                :global(.card-base.rank-bronze:hover) {
                  border-color: #e6a04f !important;
                  box-shadow: 0 0 30px rgba(205, 127, 50, 0.8), 0 20px 50px rgba(205, 127, 50, 0.4) !important;
                }

                /* Default black badge for ranks 4+ */
                :global(.video-rank-badge) {
                  background: #000 !important;
                  color: #fff !important;
                  border: 2px solid rgba(255, 255, 255, 0.3) !important;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
                  font-size: 1rem !important;
                  font-weight: 900 !important;
                  width: 32px !important;
                  height: 32px !important;
                  border-radius: 8px !important;
                  backdrop-filter: blur(10px) !important;
                  z-index: 20 !important;
                  position: absolute !important;
                }

                /* Gold badge for rank 1 - matches creator card styling */
                :global(.video-rank-badge.rank-gold) {
                  background: linear-gradient(135deg, #ffd700, #ffed4e) !important;
                  color: #000000 !important; /* Black text on gold */
                  border: 2px solid #ffd700 !important;
                  box-shadow: 0 10px 30px rgba(255, 215, 0, 0.5) !important;
                  font-weight: 900 !important;
                  z-index: 20 !important;
                }

                /* Silver badge for rank 2 - matches creator card styling */
                :global(.video-rank-badge.rank-silver) {
                  background: linear-gradient(135deg, #c0c0c0, #e8e8e8) !important;
                  color: #000000 !important; /* Black text on silver */
                  border: 2px solid #c0c0c0 !important;
                  box-shadow: 0 10px 30px rgba(192, 192, 192, 0.5) !important;
                  font-weight: 900 !important;
                  z-index: 20 !important;
                }

                /* Bronze badge for rank 3 - matches creator card styling */
                :global(.video-rank-badge.rank-bronze) {
                  background: linear-gradient(135deg, #cd7f32, #e6a04f) !important;
                  color: #ffffff !important; /* White text on bronze */
                  border: 2px solid #cd7f32 !important;
                  box-shadow: 0 10px 30px rgba(205, 127, 50, 0.5) !important;
                  font-weight: 900 !important;
                  z-index: 20 !important;
                }
              `}</style>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src={getAvatarUrl()}
                  alt={video.creator.username}
                  className="w-8 h-8 rounded-full border-2 border-[var(--color-border)]"
                />
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <CreatorLink
                    creatorId={video.creator.id}
                    username={video.creator.username}
                    className="text-sm font-medium truncate"
                  >
                    {video.creator.username}
                  </CreatorLink>
                  {video.creator.verified && (
                    <svg className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </div>
              </div>
              {/* Stats: Impact, Views, and Likes */}
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                <ImpactBadge impact={video.impact || 0} size="sm" showLabel={false} />
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  <span className="font-medium">{formatNumber(video.views)}</span>
                </div>
                {!hideLikes && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="font-medium">{formatNumber(video.likes)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
