'use client';

import React from 'react';
import Link from 'next/link';
import { Hashtag } from '../types/data';
import { ListItem, ListItemContent } from './ListItem';

interface HashtagCardProps {
  hashtag: Hashtag;
  onClick?: (hashtag: Hashtag) => void;
  rank?: number;
}

export function HashtagCard({ hashtag, onClick, rank }: HashtagCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(hashtag);
    }
  };

  return (
    <ListItem onClick={handleCardClick} className="cursor-pointer" rank={rank}>
      <Link href={`/hashtag/${encodeURIComponent(hashtag.name)}`} className="block">
        <ListItemContent rank={rank}>
          {/* Hashtag Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                #{hashtag.name}
              </h3>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(hashtag.videos)}</span>
                <span className="opacity-75">videos</span>
              </span>
              {hashtag.creators && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">{formatNumber(hashtag.creators)}</span>
                  <span className="opacity-75">creators</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(hashtag.views)}</span>
                <span className="opacity-75">views</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(hashtag.impact || 0)}</span>
                <span className="opacity-75">Impact Score</span>
              </span>
            </div>
          </div>
        </ListItemContent>
      </Link>
    </ListItem>
  );
}
