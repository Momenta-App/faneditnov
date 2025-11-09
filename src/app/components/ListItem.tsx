'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  rank?: number;
}

/**
 * Reusable ListItem component for consistent list item styling
 * Features:
 * - Bottom border only (no side borders)
 * - Hover effect with background color
 * - Smooth animations
 * - Consistent padding and spacing
 * - Optional ranking display with special styling for top 3
 */
export function ListItem({ children, onClick, className = '', rank }: ListItemProps) {
  const isTopThree = rank && rank <= 3;
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`border-b hover:bg-[var(--color-surface)] transition-colors ${className}`}
      style={{ borderColor: 'var(--color-border)' }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

interface RankBadgeProps {
  rank: number;
}

/**
 * Rank badge component with special styling for top 3
 */
export function RankBadge({ rank }: RankBadgeProps) {
  const isTopThree = rank <= 3;
  
  if (isTopThree) {
    const medals = {
      1: { emoji: '🥇', color: '#FFD700', label: '1st' },
      2: { emoji: '🥈', color: '#C0C0C0', label: '2nd' },
      3: { emoji: '🥉', color: '#CD7F32', label: '3rd' },
    };
    
    const medal = medals[rank as keyof typeof medals];
    
    return (
      <div className="flex items-center justify-center w-10 h-10 shrink-0">
        <span className="text-2xl">{medal.emoji}</span>
      </div>
    );
  }
  
  return (
    <div 
      className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full font-medium text-sm"
      style={{ 
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text-muted)'
      }}
    >
      {rank}
    </div>
  );
}

interface ListItemContentProps {
  children: React.ReactNode;
  withLeftPadding?: boolean;
  rank?: number;
}

/**
 * ListItem content wrapper with consistent padding
 * Use withLeftPadding for items with avatars/icons
 */
export function ListItemContent({ children, withLeftPadding = true, rank }: ListItemContentProps) {
  return (
    <div className={`flex items-center gap-5 py-4 pr-6 ${withLeftPadding ? 'pl-8' : 'pl-6'}`}>
      {rank !== undefined && <RankBadge rank={rank} />}
      {children}
    </div>
  );
}

