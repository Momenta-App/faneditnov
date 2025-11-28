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
  status: 'upcoming' | 'live' | 'ended' | 'draft';
  start_date?: string;
  end_date?: string;
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return null;
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return `${start} - ${end}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40';
      case 'upcoming':
        return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40';
      case 'ended':
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40';
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40';
      default:
        return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40';
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
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-primary)]">
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
          <div className="flex items-end mb-[var(--spacing-4)]" style={{ marginTop: '-60px' }}>
            {contest.profile_image_url ? (
              <div className="relative w-20 rounded-2xl overflow-hidden flex-shrink-0 ring-4 ring-[var(--color-surface)] shadow-lg bg-[var(--color-surface)]" style={{ aspectRatio: '2/3' }}>
                <img
                  src={contest.profile_image_url}
                  alt={contest.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="relative w-20 rounded-2xl flex-shrink-0 ring-4 ring-[var(--color-surface)] shadow-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center" style={{ aspectRatio: '2/3' }}>
                <span className="text-3xl font-bold text-white">
                  {contest.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {/* Status Badge */}
            <div className="ml-auto">
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border backdrop-blur-sm ${getStatusColor(
                  contest.status
                )}`}
              >
                {contest.status}
              </span>
            </div>
          </div>

          {/* Contest Title & Dates */}
          <div className="mb-[var(--spacing-5)]">
            <h3 className="text-xl font-bold mb-2 truncate" style={{ color: 'var(--color-text-primary)' }}>
              {contest.title}
            </h3>
            {contest.start_date && contest.end_date && (
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                📅 {formatDateRange(contest.start_date, contest.end_date)}
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

