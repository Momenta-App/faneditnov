'use client';

import React from 'react';

interface ProcessingStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * ProcessingStatusBadge - Status indicator with icons for submission processing
 */
export function ProcessingStatusBadge({ status, className = '' }: ProcessingStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: string }> = {
      uploaded: {
        label: 'Uploaded',
        color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        icon: '📤',
      },
      fetching_stats: {
        label: 'Fetching Stats',
        color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        icon: '⏳',
      },
      checking_hashtags: {
        label: 'Checking Hashtags',
        color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        icon: '🔍',
      },
      checking_description: {
        label: 'Checking Description',
        color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        icon: '📝',
      },
      waiting_review: {
        label: 'Waiting for Review',
        color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        icon: '⏸️',
      },
      approved: {
        label: 'Approved',
        color: 'bg-green-500/10 text-green-500 border-green-500/20',
        icon: '✅',
      },
    };

    return (
      configs[status] || {
        label: status,
        color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        icon: '❓',
      }
    );
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color} ${className}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

