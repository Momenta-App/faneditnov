'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ContestAssetLink {
  id: string;
  name: string;
  url: string;
  display_order: number;
}

interface Contest {
  id: string;
  title: string;
  description: string;
  slug?: string;
  status: 'upcoming' | 'live' | 'closed';
  profile_image_url?: string;
  cover_image_url?: string;
  submission_count?: number;
  total_prize_pool?: number;
  contest_asset_links?: ContestAssetLink[];
}

interface ContestCardProps {
  contest: Contest;
  onClick?: (contest: Contest) => void;
}

export function ContestCard({ contest, onClick }: ContestCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'upcoming':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(contest);
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
      <Link href={`/contests/${contest.slug || contest.id}`} className="block">
        {/* Cover Photo Banner */}
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-primary)]">
          {contest.cover_image_url ? (
            <img
              src={contest.cover_image_url}
              alt={`${contest.title} cover`}
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
          <div className="flex items-end mb-[var(--spacing-4)]" style={{ marginTop: '-40px' }}>
            {contest.profile_image_url ? (
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 ring-4 ring-[var(--color-surface)] shadow-lg bg-[var(--color-surface)]">
                <img
                  src={contest.profile_image_url}
                  alt={contest.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="relative w-20 h-20 rounded-2xl flex-shrink-0 ring-4 ring-[var(--color-surface)] shadow-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {contest.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {/* Status Badge */}
            <div className="ml-auto">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                  contest.status
                )}`}
              >
                {contest.status}
              </span>
            </div>
          </div>

          {/* Contest Title & Description */}
          <div className="mb-[var(--spacing-5)]">
            <h3 className="text-xl font-bold mb-2 truncate" style={{ color: 'var(--color-text-primary)' }}>
              {contest.title}
            </h3>
            {contest.description ? (
              <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {contest.description}
              </p>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted-light)' }}>
                Submit your fan edit to compete
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-[var(--spacing-3)] pt-[var(--spacing-4)] border-t border-[var(--color-border)]">
            <div className="text-center">
              <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {formatNumber(contest.submission_count || 0)}
              </div>
              <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                Submissions
              </div>
            </div>
            
            {contest.total_prize_pool && contest.total_prize_pool > 0 ? (
              <div className="text-center">
                <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-primary)' }}>
                  {formatCurrency(contest.total_prize_pool)}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                  Prize Pool
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-base font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                  —
                </div>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted-light)' }}>
                  No Prizes
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

