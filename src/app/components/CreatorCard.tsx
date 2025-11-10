'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Creator } from '../types/data';
import { CreatorLink } from './CreatorLink';
import { ListItem, ListItemContent } from './ListItem';

interface CreatorCardProps {
  creator: Creator;
  variant?: 'grid' | 'list';
  hideFollowers?: boolean;
  rank?: number;
  frostedGlass?: boolean;
}

export function CreatorCard({ creator, variant = 'grid', hideFollowers = false, rank, frostedGlass = false }: CreatorCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Use regular img for ui-avatars.com to avoid Next.js Image optimization issues
  const isUIAvatar = creator.avatar?.includes('ui-avatars.com');
  
  const AvatarImage = ({ width, height, className }: { width: number; height: number; className?: string }) => {
    if (isUIAvatar) {
      return (
        <img 
          src={creator.avatar} 
          alt={creator.displayName}
          width={width}
          height={height}
          className={className}
          style={{ borderRadius: '50%', objectFit: 'cover' }}
        />
      );
    }
    return (
      <Image 
        src={creator.avatar} 
        alt={creator.displayName}
        width={width}
        height={height}
        className={className}
      />
    );
  };

  if (frostedGlass) {
    // Determine rank class for top 3
    const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '';
    
    return (
      <Link href={`/creator/${creator.id}`} className="block">
        <div className={`creator-card-frosted ${rankClass}`}>
          {rank && (
            <div className={`rank-badge-creator ${rankClass}`}>
              {rank}
            </div>
          )}
          <div className="creator-card-content">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 relative">
                <AvatarImage 
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
                {creator.verified && (
                  <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0 ml-4">
              {/* Creator Name - Primary Focus */}
              <h3 className="text-lg font-bold truncate mb-2" style={{ color: '#fff' }}>
                {creator.displayName}
              </h3>
              
              {/* Impact Score - Secondary */}
              <div className="mb-2 flex items-baseline gap-2">
                <div className="impact-score-value">
                  {formatNumber(creator.impact)}
                </div>
                <div className="impact-score-label">
                  Impact Score
                </div>
              </div>
              
              {/* Followers and Views - Tertiary */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {!hideFollowers && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <span className="font-medium">{formatNumber(creator.followers)}</span>
                    <span className="opacity-75">followers</span>
                  </span>
                )}
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span className="font-medium">{formatNumber(creator.views)}</span>
                  <span className="opacity-75">views</span>
                </span>
              </div>
            </div>
          </div>

          <style jsx>{`
            .creator-card-frosted {
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              padding: 1.5rem;
              backdrop-filter: blur(20px);
              transition: all 0.3s ease;
              position: relative;
              display: flex;
              flex-direction: column;
              height: 160px;
              width: 100%;
            }

            @media (max-width: 768px) {
              .creator-card-frosted {
                height: auto;
                min-height: 140px;
                padding: 1.25rem;
              }
            }

            .creator-card-frosted:hover {
              transform: translateY(-5px);
              background: rgba(255, 255, 255, 0.05);
              border-color: rgba(0, 255, 255, 0.3);
              box-shadow: 0 20px 50px rgba(0, 255, 255, 0.2);
            }

            /* Gold styling for rank 1 */
            .creator-card-frosted.rank-gold {
              background: rgba(255, 215, 0, 0.08);
              border: 1px solid rgba(255, 215, 0, 0.4);
            }

            .creator-card-frosted.rank-gold:hover {
              background: rgba(255, 215, 0, 0.12);
              border-color: rgba(255, 215, 0, 0.6);
              box-shadow: 0 20px 50px rgba(255, 215, 0, 0.3);
            }

            /* Silver styling for rank 2 */
            .creator-card-frosted.rank-silver {
              background: rgba(192, 192, 192, 0.08);
              border: 1px solid rgba(192, 192, 192, 0.4);
            }

            .creator-card-frosted.rank-silver:hover {
              background: rgba(192, 192, 192, 0.12);
              border-color: rgba(192, 192, 192, 0.6);
              box-shadow: 0 20px 50px rgba(192, 192, 192, 0.3);
            }

            /* Bronze styling for rank 3 */
            .creator-card-frosted.rank-bronze {
              background: rgba(205, 127, 50, 0.08);
              border: 1px solid rgba(205, 127, 50, 0.4);
            }

            .creator-card-frosted.rank-bronze:hover {
              background: rgba(205, 127, 50, 0.12);
              border-color: rgba(205, 127, 50, 0.6);
              box-shadow: 0 20px 50px rgba(205, 127, 50, 0.3);
            }

            .rank-badge-creator {
              position: absolute;
              top: 0.75rem;
              right: 0.75rem;
              width: 32px;
              height: 32px;
              border-radius: 8px;
              font-weight: 900;
              font-size: 1rem;
              display: flex;
              align-items: center;
              justify-content: center;
              backdrop-filter: blur(10px);
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
              z-index: 10;
              background: #000;
              color: #fff;
              border: 2px solid rgba(255, 255, 255, 0.3);
            }

            /* Gold badge for rank 1 */
            .rank-badge-creator.rank-gold {
              background: linear-gradient(135deg, #ffd700, #ffed4e);
              color: #000;
              border: 2px solid #ffd700;
              box-shadow: 0 10px 30px rgba(255, 215, 0, 0.5);
            }

            /* Silver badge for rank 2 */
            .rank-badge-creator.rank-silver {
              background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
              color: #000;
              border: 2px solid #c0c0c0;
              box-shadow: 0 10px 30px rgba(192, 192, 192, 0.5);
            }

            /* Bronze badge for rank 3 */
            .rank-badge-creator.rank-bronze {
              background: linear-gradient(135deg, #cd7f32, #e6a04f);
              color: #fff;
              border: 2px solid #cd7f32;
              box-shadow: 0 10px 30px rgba(205, 127, 50, 0.5);
            }

            .creator-card-content {
              display: flex;
              flex-direction: row;
              align-items: center;
              flex: 1;
            }

            .impact-score-value,
            .impact-score-label {
              font-size: 1.1rem;
              font-weight: 700;
              color: #c0c0c0;
              line-height: 1.2;
            }
          `}</style>
        </div>
      </Link>
    );
  }

  // Grid variant for community page - needs fixed height and structured layout
  if (variant === 'grid') {
    return (
      <Link href={`/creator/${creator.id}`} className="block h-full">
        <div className="border rounded-lg hover:bg-[var(--color-surface)] transition-colors p-4 h-full flex flex-col" style={{ borderColor: 'var(--color-border)', height: '140px' }}>
          <div className="flex items-start gap-4 flex-1">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 relative">
                <AvatarImage 
                  width={56}
                  height={56}
                  className="rounded-full object-cover"
                />
                {creator.verified && (
                  <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-0.5">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col">
              <h3 className="text-sm font-medium truncate mb-2" style={{ color: 'var(--color-text-primary)' }}>
                <CreatorLink
                  creator={creator}
                  className="hover:text-[var(--color-primary)] transition-colors"
                  noLink={true}
                >
                  {creator.displayName}
                </CreatorLink>
              </h3>
              
              {/* First line: videos and views */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
                {!hideFollowers && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium">{formatNumber(creator.followers)}</span>
                    <span className="opacity-75">followers</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="font-medium">{formatNumber(creator.videos)}</span>
                  <span className="opacity-75">videos</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">{formatNumber(creator.views)}</span>
                  <span className="opacity-75">views</span>
                </span>
              </div>
              
              {/* Second line: Impact Score (always on its own line) */}
              <div className="flex items-center gap-1 text-sm mt-auto" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-medium">{formatNumber(creator.impact)}</span>
                <span className="opacity-75">Impact Score</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // List variant (original implementation)
  return (
    <ListItem rank={rank}>
      <Link href={`/creator/${creator.id}`} className="block">
        <ListItemContent rank={rank}>
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 relative">
              <AvatarImage 
                width={56}
                height={56}
                className="rounded-full object-cover"
              />
              {creator.verified && (
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
              <CreatorLink
                creator={creator}
                className="hover:text-[var(--color-primary)] transition-colors"
                noLink={true}
              >
                {creator.displayName}
              </CreatorLink>
            </h3>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {!hideFollowers && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">{formatNumber(creator.followers)}</span>
                  <span className="opacity-75">followers</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(creator.videos)}</span>
                <span className="opacity-75">videos</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(creator.views)}</span>
                <span className="opacity-75">views</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(creator.impact)}</span>
                <span className="opacity-75">Impact Score</span>
              </span>
            </div>
          </div>
        </ListItemContent>
      </Link>
    </ListItem>
  );
}
