'use client';

import React from 'react';
import Link from 'next/link';
import { Sound } from '../types/data';
import { ListItem, ListItemContent } from './ListItem';

interface SoundCardProps {
  sound: Sound;
  onClick?: (sound: Sound) => void;
  rank?: number;
}

export function SoundCard({ sound, onClick, rank }: SoundCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(sound);
    }
  };

  return (
    <ListItem onClick={handleCardClick} className="cursor-pointer" rank={rank}>
      <Link href={`/sound/${sound.id}`} className="block">
        <ListItemContent rank={rank}>
          {/* Sound Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
              {sound.title}
            </h3>
            <p className="text-sm truncate mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {sound.author}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(sound.videos)}</span>
                <span className="opacity-75">videos</span>
              </span>
              {sound.likes && sound.likes > 0 && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">{formatNumber(sound.likes)}</span>
                  <span className="opacity-75">likes</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(sound.views || 0)}</span>
                <span className="opacity-75">views</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium">{formatNumber(sound.impact || 0)}</span>
                <span className="opacity-75">Impact Score</span>
              </span>
            </div>
          </div>
        </ListItemContent>
      </Link>
    </ListItem>
  );
}
