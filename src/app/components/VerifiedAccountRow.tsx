'use client';

import React from 'react';
import { Button } from './Button';

interface SocialAccount {
  id: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  profile_url: string;
  username?: string | null;
  verification_status: 'PENDING' | 'VERIFIED' | 'FAILED';
}

interface VerifiedAccountRowProps {
  account: SocialAccount;
  onRemove: (accountId: string) => void;
  isRemoving?: boolean;
}

const platformIcons: Record<SocialAccount['platform'], React.ReactElement> = {
  tiktok: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M16 4.5c1 .9 2.2 1.5 3.5 1.5v3.4c-1.3.1-2.7-.3-3.9-1V16a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.3a2.1 2.1 0 00-1-.2 2.2 2.2 0 102.2 2.2V4.5h3.2Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M21.5 7.5a2.7 2.7 0 00-1.9-1.9C17.3 5 12 5 12 5s-5.3 0-7.6.6A2.7 2.7 0 002.5 7.4 28.8 28.8 0 002 12a28.8 28.8 0 00.5 4.6 2.7 2.7 0 001.9 1.9C6.7 19 12 19 12 19s5.3 0 7.6-.6a2.7 2.7 0 001.9-1.9 28.8 28.8 0 00.5-4.6 28.8 28.8 0 00-.5-4.4zM10 15.2V8.8l5 3.2-5 3.2z" />
    </svg>
  ),
};

const platformLabels: Record<SocialAccount['platform'], string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function VerifiedAccountRow({ account, onRemove, isRemoving = false }: VerifiedAccountRowProps) {
  const displayText = account.username ? `@${account.username}` : account.profile_url;

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-border)]/20 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 text-[var(--color-text-primary)]">
          {platformIcons[account.platform]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {displayText}
            </span>
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verified
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
            {platformLabels[account.platform]}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onRemove(account.id)}
          disabled={isRemoving}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
        >
          {isRemoving ? 'Removing...' : 'Remove'}
        </Button>
      </div>
    </div>
  );
}

