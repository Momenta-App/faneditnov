'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './Modal';
import { Button } from './Button';

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

interface VerifyAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: SocialAccount;
  onAccountVerified: () => void;
}

const platformNames: Record<SocialAccount['platform'], string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function VerifyAccountDialog({
  open,
  onOpenChange,
  account,
  onAccountVerified,
}: VerifyAccountDialogProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'pending' | 'verifying'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const platformName = platformNames[account.platform];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(account.verification_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setError('Failed to copy code');
    }
  };

  // Check verification status
  const checkStatus = useCallback(async () => {
    try {
      if (!session?.access_token) {
        return;
      }

      const headers: HeadersInit = {};
      if (session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `/api/settings/connected-accounts/verify/status?account_id=${account.id}`,
        {
          headers,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.data?.verification_status === 'VERIFIED') {
        setVerificationStatus('idle');
        setStatusMessage(null);
        setLoading(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Small delay to allow status message to show before closing
        setTimeout(() => {
          onAccountVerified();
          onOpenChange(false);
        }, 500);
      } else if (data.data?.verification_status === 'FAILED') {
        setVerificationStatus('idle');
        setStatusMessage(null);
        setLoading(false);
        setError('Verification failed. Code not found in bio.');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (data.data?.verification_status === 'PENDING' && data.data?.webhook_status === 'PENDING') {
        setVerificationStatus('pending');
        setStatusMessage('Verification is processing. This may take a few minutes...');
      } else if (data.data?.verification_status === 'PENDING' && data.data?.webhook_status === 'COMPLETED') {
        // Webhook completed but verification failed
        setVerificationStatus('idle');
        setStatusMessage(null);
        setLoading(false);
        setError('Verification failed. Code not found in bio.');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, [account.id, session, onAccountVerified, onOpenChange]);

  // Start polling when verification is in progress
  useEffect(() => {
    if (open && account.snapshot_id && (verificationStatus === 'pending' || verificationStatus === 'verifying')) {
      // Check immediately
      checkStatus();

      // Then poll every 10 seconds (BrightData can take 5+ minutes)
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
  }, [open, account.snapshot_id, verificationStatus, checkStatus]);

  // Check status on mount if account has snapshot_id (resume after reload)
  useEffect(() => {
    if (open && account.snapshot_id && account.webhook_status === 'PENDING') {
      setVerificationStatus('pending');
      checkStatus();
    }
  }, [open, account.snapshot_id, account.webhook_status, checkStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    setVerificationStatus('verifying');
    setStatusMessage('Starting verification...');

    try {
      if (!session?.access_token) {
        throw new Error('Please sign in again');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/settings/connected-accounts/verify', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          account_id: account.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Verification failed');
      }

      const responseData = await response.json();

      // Verification is pending, start polling
      setVerificationStatus('pending');
      setStatusMessage('Verification is processing. This may take a few minutes...');
      // Polling will be handled by useEffect
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      setVerificationStatus('idle');
      setStatusMessage(null);
      setLoading(false);
    }
  };

  const handleOpenProfile = () => {
    window.open(account.profile_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal 
      isOpen={open} 
      onClose={() => onOpenChange(false)} 
      title={`Verify ${platformName} Account`}
      maxWidth="2xl"
    >
      <div className="space-y-8">
        {/* Header Description */}
        <div className="text-center pb-4 border-b border-[var(--color-border)]">
          <p className="text-base text-[var(--color-text-primary)] leading-relaxed">
            Connect and verify your <span className="font-semibold">{platformName}</span> account by adding a verification code to your profile bio.
          </p>
        </div>

        {/* Steps Container */}
        <div className="space-y-6">
          {/* Step 1: Copy verification code */}
          <div className="relative">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-lg font-bold shadow-lg">
                  1
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                    Copy your verification code
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Copy this unique code to your clipboard
                  </p>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--color-border)]/30 border border-[var(--color-border)]">
                  <code className="flex-1 text-2xl font-mono font-bold text-[var(--color-text-primary)] tracking-wider text-center">
                    {account.verification_code}
                  </code>
                  <Button
                    type="button"
                    variant={copied ? "primary" : "secondary"}
                    size="md"
                    onClick={handleCopyCode}
                    className="min-w-[100px]"
                  >
                    {copied ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Connector Line */}
          <div className="ml-6 w-0.5 h-6 bg-gradient-to-b from-[var(--color-primary)]/30 to-transparent"></div>

          {/* Step 2: Go to profile */}
          <div className="relative">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-lg font-bold shadow-lg">
                  2
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                    Go to your profile
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Open your {platformName} profile in a new tab to edit your bio
                  </p>
                </div>
                <div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="md" 
                    onClick={handleOpenProfile}
                    className="w-full sm:w-auto"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open {platformName} Profile
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Connector Line */}
          <div className="ml-6 w-0.5 h-6 bg-gradient-to-b from-[var(--color-primary)]/30 to-transparent"></div>

          {/* Step 3: Add verification code */}
          <div className="relative">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-lg font-bold shadow-lg">
                  3
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                    Add the verification code
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Paste the verification code into your profile&apos;s bio or description. You can place it anywhere in the text.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100 flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      <strong>Tip:</strong> The code can be anywhere in your bio. Make sure to save your changes before proceeding to step 4.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connector Line */}
          <div className="ml-6 w-0.5 h-6 bg-gradient-to-b from-[var(--color-primary)]/30 to-transparent"></div>

          {/* Step 4: Verify */}
          <div className="relative">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-lg font-bold shadow-lg">
                  4
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                    Verify account
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Click the button below to verify that the code is in your bio
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleVerify}
                    disabled={loading || verificationStatus === 'pending'}
                    isLoading={loading || verificationStatus === 'pending'}
                    className="w-full sm:w-auto min-w-[200px]"
                  >
                    {loading || verificationStatus === 'pending'
                      ? verificationStatus === 'pending'
                        ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        )
                        : 'Verifying...'
                      : (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verify Account
                        </span>
                      )}
                  </Button>
                  {statusMessage && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">{statusMessage}</p>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--color-border)]/30">
            <svg className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              After verification is complete, you can remove the code from your profile. Your account will remain verified.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

