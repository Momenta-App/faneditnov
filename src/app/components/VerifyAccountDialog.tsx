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
  const verificationStartTimeRef = useRef<number | null>(null);
  const maxVerificationWaitTime = 3 * 60 * 1000; // 3 minutes

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
    // Always check timeout first, before making any API calls
    if (verificationStartTimeRef.current) {
      const elapsed = Date.now() - verificationStartTimeRef.current;
      if (elapsed > maxVerificationWaitTime) {
        setVerificationStatus('idle');
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
        // If status check fails, allow retry after timeout
        if (verificationStartTimeRef.current) {
          const elapsed = Date.now() - verificationStartTimeRef.current;
          if (elapsed > maxVerificationWaitTime) {
            setVerificationStatus('idle');
            setStatusMessage(null);
            setLoading(false);
            setError('Verification timed out after 3 minutes. Unable to check status. Please try again.');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            verificationStartTimeRef.current = null;
          }
        }
        return;
      }

      const data = await response.json();

      // Update verificationStartTimeRef if we have last_verification_attempt_at and don't have a start time yet
      if (data.data?.last_verification_attempt_at && !verificationStartTimeRef.current) {
        const attemptTime = new Date(data.data.last_verification_attempt_at).getTime();
        verificationStartTimeRef.current = attemptTime;
      }

      // Check for timeout using either our ref or the last_verification_attempt_at timestamp
      if (data.data?.webhook_status === 'PENDING') {
        let elapsed = 0;
        if (verificationStartTimeRef.current) {
          elapsed = Date.now() - verificationStartTimeRef.current;
        } else if (data.data?.last_verification_attempt_at) {
          const attemptTime = new Date(data.data.last_verification_attempt_at).getTime();
          elapsed = Date.now() - attemptTime;
          verificationStartTimeRef.current = attemptTime;
        }

        if (elapsed > maxVerificationWaitTime) {
          setVerificationStatus('idle');
          setStatusMessage(null);
          setLoading(false);
          setError('Verification timed out after 3 minutes. The BrightData request may have failed or is taking too long. Please try again.');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          verificationStartTimeRef.current = null;
          return;
        }
      }

      // Check if webhook completed - stop polling regardless of verification status
      if (data.data?.webhook_status === 'COMPLETED') {
        // Stop polling immediately since webhook has finished
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        verificationStartTimeRef.current = null;

        // If verification failed, show error
        if (data.data?.verification_status === 'FAILED') {
          setVerificationStatus('idle');
          setStatusMessage(null);
          setLoading(false);
          setError('Verification failed. The code was not found in your bio. Please make sure the verification code is in your profile bio and try again.');
          return;
        }
        // If still pending (shouldn't happen, but handle it), continue to check verification_status below
      }

      if (data.data?.verification_status === 'VERIFIED') {
        setVerificationStatus('idle');
        setStatusMessage(null);
        setLoading(false);
        verificationStartTimeRef.current = null;
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
        verificationStartTimeRef.current = null;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else if (data.data?.verification_status === 'PENDING' && data.data?.webhook_status === 'PENDING') {
        // Check timeout - if we've been waiting for 3 minutes, stop and allow retry
        if (verificationStartTimeRef.current) {
          const elapsed = Date.now() - verificationStartTimeRef.current;
          if (elapsed > maxVerificationWaitTime) {
            setVerificationStatus('idle');
            setStatusMessage(null);
            setLoading(false);
            setError('Verification timed out after 3 minutes. The BrightData request may have failed. Please try again.');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            verificationStartTimeRef.current = null;
            return;
          }
        }
        
        // Check if we have a snapshot_id - if not, the request may have failed
        if (!data.data?.snapshot_id) {
          // If we've been waiting for more than 30 seconds without a snapshot_id, likely failed
          if (verificationStartTimeRef.current) {
            const elapsed = Date.now() - verificationStartTimeRef.current;
            if (elapsed > 30000) {
              setVerificationStatus('idle');
              setStatusMessage(null);
              setLoading(false);
              setError('Verification request failed. No BrightData request was sent. Please try again.');
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              verificationStartTimeRef.current = null;
              return;
            }
          }
        }
        setVerificationStatus('pending');
        setStatusMessage('Verification is processing. This may take a few minutes...');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      // On error, allow retry after a delay
      if (verificationStartTimeRef.current) {
        const elapsed = Date.now() - verificationStartTimeRef.current;
        if (elapsed > 30000) {
          setVerificationStatus('idle');
          setStatusMessage(null);
          setLoading(false);
          setError('Error checking verification status. Please try again.');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          verificationStartTimeRef.current = null;
        }
      }
    }
  }, [account.id, session, onAccountVerified, onOpenChange, maxVerificationWaitTime]);

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

  // Independent timeout check - runs every 5 seconds to catch stuck states
  useEffect(() => {
    if (open && (verificationStatus === 'pending' || verificationStatus === 'verifying') && verificationStartTimeRef.current) {
      const timeoutCheck = setInterval(() => {
        if (verificationStartTimeRef.current) {
          const elapsed = Date.now() - verificationStartTimeRef.current;
          if (elapsed > maxVerificationWaitTime) {
            setVerificationStatus('idle');
            setStatusMessage(null);
            setLoading(false);
            setError('Verification timed out after 3 minutes. Please try again.');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            verificationStartTimeRef.current = null;
          }
        }
      }, 5000); // Check every 5 seconds

      return () => {
        clearInterval(timeoutCheck);
      };
    }
  }, [open, verificationStatus, maxVerificationWaitTime]);

  // Check status on mount if account has snapshot_id (resume after reload)
  useEffect(() => {
    if (open) {
      // If account is already verified, close dialog and notify
      if (account.verification_status === 'VERIFIED') {
        setTimeout(() => {
          onAccountVerified();
          onOpenChange(false);
        }, 500);
        return;
      }

      // If account verification failed, show error
      if (account.verification_status === 'FAILED') {
        setVerificationStatus('idle');
        setLoading(false);
        if (account.webhook_status === 'COMPLETED') {
          setError('Verification failed. The code was not found in your bio. Please make sure the verification code is in your profile bio and try again.');
        } else {
          setError('Verification failed. Please try again.');
        }
        return;
      }

      // If account has snapshot_id and is pending, resume polling
      if (account.snapshot_id && account.webhook_status === 'PENDING') {
        setVerificationStatus('pending');
        setStatusMessage('Verification is processing. This may take a few minutes...');
        // Don't set verificationStartTimeRef here - let checkStatus get it from the API response
        // This ensures we use the actual last_verification_attempt_at timestamp
        checkStatus();
      } 
      // If account is pending but has no snapshot_id, likely failed
      else if (account.verification_status === 'PENDING' && !account.snapshot_id) {
        setVerificationStatus('idle');
        setError('Previous verification request failed. No BrightData request was sent. Please try again.');
      }
    }
  }, [open, account.snapshot_id, account.webhook_status, account.verification_status, checkStatus, onAccountVerified, onOpenChange]);

  // Reset state when modal closes or account changes
  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setStatusMessage(null);
      setVerificationStatus('idle');
      verificationStartTimeRef.current = null;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [open]);

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

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    setVerificationStatus('verifying');
    setStatusMessage('Starting verification...');
    verificationStartTimeRef.current = Date.now();

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
        const errorMessage = errorData?.error || 'Verification request failed';
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      // Check if snapshot_id was returned - if not, the BrightData request may have failed
      if (!responseData.snapshot_id) {
        setError('Verification request failed. No BrightData request was sent. Please try again.');
        setVerificationStatus('idle');
        setStatusMessage(null);
        setLoading(false);
        verificationStartTimeRef.current = null;
        return;
      }

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
      verificationStartTimeRef.current = null;
      
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
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
      <div className="space-y-2">
        {/* Header Description */}
        <div className="text-center pb-1.5 border-b border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-primary)] leading-tight">
            Connect and verify your <span className="font-semibold">{platformName}</span> account by adding a verification code to your profile bio.
          </p>
        </div>

        {/* Steps Container */}
        <div className="space-y-2">
          {/* Step 1: Copy verification code */}
          <div className="relative">
            <div className="flex gap-2 items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-xs font-bold shadow-lg">
                  1
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-0">
                    Copy your verification code
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">
                    Copy this unique code to your clipboard
                  </p>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[var(--color-border)]/30 border border-[var(--color-border)]">
                  <code className="flex-1 text-base font-mono font-bold text-[var(--color-text-primary)] tracking-wider text-center">
                    {account.verification_code}
                  </code>
                  <Button
                    type="button"
                    variant={copied ? "primary" : "secondary"}
                    size="sm"
                    onClick={handleCopyCode}
                    className="min-w-[70px]"
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
          </div>

          {/* Step 2: Go to profile */}
          <div className="relative">
            <div className="flex gap-2 items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-xs font-bold shadow-lg">
                  2
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-0">
                    Go to your profile
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">
                    Open your {platformName} profile in a new tab to edit your bio
                  </p>
                </div>
                <div>
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
            </div>
          </div>

          {/* Step 3: Add verification code */}
          <div className="relative">
            <div className="flex gap-2 items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-xs font-bold shadow-lg">
                  3
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-0">
                    Add the verification code
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] leading-tight mb-1">
                    Paste the verification code into your profile&apos;s bio or description. You can place it anywhere in the text.
                  </p>
                </div>
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
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
          </div>

          {/* Step 4: Verify */}
          <div className="relative">
            <div className="flex gap-2 items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 text-white text-xs font-bold shadow-lg">
                  4
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-0">
                    Verify account
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">
                    Click the button below to verify that the code is in your bio
                  </p>
                </div>
                <div className="space-y-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleVerify}
                    disabled={loading || verificationStatus === 'pending'}
                    isLoading={loading || verificationStatus === 'pending'}
                    className="w-full sm:w-auto min-w-[140px]"
                  >
                    {loading || verificationStatus === 'pending'
                      ? verificationStatus === 'pending'
                        ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        )
                        : 'Verifying...'
                      : (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verify Account
                        </span>
                      )}
                  </Button>
                  {statusMessage && (
                    <div className="flex items-start gap-1 p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <svg className="w-3 h-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-yellow-800 dark:text-yellow-200 leading-tight">{statusMessage}</p>
                    </div>
                  )}
                  {error && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-1 p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <svg className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-red-800 dark:text-red-200 flex-1 leading-tight">{error}</p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleVerify}
                        disabled={loading || verificationStatus === 'pending'}
                        className="w-full sm:w-auto"
                      >
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Try Again
                        </span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-1 border-t border-[var(--color-border)]">
          <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-[var(--color-border)]/30">
            <svg className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-[var(--color-text-muted)] leading-tight">
              After verification is complete, you can remove the code from your profile. Your account will remain verified.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

