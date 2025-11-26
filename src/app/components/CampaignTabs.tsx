'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '@/lib/role-utils';

type CampaignTabId = 'campaign' | 'upload';

interface CampaignTabsProps {
  active: CampaignTabId;
}

const ALL_TABS: Array<{ id: CampaignTabId; label: string; href: string }> = [
  { id: 'campaign', label: 'Campaign', href: '/campaign' },
  { id: 'upload', label: 'Upload', href: '/upload' },
];

/**
 * Renders the primary tab switcher between the Campaign builder and Upload hub.
 * Only shows Campaign tab for admin users.
 */
export function CampaignTabs({ active }: CampaignTabsProps) {
  const { profile, isLoading } = useAuth();
  const userIsAdmin = !isLoading && profile && isAdmin(profile.role);
  
  // Filter tabs based on admin status
  const TABS = userIsAdmin 
    ? ALL_TABS 
    : ALL_TABS.filter(tab => tab.id !== 'campaign');

  return (
    <div
      className="flex w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      role="tablist"
      aria-label="Campaign navigation"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`flex-1 rounded-2xl px-4 py-2 text-center text-sm font-semibold transition-all ${
              isActive
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}


