'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { VerificationProgress, VerificationStatus } from './VerificationProgress';

interface SocialAccount {
  id: string;
  platform: 'tiktok' | 'instagram' | 'youtube';
  profile_url: string;
  username?: string | null;
  verification_code: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'FAILED';
  webhook_status?: 'PENDING' | 'COMPLETED' | null;
  snapshot_id?: string | null;
}

interface UnverifiedAccountCardProps {
  account: SocialAccount;
  onAccountVerified: () => void;
  onRemove: (accountId: string) => void;
  isRemoving?: boolean;
  hasSeenVerificationBefore: boolean;
}

const platformNames: Record<SocialAccount['platform'], string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

const platformIcons: Record<SocialAccount['platform'], React.ReactElement> = {
  tiktok: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
      <path d="M16 4.5c1 .9 2.2 1.5 3.5 1.5v3.4c-1.3.1-2.7-.3-3.9-1V16a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.3a2.1 2.1 0 00-1-.2 2.2 2.2 0 102.2 2.2V4.5h3.2Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
      <path d="M21.5 7.5a2.7 2.7 0 00-1.9-1.9C17.3 5 12 5 12 5s-5.3 0-7.6.6A2.7 2.7 0 002.5 7.4 28.8 28.8 0 002 12a28.8 28.8 0 00.5 4.6 2.7 2.7 0 001.9 1.9C6.7 19 12 19 12 19s5.3 0 7.6-.6a2.7 2.7 0 001.9-1.9 28.8 28.8 0 00.5-4.6 28.8 28.8 0 00-.5-4.4zM10 15.2V8.8l5 3.2-5 3.2z" />
    </svg>
  ),
};

export function UnverifiedAccountCard({
  account,
  onAccountVerified,
  onRemove,
  isRemoving = false,
  hasSeenVerificationBefore,
}: UnverifiedAccountCardProps) {
  const { session } = useAuth();
  const [copied, setCopied] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const verificationStartTimeRef = useRef<number | null>(null);
  const maxVerificationWaitTime = 3 * 60 * 1000; // 3 minutes

  const platformName = platformNames[account.platform];

  // Check verification status
  const checkStatus = useCallback(async () => {
    if (verificationStartTimeRef.current) {
      const elapsed = Date.now() - verificationStartTimeRef.current;
      if (elapsed > maxVerificationWaitTime) {
        setVerificationStatus('failed');
        setStatusMessage(null);
        setLoading(false);
        setError('Verification timed out after 3 minutes. Please try again.');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        verificationStartTimeRef.current = null;
        return;
      }
    }

    try {
      if (!session?.access_token) {
        return;
      }

      const response = await fetch(
        `/api/settings/connected-accounts/verify/status?account_id=${account.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.data?.last_verification_attempt_at && !verificationStartTimeRef.current) {
        const attemptTime = new Date(data.data.last_verification_attempt_at).getTime();
        verificationStartTimeRef.current = attemptTime;
      }

      if (data.data?.webhook_status === 'COMPLETED') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        verificationStartTimeRef.current = null;

        if (data.data?.verification_status === 'FAILED') {
          setVerificationStatus('failed');
          setStatusMessage(null);
          setLoading(false);
          setError('Verification failed. The code was not found in your bio. Please make sure the verification code is in your profile bio and try again.');
          return;
        }
      }

      if (data.data?.verification_status === 'VERIFIED') {
        setVerificationStatus('verified');
        setStatusMessage(null);
        setLoading(false);
        verificationStartTimeRef.current = null;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setTimeout(() => {
          onAccountVerified();
        }, 500);
      } else if (data.data?.verification_status === 'FAILED') {
        setVerificationStatus('failed');
        setStatusMessage(null);
        setLoading(false);
        setError('Verification failed. Code not found in bio.');
        verificationStartTimeRef.current = null;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (data.data?.verification_status === 'PENDING' && data.data?.webhook_status === 'PENDING') {
        setVerificationStatus('checking');
        setStatusMessage('Verification is processing. This may take a few minutes...');
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, [account.id, session, onAccountVerified, maxVerificationWaitTime]);

  // Start polling when verification is in progress
  useEffect(() => {
    if (account.snapshot_id && (verificationStatus === 'checking' || verificationStatus === 'processing')) {
      checkStatus();
      pollingIntervalRef.current = setInterval(() => {
        checkStatus();
      }, 10000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [account.snapshot_id, verificationStatus, checkStatus]);

  // Check status on mount if account has snapshot_id (resume after reload)
  useEffect(() => {
    if (account.snapshot_id && account.webhook_status === 'PENDING' && account.verification_status === 'PENDING') {
      setVerificationStatus('checking');
      setStatusMessage('Verification is processing. This may take a few minutes...');
      checkStatus();
    } else if (account.verification_status === 'FAILED') {
      setVerificationStatus('failed');
      setError('Verification failed. Make sure the code is in your bio and try again.');
    }
  }, [account.snapshot_id, account.webhook_status, account.verification_status, checkStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      verificationStartTimeRef.current = null;
    };
  }, []);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(account.verification_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setError('Failed to copy code');
    }
  };

  const handleOpenProfile = () => {
    window.open(account.profile_url, '_blank', 'noopener,noreferrer');
  };

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    setVerificationStatus('starting');
    setStatusMessage('Starting verification...');
    verificationStartTimeRef.current = Date.now();

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    try {
      if (!session?.access_token) {
        throw new Error('Please sign in again');
      }

      const response = await fetch('/api/settings/connected-accounts/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          account_id: account.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || 'Verification request failed';
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      if (!responseData.snapshot_id) {
        setError('Verification request failed. No BrightData request was sent. Please try again.');
        setVerificationStatus('failed');
        setStatusMessage(null);
        setLoading(false);
        verificationStartTimeRef.current = null;
        return;
      }

      setVerificationStatus('checking');
      setStatusMessage('Verification is processing. This may take a few minutes...');
      onAccountVerified();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      setVerificationStatus('failed');
      setStatusMessage(null);
      setLoading(false);
      verificationStartTimeRef.current = null;

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  };

  const getStatusColor = () => {
    if (account.verification_status === 'FAILED') {
      return 'border-red-500/30 bg-red-500/5';
    }
    return 'border-yellow-500/30 bg-yellow-500/5';
  };

  return (
    <div className={`p-6 border-2 rounded-lg ${getStatusColor()}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-[var(--color-text-primary)]">
            {platformIcons[account.platform]}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              {platformName}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              {account.username ? `@${account.username}` : account.profile_url}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onRemove(account.id)}
          disabled={isRemoving || loading}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
        >
          {isRemoving ? 'Removing...' : 'Remove'}
        </Button>
      </div>

      {/* Step-by-Step Guide */}
      <div className="space-y-4 mb-6">
        {/* Step 1: Copy verification code */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 pt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-sm font-bold shadow-lg">
              1
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                Copy your verification code
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                Copy this unique code to your clipboard
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-border)]/30 border border-[var(--color-border)]">
              <code className="flex-1 text-lg font-mono font-bold text-[var(--color-text-primary)] tracking-wider text-center">
                {account.verification_code}
              </code>
              <Button
                type="button"
                variant={copied ? "primary" : "secondary"}
                size="sm"
                onClick={handleCopyCode}
                className="min-w-[80px]"
              >
                {copied ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Go to profile */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 pt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-sm font-bold shadow-lg">
              2
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                Go to your profile
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                Open your {platformName} profile in a new tab to edit your bio
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenProfile}
              className="w-full sm:w-auto"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open {platformName} Profile
              </span>
            </Button>
          </div>
        </div>

        {/* Step 3: Add verification code */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 pt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-sm font-bold shadow-lg">
              3
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                Add the verification code
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] leading-tight mb-2">
                Paste the verification code into your profile&apos;s bio or description. You can place it anywhere in the text.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-900 dark:text-blue-100 flex items-start gap-1">
                <svg className="w-3 h-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Tip:</strong> The code can be anywhere in your bio. Make sure to save your changes before proceeding to step 4.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Step 4: Verify */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 pt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-sm font-bold shadow-lg">
              4
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                Verify account
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                Click the button below to verify that the code is in your bio
              </p>
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleVerify}
                disabled={loading || verificationStatus === 'checking' || verificationStatus === 'processing'}
                isLoading={loading}
                className="w-full sm:w-auto min-w-[160px]"
              >
                {verificationStatus === 'checking' || verificationStatus === 'processing'
                  ? 'Verifying...'
                  : verificationStatus === 'verified'
                    ? 'Verified!'
                    : 'Verify Account'}
              </Button>
              <VerificationProgress
                status={verificationStatus}
                message={statusMessage}
              />
              {error && (
                <div className="flex items-start gap-1 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <svg className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-800 dark:text-red-200 flex-1 leading-tight">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--color-border)]/30">
          <svg className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-[var(--color-text-muted)] leading-tight">
            After verification is complete, you can remove the code from your profile. Your account will remain verified.
          </p>
        </div>
      </div>
    </div>
  );
}

