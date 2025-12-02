'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './Card';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { UnverifiedAccountCard } from './UnverifiedAccountCard';
import { VerifiedAccountRow } from './VerifiedAccountRow';
import { VerifyAccountDialog } from './VerifyAccountDialog';
import { parseProfileUrl } from '@/lib/social-account-helpers';

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

const STORAGE_KEY = 'social_account_verification_intro_seen';

export function ConnectedAccountsSection() {
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(null);
  const [newAccountPlatform, setNewAccountPlatform] = useState<'tiktok' | 'instagram' | 'youtube' | null>(null);
  const [newAccountUrl, setNewAccountUrl] = useState('');
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasSeenVerificationBefore, setHasSeenVerificationBefore] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem(STORAGE_KEY) === 'true';
      setHasSeenVerificationBefore(seen);
    }
  }, []);

  const fetchAccounts = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const response = await fetch('/api/settings/connected-accounts', {
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      setAccounts(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [session?.access_token]);

  // Initial fetch
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Poll verification status for pending accounts
  useEffect(() => {
    const hasPending = accounts.some(
      (acc) => acc.verification_status === 'PENDING' && acc.webhook_status === 'PENDING'
    );
    
    if (!hasPending) {
      return;
    }

    // BrightData can take 5+ minutes, so poll every 15 seconds
    const interval = setInterval(() => {
      fetchAccounts(true); // Silent refresh to avoid scroll jumps
    }, 15000);
    
    return () => clearInterval(interval);
  }, [accounts, fetchAccounts]);

  const handleUrlChange = (url: string) => {
    setNewAccountUrl(url);
    setPlatformError(null);
    
    // Only detect platform if URL is not empty
    if (!url.trim()) {
      setNewAccountPlatform(null);
      setNewAccountUsername('');
      return;
    }

    // Try to detect platform from URL
    const { platform, username } = parseProfileUrl(url);
    
    if (platform) {
      // Valid platform detected
      setNewAccountPlatform(platform);
      if (username && !newAccountUsername) {
        // Auto-populate username if detected and field is empty
        setNewAccountUsername(username);
      }
      setPlatformError(null);
    } else {
      // Check if it looks like a URL but not a supported platform
      try {
        // Try to parse as URL to see if it's a valid URL format
        let urlToCheck = url.trim();
        if (!urlToCheck.startsWith('http://') && !urlToCheck.startsWith('https://')) {
          urlToCheck = `https://${urlToCheck}`;
        }
        const urlObj = new URL(urlToCheck);
        // If it's a valid URL but not a supported platform
        setPlatformError('This platform is not accepted. We only accept TikTok, YouTube and Instagram.');
        setNewAccountPlatform(null);
      } catch {
        // Not a valid URL yet, don't show error (user might still be typing)
        setPlatformError(null);
        setNewAccountPlatform(null);
      }
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountPlatform || !newAccountUrl) {
      setError('Please enter a profile URL');
      return;
    }
    
    if (platformError) {
      setError(platformError);
      return;
    }

    try {
      setAddingAccount(true);
      setError(null);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const response = await fetch('/api/settings/connected-accounts', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          platform: newAccountPlatform,
          profile_url: newAccountUrl,
          username: newAccountUsername || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add account');
      }

      const data = await response.json();
      const newAccount = data.data;
      setAccounts([...accounts, newAccount]);
      setNewAccountPlatform(null);
      setNewAccountUrl('');
      setNewAccountUsername('');
      setPlatformError(null);
      
      // Show popup only on first time
      if (!hasSeenVerificationBefore) {
        setSelectedAccount(newAccount);
        setVerifyDialogOpen(true);
        // Mark as seen
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, 'true');
          setHasSeenVerificationBefore(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setAddingAccount(false);
    }
  };

  const handleAccountVerified = useCallback(() => {
    fetchAccounts(true); // Silent refresh to avoid scroll jumps
  }, [fetchAccounts]);

  const handleRemoveAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this account? This will disconnect it from your profile.')) {
      return;
    }

    setDeletingId(accountId);

    try {
      setError(null);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/settings/connected-accounts?id=${accountId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove account');
      }

      // Remove from local state
      setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove account');
    } finally {
      setDeletingId(null);
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'tiktok':
        return 'TikTok';
      case 'instagram':
        return 'Instagram';
      case 'youtube':
        return 'YouTube';
      default:
        return platform;
    }
  };

  // Split accounts into verified and unverified
  const verifiedAccounts = accounts.filter((acc) => acc.verification_status === 'VERIFIED');
  const unverifiedAccounts = accounts.filter((acc) => acc.verification_status !== 'VERIFIED');

  // Loading state
  if (loading) {
    return (
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
              Connect Social Accounts
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Connect and verify your social media accounts to submit to contests
            </p>
          </div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
            Connect Social Accounts
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Connect and verify your social media accounts to submit to contests. Follow the step-by-step guide to verify each account.
          </p>
        </div>

        {error && (
          <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Add Account Form */}
        <div className="p-4 border border-[var(--color-border)] rounded-lg">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Add New Account
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
                Profile URL
              </label>
              <input
                type="url"
                value={newAccountUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.tiktok.com/@username"
                className={`w-full px-3 py-2 rounded-lg border ${
                  platformError 
                    ? 'border-red-500' 
                    : 'border-[var(--color-border)]'
                } bg-[var(--color-surface)] text-[var(--color-text-primary)]`}
              />
              {platformError && (
                <p className="mt-1 text-xs text-red-500">{platformError}</p>
              )}
              {newAccountUrl && newAccountPlatform && !platformError && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Platform detected: <span className="font-medium text-[var(--color-text-primary)]">{getPlatformLabel(newAccountPlatform)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
                Username (optional)
              </label>
              <input
                type="text"
                value={newAccountUsername}
                onChange={(e) => setNewAccountUsername(e.target.value)}
                placeholder="@username"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddAccount}
              disabled={addingAccount || !newAccountPlatform || !newAccountUrl || !!platformError}
            >
              {addingAccount ? 'Adding...' : 'Add Account'}
            </Button>
          </div>
        </div>

        {/* Unverified Accounts Section */}
        {unverifiedAccounts.length > 0 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                Accounts Pending Verification
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Follow the steps below to verify each account. Verification ensures you own the account.
              </p>
            </div>
            <div className="space-y-4">
              {unverifiedAccounts.map((account) => (
                <UnverifiedAccountCard
                  key={account.id}
                  account={account}
                  onAccountVerified={handleAccountVerified}
                  onRemove={handleRemoveAccount}
                  isRemoving={deletingId === account.id}
                  hasSeenVerificationBefore={hasSeenVerificationBefore}
                />
              ))}
            </div>
          </div>
        )}

        {/* Verified Accounts Section */}
        {verifiedAccounts.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                Verified Accounts
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {verifiedAccounts.length} verified account{verifiedAccounts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
              {verifiedAccounts.map((account) => (
                <VerifiedAccountRow
                  key={account.id}
                  account={account}
                  onRemove={handleRemoveAccount}
                  isRemoving={deletingId === account.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {accounts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--color-text-muted)] mb-2">
              No connected accounts yet.
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Add an account above to get started.
            </p>
          </div>
        )}
      </div>

      {/* Verify Account Dialog - Only shown on first time */}
      {selectedAccount && (
        <VerifyAccountDialog
          open={verifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          account={selectedAccount}
          onAccountVerified={handleAccountVerified}
        />
      )}
    </Card>
  );
}

