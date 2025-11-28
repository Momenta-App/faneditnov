'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Community } from '../types/data';

interface CommunityCardProps {
  community: Community;
  onClick?: (community: Community) => void;
}

export function CommunityCard({ community, onClick }: CommunityCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(community);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="card-base card-interactive cursor-pointer overflow-hidden group"
      onClick={handleCardClick}
    >
      <Link href={`/community/${community.slug}`} className="block">
        {/* Cover Photo Banner */}
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-primary)]">
          {community.cover_image_url ? (
            <img
              src={community.cover_image_url}
              alt={`${community.name} cover`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-primary)] opacity-60" />
          )}
          {/* Gradient overlay for better text contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-surface)] opacity-80" />
        </div>

        {/* Content Container with negative margin to overlap cover */}
        <div className="relative px-[var(--spacing-6)] pb-[var(--spacing-6)]">
          {/* Profile Picture - Overlapping the cover */}
          <div className="flex items-end mb-[var(--spacing-4)]" style={{ marginTop: '-70px' }}>
            {community.profile_image_url ? (
              <div className="relative w-20 rounded-2xl overflow-hidden flex-shrink-0 ring-4 ring-[var(--color-surface)] shadow-lg bg-[var(--color-surface)]" style={{ aspectRatio: '2/3' }}>
                <img
                  src={community.profile_image_url}
                  alt={community.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="relative w-20 rounded-2xl flex-shrink-0 ring-4 ring-[var(--color-surface)] shadow-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center" style={{ aspectRatio: '2/3' }}>
                <span className="text-3xl font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Brand Name & Description */}
          <div className="mb-[var(--spacing-5)]">
            <h3 className="text-xl font-bold mb-2 truncate" style={{ color: 'var(--color-text-primary)' }}>
              {community.name}
            </h3>
            {community.description ? (
              <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {community.description}
              </p>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted-light)' }}>
                Discover amazing content from this brand
              </p>
            )}
          </div>

          {/* Premium Stats Grid */}
          <div className="grid grid-cols-4 gap-[var(--spacing-3)] pt-[var(--spacing-4)] border-t border-[var(--color-border)]">
            <div className="text-center">
              <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {formatNumber(community.total_views)}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                Views
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {formatNumber(community.total_videos)}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                Videos
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {formatNumber(community.total_creators)}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                Creators
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {formatNumber(community.total_impact_score || 0)}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                Impact
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

