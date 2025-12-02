'use client';

import React from 'react';

export type VerificationStatus = 'idle' | 'starting' | 'processing' | 'checking' | 'verified' | 'failed';

interface VerificationProgressProps {
  status: VerificationStatus;
  message?: string | null;
  className?: string;
}

export function VerificationProgress({ status, message, className = '' }: VerificationProgressProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          color: 'text-[var(--color-text-muted)]',
          bgColor: 'bg-[var(--color-border)]/30',
          icon: null,
        };
      case 'starting':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          icon: (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ),
        };
      case 'processing':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          icon: (
            <svg className="animate-pulse h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'checking':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          icon: (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ),
        };
      case 'verified':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'failed':
        return {
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      default:
        return {
          color: 'text-[var(--color-text-muted)]',
          bgColor: 'bg-[var(--color-border)]/30',
          icon: null,
        };
    }
  };

  const config = getStatusConfig();
  const defaultMessages: Record<VerificationStatus, string> = {
    idle: 'Ready to verify',
    starting: 'Starting verification...',
    processing: 'Checking your profile...',
    checking: 'Verifying code...',
    verified: 'Account verified!',
    failed: 'Verification failed',
  };

  const displayMessage = message || defaultMessages[status];

  if (status === 'idle') {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgColor} ${config.color} ${className}`}>
      {config.icon && <span className="flex-shrink-0">{config.icon}</span>}
      <span className="text-sm font-medium">{displayMessage}</span>
    </div>
  );
}

