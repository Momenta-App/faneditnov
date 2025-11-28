'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useCampaigns } from '../hooks/useData';
import { Card } from '../components/Card';
import { Page, PageSection, Stack } from '../components/layout';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '../components/Tabs';
import { getRoleDisplayName, getRoleDescription } from '@/lib/role-utils';
import { ContestVideoPlayer } from '../components/ContestVideoPlayer';
import { MP4VideoModal } from '../components/MP4VideoModal';
import { VideoModal } from '../components/VideoModal';
import { getContestVideoUrl } from '@/lib/storage-utils';
import { authFetch } from '@/lib/auth-fetch';
import { detectPlatform } from '@/lib/url-utils';
import type { Platform } from '@/lib/url-utils';
import { Video } from '../types/data';

// Helper function to format numbers with abbreviations
const formatNumber = (num: number | null | undefined): string => {
  if (!num && num !== 0) return '0';
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'contests' ? 1 : 0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  // Sync with URL param
  useEffect(() => {
    if (tabParam === 'contests') {
      setActiveTab(1);
    } else {
      setActiveTab(0);
    }
  }, [tabParam]);

  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
    // Update URL without causing a full page reload
    if (tabIndex === 1) {
      router.replace('/settings?tab=contests', { scroll: false });
    } else {
      router.replace('/settings', { scroll: false });
    }
  };

  // Show nothing while loading or redirecting
  if (isLoading || !user) {
    return null;
  }

  return (
    <Page>
      {/* Header */}
      <PageSection variant="header">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">Settings</h1>
          <p className="text-[var(--color-text-muted)]">
            View your account information and role
          </p>
        </div>
      </PageSection>

      {/* Main Content */}
      <PageSection variant="content">
        <div className="max-w-3xl mx-auto">
          <Tabs>
            <TabList>
              <Tab isActive={activeTab === 0} onClick={() => handleTabChange(0)}>
                Profile
              </Tab>
              <Tab isActive={activeTab === 1} onClick={() => handleTabChange(1)}>
                Contests
              </Tab>
            </TabList>
            <TabPanels className="mt-6">
              <TabPanel className={activeTab === 0 ? 'block' : 'hidden'}>
                <ProfileSection />
                <div id="connected-accounts-section">
                  <ConnectedAccountsSection />
                </div>
                <SavedCampaignsSection />
              </TabPanel>
              <TabPanel className={activeTab === 1 ? 'block' : 'hidden'}>
                <ContestsSection 
                  onNavigateToOwnership={() => {
                    setActiveTab(0);
                    router.replace('/settings', { scroll: false });
                    setTimeout(() => {
                      const element = document.getElementById('connected-accounts-section');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </PageSection>
    </Page>
  );
}

function SavedCampaignsSection() {
  const router = useRouter();
  const { data: campaigns, loading } = useCampaigns();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
            Saved Campaigns
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Your generated campaigns
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign: any) => {
              // Extract name from AI payload if available
              const aiPayload = campaign.ai_payload;
              const displayName = aiPayload
                ? `${aiPayload.sport} - ${aiPayload.league}`
                : campaign.name;

              return (
                <div
                  key={campaign.id}
                  className="p-4 rounded-lg border flex items-center justify-between"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div>
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      {displayName}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Created {formatDate(campaign.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/campaigns/${campaign.id}`)}
                  >
                    View Campaign
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No saved campaigns yet. Create one from the Campaign page.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProfileSection() {
  const { user, profile, refreshSession } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
              Account Information
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your account details
            </p>
          </div>

          <div className="space-y-5">
            {/* Email */}
            <div className="pb-5 border-b border-[var(--color-border)]">
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[var(--color-text-primary)] font-medium">
                  {profile.email}
                </span>
                {profile.email_verified ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs font-medium rounded-full border border-[var(--color-success)]/20">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] text-xs font-medium rounded-full border border-[var(--color-border)]">
                    Unverified
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      </Card>

      {/* Account Role - Simplified for simple auth */}
      <Card>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
                Account Role
              </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your current role: {getRoleDisplayName(profile.role)}
            </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Role'}
            </Button>
          </div>
          <div className={`p-5 rounded-[var(--radius-lg)] border-2 bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-sm)]`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
                {getRoleDisplayName(profile.role).charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-[var(--color-primary)]">
                    {getRoleDisplayName(profile.role)}
                  </span>
                  <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                    Current
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {getRoleDescription(profile.role)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ConnectedAccountsSection() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [newAccountPlatform, setNewAccountPlatform] = useState<'tiktok' | 'instagram' | 'youtube' | null>(null);
  const [newAccountUrl, setNewAccountUrl] = useState('');
  const [newAccountUsername, setNewAccountUsername] = useState('');

  useEffect(() => {
    fetchAccounts();
    // Poll verification status for pending accounts
    const interval = setInterval(() => {
      const hasPending = accounts.some(
        (acc) => acc.verification_status === 'PENDING' && acc.webhook_status === 'PENDING'
      );
      if (hasPending) {
        fetchAccounts();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [accounts.length]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/connected-accounts');
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      setAccounts(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountPlatform || !newAccountUrl) {
      setError('Please select a platform and enter a profile URL');
      return;
    }

    try {
      setAddingAccount(true);
      setError(null);
      const response = await fetch('/api/settings/connected-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setAccounts([...accounts, data.data]);
      setNewAccountPlatform(null);
      setNewAccountUrl('');
      setNewAccountUsername('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setAddingAccount(false);
    }
  };

  const handleVerify = async (accountId: string) => {
    try {
      setVerifyingId(accountId);
      setError(null);
      const response = await fetch('/api/settings/connected-accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start verification');
      }

      const data = await response.json();
      // Update account with verification code
      setAccounts(
        accounts.map((acc) =>
          acc.id === accountId
            ? { ...acc, verification_code: data.verification_code, webhook_status: 'PENDING' }
            : acc
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify account');
    } finally {
      setVerifyingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'FAILED':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
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

  if (loading) {
    return (
      <Card>
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
            Connected Social Accounts
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Connect and verify your social media accounts to submit to contests
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
                Platform
              </label>
              <select
                value={newAccountPlatform || ''}
                onChange={(e) => setNewAccountPlatform(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              >
                <option value="">Select platform</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
                Profile URL
              </label>
              <input
                type="url"
                value={newAccountUrl}
                onChange={(e) => setNewAccountUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@username"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
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
              disabled={addingAccount || !newAccountPlatform || !newAccountUrl}
            >
              {addingAccount ? 'Adding...' : 'Add Account'}
            </Button>
          </div>
        </div>

        {/* Accounts List */}
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--color-text-muted)]">
              No connected accounts yet. Add one above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="p-4 border border-[var(--color-border)] rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {getPlatformLabel(account.platform)}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                          account.verification_status
                        )}`}
                      >
                        {account.verification_status}
                      </span>
                    </div>
                    <a
                      href={account.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-primary)] hover:underline"
                    >
                      {account.profile_url}
                    </a>
                    {account.username && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        @{account.username}
                      </p>
                    )}
                  </div>
                </div>

                {/* Verification Code Display */}
                {account.verification_status === 'PENDING' && account.verification_code && (
                  <div className="mb-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <p className="text-sm font-medium text-yellow-600 mb-1">
                      Verification Code: <code className="font-mono bg-yellow-100 px-2 py-1 rounded">{account.verification_code}</code>
                    </p>
                    <p className="text-xs text-yellow-700">
                      Add this code to your {getPlatformLabel(account.platform)} bio/description, then click "Verify Account" below.
                    </p>
                  </div>
                )}

                {/* Verification Failed Message */}
                {account.verification_status === 'FAILED' && (
                  <div className="mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                    <p className="text-sm text-red-600">
                      Verification failed. Make sure the code is in your bio and try again.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {account.verification_status !== 'VERIFIED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleVerify(account.id)}
                      disabled={verifyingId === account.id}
                    >
                      {verifyingId === account.id ? 'Verifying...' : 'Verify Account'}
                    </Button>
                  )}
                  {account.verification_status === 'VERIFIED' && (
                    <span className="text-sm text-green-600 font-medium">
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Status helper functions
function getStatusConfig(status: string, type: 'processing' | 'review' | 'ownership' = 'review') {
  const configs: Record<string, { color: string; label: string; icon: React.ReactNode; description: string }> = {
    // Processing statuses
    uploaded: {
      color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      label: 'Uploaded',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      description: 'Your submission has been uploaded and is waiting to be processed.',
    },
    fetching_stats: {
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      label: 'Fetching Stats',
      icon: (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      description: 'We\'re fetching your video stats from the platform. This usually takes 1-2 minutes.',
    },
    checking_hashtags: {
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      label: 'Checking Hashtags',
      icon: (
        <svg className="w-3.5 h-3.5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      description: 'Verifying that your video includes the required hashtags.',
    },
    checking_description: {
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      label: 'Checking Description',
      icon: (
        <svg className="w-3.5 h-3.5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      description: 'Verifying that your video description meets the contest requirements.',
    },
    waiting_review: {
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      label: 'Waiting for Review',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: 'Your submission is waiting for manual review by our team.',
    },
    approved: {
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      label: 'Approved',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Your submission has been approved and is eligible for prizes!',
    },
    // Review statuses
    pass: {
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      label: 'Passed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      description: 'This check passed successfully.',
    },
    fail: {
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
      label: 'Failed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      description: 'This check did not pass. You can request a manual review.',
    },
    pending_review: {
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      label: 'Pending Review',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: 'Waiting for manual review.',
    },
    approved_manual: {
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      label: 'Approved (Manual)',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Approved after manual review.',
    },
    pending: {
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      label: 'Pending',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: 'Waiting to be reviewed.',
    },
    rejected: {
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
      label: 'Rejected',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      description: 'This submission was rejected.',
    },
    // Ownership statuses
    verified: {
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      label: 'Verified',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Video ownership has been verified.',
    },
    failed: {
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
      label: 'Failed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      description: 'Ownership verification failed.',
    },
    contested: {
      color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      label: 'Contested',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      description: 'Another creator has also submitted this video. Ownership will be assigned once verified.',
    },
  };

  return configs[status] || {
    color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    label: status,
    icon: null,
    description: 'Status unknown.',
  };
}

function StatusBadge({ status, type, label, hasFailed }: { status: string; type?: 'processing' | 'review' | 'ownership'; label?: string; hasFailed?: boolean }) {
  const config = getStatusConfig(status, type);
  const displayLabel = label || config.label;

  // If fetching_stats has failed, show error state instead
  if (hasFailed && status === 'fetching_stats') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-500 border-red-500/20"
        title="Stats fetching failed. Click 'Retry Submission' to try again."
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        Stats Fetch Failed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}
      title={config.description}
    >
      {config.icon}
      {displayLabel}
    </span>
  );
}

function SubmissionCard({ submission, onRefreshStats, onRetryProcessing, onRequestReview, onDelete, canRefreshStats, sessionToken, actionError, onNavigateToOwnership }: {
  submission: any;
  onRefreshStats: (id: number) => void;
  onRetryProcessing: (id: number) => void;
  onRequestReview: (id: number) => void;
  onDelete: (id: number) => void;
  canRefreshStats: (submission: any) => boolean;
  sessionToken: string | null;
  actionError?: string;
  onNavigateToOwnership?: () => void;
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealType, setAppealType] = useState<'hashtag' | 'description' | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [appealSuccess, setAppealSuccess] = useState(false);
  const [showEmbeddedVideoPopup, setShowEmbeddedVideoPopup] = useState(false);

  const allCategories = submission.contest_submission_categories || [];
  const primaryCategory = allCategories.find((c: any) => c.is_primary)?.contest_categories;
  const generalCategories = allCategories.filter((c: any) => !c.is_primary).map((c: any) => c.contest_categories);

  // Get video data from videos_hot if available, otherwise use submission data
  const videoHot = submission.videos_hot;
  const coverImageUrl = videoHot?.cover_url || videoHot?.thumbnail_url || null;
  const originalVideoUrl = videoHot?.video_url || videoHot?.url || '';
  
  // Get creator info from videos_hot
  const creatorFromHot = videoHot?.creators_hot;
  const creator = creatorFromHot ? {
    id: creatorFromHot.creator_id || '',
    username: creatorFromHot.username || creatorFromHot.display_name || 'Unknown',
    avatar: creatorFromHot.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorFromHot.username || 'U')}&background=120F23&color=fff`,
    verified: creatorFromHot.verified || false,
  } : null;

  const handleRefreshStats = async () => {
    setRefreshingStats(true);
    try {
      await onRefreshStats(submission.id);
    } finally {
      setRefreshingStats(false);
    }
  };

  const handleRetryProcessing = async () => {
    setRetryingProcessing(true);
    try {
      await onRetryProcessing(submission.id);
    } finally {
      setRetryingProcessing(false);
    }
  };

  const handleRequestReview = async () => {
    setRequestingReview(true);
    try {
      await onRequestReview(submission.id);
    } finally {
      setRequestingReview(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove this submission from your profile? It will be hidden from your view but will still be counted in contest statistics. The video and data will be preserved.')) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(submission.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleAppealClick = (type: 'hashtag' | 'description') => {
    setAppealType(type);
    setAppealReason('');
    setAppealError(null);
    setAppealSuccess(false);
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = async () => {
    if (!appealType || !appealReason.trim()) {
      setAppealError('Please provide a reason for your appeal');
      return;
    }

    setSubmittingAppeal(true);
    setAppealError(null);
    setAppealSuccess(false);

    try {
      const response = await authFetch(`/api/user/submissions/${submission.id}/appeal`, {
        method: 'POST',
        includeJson: true,
        body: JSON.stringify({
          appeal_type: appealType,
          appeal_reason: appealReason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit appeal');
      }

      setAppealSuccess(true);
      setTimeout(() => {
        setShowAppealModal(false);
        setAppealReason('');
        setAppealType(null);
        setAppealSuccess(false);
        // Refresh the page or refetch submissions
        window.location.reload();
      }, 2000);
    } catch (err) {
      setAppealError(err instanceof Error ? err.message : 'Failed to submit appeal');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const needsRetry = submission.invalid_stats_flag === true || 
    (submission.processing_status === 'waiting_review' && submission.invalid_stats_flag);

  // Check if submission is stuck in fetching_stats
  const isStuck = (() => {
    if (submission.processing_status === 'fetching_stats') {
      const updatedAt = submission.updated_at || submission.created_at;
      if (updatedAt) {
        const updatedTime = new Date(updatedAt).getTime();
        const now = Date.now();
        const minutesSinceUpdate = (now - updatedTime) / (1000 * 60);
        // Consider stuck if more than 30 minutes
        return minutesSinceUpdate > 30;
      }
    }
    // Check for other processing statuses stuck for more than 1 hour
    if (submission.processing_status !== 'approved' && submission.processing_status !== 'waiting_review') {
      const updatedAt = submission.updated_at || submission.created_at;
      if (updatedAt) {
        const updatedTime = new Date(updatedAt).getTime();
        const now = Date.now();
        const minutesSinceUpdate = (now - updatedTime) / (1000 * 60);
        return minutesSinceUpdate > 60;
      }
    }
    return false;
  })();

  // Check if fetching_stats has failed (either invalid_stats_flag is true or it's stuck)
  const statsFetchFailed = submission.processing_status === 'fetching_stats' && 
    (submission.invalid_stats_flag === true || isStuck);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="border border-[var(--color-border)]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge 
                status={submission.processing_status} 
                type="processing" 
                hasFailed={statsFetchFailed}
              />
              <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] uppercase">
                {videoHot?.platform || 'unknown'}
              </span>
              {needsRetry && !statsFetchFailed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-500 border-red-500/20">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Processing Failed
                </span>
              )}
              {isStuck && !statsFetchFailed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-orange-500/10 text-orange-500 border-orange-500/20">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Stuck - Try Retry
                </span>
              )}
            </div>
            <a
              href={originalVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-primary)] hover:underline break-all"
            >
              View Original Video →
            </a>
            {submission.created_at && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Submitted {formatDate(submission.created_at)}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 p-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <svg
              className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Video and Stats Grid */}
        {(() => {
          const videoUrl = submission.mp4_bucket && submission.mp4_path 
            ? getContestVideoUrl(submission.mp4_bucket, submission.mp4_path)
            : null;
          
          return (
            <>
              {showVideoPopup && videoUrl && (
                <MP4VideoModal
                  videoUrl={videoUrl}
                  poster={coverImageUrl || undefined}
                  onClose={() => setShowVideoPopup(false)}
                />
              )}
              {showEmbeddedVideoPopup && originalVideoUrl && (() => {
                const videoPlatform: Platform = (() => {
                  if (videoHot?.platform && videoHot.platform !== 'unknown') {
                    return videoHot.platform as Platform;
                  }
                  if (videoHot?.platform && videoHot.platform !== 'unknown') {
                    return videoHot.platform as Platform;
                  }
                  if (originalVideoUrl) {
                    return detectPlatform(originalVideoUrl);
                  }
                  return 'unknown';
                })();

                const videoForModal: Video = {
                  id: videoHot?.video_id || submission.id.toString(),
                  postId: videoHot?.post_id || videoHot?.video_id || submission.id.toString(),
                  title: videoHot?.caption || videoHot?.description || 'Contest Submission',
                  description: videoHot?.description || '',
                  thumbnail: coverImageUrl || '',
                  videoUrl: originalVideoUrl,
                  platform: videoPlatform,
                  creator: creator || {
                    id: submission.user_id || '',
                    username: 'Unknown',
                    avatar: 'https://ui-avatars.com/api/?name=U&background=120F23&color=fff',
                    verified: false,
                  },
                  views: videoHot?.views_count ?? 0,
                  likes: videoHot?.likes_count ?? 0,
                  comments: videoHot?.comments_count ?? submission.comments_count ?? 0,
                  shares: videoHot?.shares_count ?? submission.shares_count ?? 0,
                  saves: videoHot?.collect_count ?? submission.saves_count ?? 0,
                  impact: Number(videoHot?.impact_score ?? 0),
                  duration: 0,
                  createdAt: submission.created_at || new Date().toISOString(),
                  hashtags: [],
                };

                return (
                  <VideoModal
                    video={videoForModal}
                    onClose={() => setShowEmbeddedVideoPopup(false)}
                  />
                );
              })()}
              {showAppealModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <Card className="w-full max-w-md">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          Appeal {appealType === 'hashtag' ? 'Hashtag' : 'Description'} Check
                        </h3>
                        <button
                          onClick={() => {
                            setShowAppealModal(false);
                            setAppealReason('');
                            setAppealType(null);
                            setAppealError(null);
                            setAppealSuccess(false);
                          }}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      {appealSuccess ? (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-sm text-green-600">
                            Appeal submitted successfully! An admin will review your appeal.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm text-[var(--color-text-primary)] mb-2">
                              Please explain why you believe the {appealType === 'hashtag' ? 'hashtag' : 'description'} check was incorrect:
                            </p>
                            <textarea
                              value={appealReason}
                              onChange={(e) => setAppealReason(e.target.value)}
                              placeholder="Enter your appeal reason..."
                              className="w-full p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] resize-none"
                              rows={6}
                              disabled={submittingAppeal}
                            />
                          </div>
                          
                          {appealError && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                              <p className="text-sm text-red-600">{appealError}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowAppealModal(false);
                                setAppealReason('');
                                setAppealType(null);
                                setAppealError(null);
                              }}
                              disabled={submittingAppeal}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleSubmitAppeal}
                              isLoading={submittingAppeal}
                              disabled={submittingAppeal || !appealReason.trim()}
                            >
                              Submit Appeal
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Video Player or Cover Image - Square aspect ratio */}
                {(videoUrl || coverImageUrl || originalVideoUrl) && (
                  <div className="lg:col-span-1">
                    {(() => {
                      // Detect platform
                      const videoPlatform: Platform = (() => {
                        if (videoHot?.platform && videoHot.platform !== 'unknown') {
                          return videoHot.platform as Platform;
                        }
                        if (submission.platform && submission.platform !== 'unknown') {
                          return submission.platform as Platform;
                        }
                        if (originalVideoUrl) {
                          return detectPlatform(originalVideoUrl);
                        }
                        return 'unknown';
                      })();

                      const platformMeta: Record<Platform, { label: string; bg: string; color: string; icon: React.ReactElement }> = {
                        tiktok: {
                          label: 'TikTok',
                          bg: 'rgba(0,0,0,0.75)',
                          color: '#fff',
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                              <path d="M16 4.5c1 .9 2.2 1.5 3.5 1.5v3.4c-1.3.1-2.7-.3-3.9-1V16a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.3a2.1 2.1 0 00-1-.2 2.2 2.2 0 102.2 2.2V4.5h3.2Z" />
                            </svg>
                          ),
                        },
                        instagram: {
                          label: 'Instagram',
                          bg: 'rgba(255,255,255,0.9)',
                          color: '#000',
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <rect x="4" y="4" width="16" height="16" rx="4" />
                              <circle cx="12" cy="12" r="3.5" />
                              <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
                            </svg>
                          ),
                        },
                        youtube: {
                          label: 'YouTube',
                          bg: 'rgba(255,0,0,0.85)',
                          color: '#fff',
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                              <path d="M21.5 7.5a2.7 2.7 0 00-1.9-1.9C17.3 5 12 5 12 5s-5.3 0-7.6.6A2.7 2.7 0 002.5 7.4 28.8 28.8 0 002 12a28.8 28.8 0 00.5 4.6 2.7 2.7 0 001.9 1.9C6.7 19 12 19 12 19s5.3 0 7.6-.6a2.7 2.7 0 001.9-1.9 28.8 28.8 0 00.5-4.6 28.8 28.8 0 00-.5-4.4zM10 15.2V8.8l5 3.2-5 3.2z" />
                            </svg>
                          ),
                        },
                        unknown: {
                          label: 'Unknown',
                          bg: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          icon: (
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M9 9a3 3 0 116 0c0 2-3 2-3 4" />
                              <circle cx="12" cy="17" r="1" />
                            </svg>
                          ),
                        },
                      };

                      // Create Video object for VideoModal
                      const videoForModal: Video = {
                        id: videoHot?.video_id || submission.video_id || submission.id.toString(),
                        postId: videoHot?.post_id || submission.video_id || submission.id.toString(),
                        title: videoHot?.caption || videoHot?.description || 'Contest Submission',
                        description: videoHot?.description || '',
                        thumbnail: coverImageUrl || '',
                        videoUrl: originalVideoUrl,
                        platform: videoPlatform,
                        creator: creator || {
                          id: submission.user_id || '',
                          username: 'Unknown',
                          avatar: 'https://ui-avatars.com/api/?name=U&background=120F23&color=fff',
                          verified: false,
                        },
                        views: videoHot?.views_count ?? submission.views_count ?? 0,
                        likes: videoHot?.likes_count ?? submission.likes_count ?? 0,
                        comments: videoHot?.comments_count ?? submission.comments_count ?? 0,
                        shares: videoHot?.shares_count ?? submission.shares_count ?? 0,
                        saves: videoHot?.collect_count ?? submission.saves_count ?? 0,
                        impact: Number(videoHot?.impact_score ?? 0),
                        duration: 0,
                        createdAt: submission.created_at || new Date().toISOString(),
                        hashtags: [],
                      };

                      return (
                        <div 
                          className="relative group cursor-pointer rounded-lg overflow-hidden bg-black"
                          onClick={() => {
                            if (videoUrl) {
                              setShowVideoPopup(true);
                            } else if (originalVideoUrl) {
                              setShowEmbeddedVideoPopup(true);
                            }
                          }}
                        >
                          {coverImageUrl ? (
                            <img 
                              src={coverImageUrl} 
                              alt="Video cover" 
                              className="w-full aspect-square object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          ) : videoUrl ? (
                            <video
                              src={videoUrl}
                              className="w-full aspect-square object-cover transition-transform duration-200 group-hover:scale-105"
                              preload="metadata"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center">
                              <p className="text-white text-sm">No video available</p>
                            </div>
                          )}
                          
                          {/* Platform badge */}
                          {videoPlatform !== 'unknown' && (
                            <div
                              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-lg border backdrop-blur-sm z-10"
                              style={{
                                background: platformMeta[videoPlatform].bg,
                                color: platformMeta[videoPlatform].color,
                                borderColor: platformMeta[videoPlatform].color,
                              }}
                            >
                              {platformMeta[videoPlatform].icon}
                              <span>{platformMeta[videoPlatform].label}</span>
                            </div>
                          )}
                          
                          {/* Play button overlay */}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity group-hover:bg-black/50 rounded-lg">
                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              
              {/* Stats Grid */}
              <div className={(videoUrl || coverImageUrl || originalVideoUrl) ? "lg:col-span-2" : "lg:col-span-3"}>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                  Video Statistics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--color-border)]/10 min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1 truncate">Views</p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)] truncate" title={(videoHot?.views_count ?? 0).toLocaleString()}>
                      {formatNumber(videoHot?.views_count ?? 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-border)]/10 min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1 truncate">Likes</p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)] truncate" title={(videoHot?.likes_count ?? 0).toLocaleString()}>
                      {formatNumber(videoHot?.likes_count ?? 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--color-border)]/10 min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1 truncate">Comments</p>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)] truncate" title={(videoHot?.comments_count ?? submission.comments_count ?? 0).toLocaleString()}>
                      {formatNumber(videoHot?.comments_count ?? submission.comments_count)}
                    </p>
                  </div>
                </div>
                {(videoHot?.impact_score !== null && videoHot?.impact_score !== undefined) || (submission.impact_score !== null && submission.impact_score !== undefined) ? (
                  <div className="mt-4 p-3 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Impact Score</p>
                    <p className="text-xl font-bold text-[var(--color-primary)]">
                      {formatNumber(videoHot?.impact_score ?? submission.impact_score)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            </>
          );
        })()}

        {/* Action Buttons - Always Visible */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRetryProcessing}
            isLoading={retryingProcessing}
            disabled={retryingProcessing || deleting}
          >
            {statsFetchFailed 
              ? 'Retry Submission' 
              : isStuck 
                ? 'Retry Processing (Stuck)' 
                : 'Retry Processing'}
          </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  isLoading={deleting}
                  disabled={deleting || retryingProcessing || refreshingStats || requestingReview}
                  title="Remove this submission from your profile. It will still be counted in contest statistics."
                >
                  {deleting ? 'Removing...' : 'Remove from Profile'}
                </Button>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
            {/* Review Progress Section */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Review Progress
              </h4>
              <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="space-y-3">
                  {/* Contest Name */}
                  {submission.contests && (
                    <div>
                      <span className="text-xs font-medium text-[var(--color-text-muted)]">Contest:</span>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                        {submission.contests.title || 'Unknown Contest'}
                      </p>
                    </div>
                  )}
                  
                  {/* Current Processing Stage */}
                  <div>
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">Current Stage:</span>
                    <div className="mt-1">
                      <StatusBadge 
                        status={submission.processing_status} 
                        type="processing" 
                        hasFailed={statsFetchFailed}
                      />
                      {submission.processing_status === 'fetching_stats' && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Fetching video statistics from {videoHot?.platform || 'platform'}...
                        </p>
                      )}
                      {submission.processing_status === 'checking_hashtags' && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Verifying required hashtags are present...
                        </p>
                      )}
                      {submission.processing_status === 'checking_description' && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Verifying description meets requirements...
                        </p>
                      )}
                      {submission.processing_status === 'waiting_review' && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Waiting for manual review by our team...
                        </p>
                      )}
                      {submission.processing_status === 'approved' && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Submission approved and eligible for prizes!
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Review Status Summary */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Hashtags:</span>
                      <StatusBadge 
                        status={submission.hashtag_status} 
                        type="review"
                        label={submission.hashtag_status === 'pass' || submission.hashtag_status === 'approved_manual' ? 'Passed' : submission.hashtag_status === 'fail' ? 'Failed' : 'Pending'}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Description:</span>
                      <StatusBadge 
                        status={submission.description_status} 
                        type="review"
                        label={submission.description_status === 'pass' || submission.description_status === 'approved_manual' ? 'Passed' : submission.description_status === 'fail' ? 'Failed' : 'Pending'}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Content:</span>
                      <StatusBadge 
                        status={submission.content_review_status || 'pending'} 
                        type="review"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)]">Ownership:</span>
                      <StatusBadge 
                        status={submission.mp4_ownership_status || submission.verification_status || 'pending'} 
                        type="ownership"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Status Section */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Detailed Status
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-lg border ${
                  submission.hashtag_status === 'pass' || submission.hashtag_status === 'approved_manual'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-[var(--color-border)]/10 border-[var(--color-border)]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">Hashtags</span>
                    {(submission.hashtag_status === 'pass' || submission.hashtag_status === 'approved_manual') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Approved
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">Pending</span>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${
                  submission.description_status === 'pass' || submission.description_status === 'approved_manual'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-[var(--color-border)]/10 border-[var(--color-border)]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">Description</span>
                    {(submission.description_status === 'pass' || submission.description_status === 'approved_manual') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Approved
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">Pending</span>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${
                  submission.content_review_status === 'approved'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-[var(--color-border)]/10 border-[var(--color-border)]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">Content Review</span>
                    {submission.content_review_status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Approved
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">Pending</span>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${
                  submission.mp4_ownership_status === 'verified' || submission.verification_status === 'verified'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-[var(--color-border)]/10 border-[var(--color-border)]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">Ownership</span>
                    {(submission.mp4_ownership_status === 'verified' || submission.verification_status === 'verified') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-muted)]">Not Set Up</span>
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => {
                            if (onNavigateToOwnership) {
                              onNavigateToOwnership();
                            } else {
                              // Fallback: navigate to settings
                              router.push('/settings');
                            }
                          }}
                        >
                          Set Up
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Review Status Section */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Review Status
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">BrightData Processing</span>
                    <StatusBadge 
                      status={submission.processing_status} 
                      type="processing" 
                      hasFailed={statsFetchFailed}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {statsFetchFailed 
                      ? 'Stats fetching failed. Click "Retry Submission" below to try again.'
                      : getStatusConfig(submission.processing_status, 'processing').description}
                  </p>
                  <div className="mt-2">
                    <Button
                      variant={statsFetchFailed ? "primary" : "secondary"}
                      size="sm"
                      onClick={handleRetryProcessing}
                      isLoading={retryingProcessing}
                      disabled={retryingProcessing}
                    >
                      {statsFetchFailed 
                        ? 'Retry Submission' 
                        : isStuck 
                          ? 'Retry Processing (Stuck)' 
                          : 'Retry Processing'}
                    </Button>
                    {statsFetchFailed && (
                      <p className="text-xs text-red-500 mt-1">
                        Stats fetching failed. Click "Retry Submission" to restart the submission process.
                      </p>
                    )}
                    {isStuck && !statsFetchFailed && (
                      <p className="text-xs text-orange-500 mt-1">
                        This submission appears to be stuck. Click retry to restart processing.
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">Ownership</span>
                    <StatusBadge 
                      status={submission.mp4_ownership_status || submission.verification_status || 'pending'} 
                      type="ownership"
                      label={submission.mp4_ownership_status ? 'Ownership' : 'Verification'}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {getStatusConfig(submission.mp4_ownership_status || submission.verification_status || 'pending', 'ownership').description}
                  </p>
                  {submission.mp4_ownership_status === 'failed' && (
                    <p className="text-xs text-red-500 mt-2">
                      Only the verified social account owner can compete for prizes.
                    </p>
                  )}
                  {submission.mp4_ownership_status === 'contested' && (
                    <p className="text-xs text-orange-500 mt-2">
                      Another creator has also submitted this video. Ownership will be assigned once verified.
                    </p>
                  )}
                  {submission.mp4_ownership_reason && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {submission.mp4_ownership_reason}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">Hashtags</span>
                    <StatusBadge status={submission.hashtag_status} type="review" />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {getStatusConfig(submission.hashtag_status, 'review').description}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">Description</span>
                    <StatusBadge status={submission.description_status} type="review" />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {getStatusConfig(submission.description_status, 'review').description}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">Content Review</span>
                    <StatusBadge status={submission.content_review_status} type="review" />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {getStatusConfig(submission.content_review_status, 'review').description}
                  </p>
                </div>
              </div>
            </div>

            {/* Categories */}
            {(primaryCategory || generalCategories.length > 0) && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {primaryCategory && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                      {primaryCategory.name}
                      {primaryCategory.ranking_method && primaryCategory.ranking_method !== 'manual' && (
                        <span className="ml-1 text-[var(--color-text-muted)]">
                          (Ranked by: {primaryCategory.ranking_method})
                        </span>
                      )}
                    </span>
                  )}
                  {generalCategories.map((cat: any) => (
                    <span
                      key={cat.id}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    >
                      {cat.name} (Auto-Entry)
                      {cat.ranking_method && cat.ranking_method !== 'manual' && (
                        <span className="ml-1 text-[var(--color-text-muted)]">
                          - {cat.ranking_method}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags from BrightData */}
            {submission.hashtags_array && submission.hashtags_array.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Hashtags from BrightData
                </h4>
                <div className="flex flex-wrap gap-2">
                  {submission.hashtags_array.map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description from BrightData */}
            {submission.description_text && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Description from BrightData
                </h4>
                <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                    {submission.description_text}
                  </p>
                </div>
              </div>
            )}

            {/* Stats Info */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Stats Information</h4>
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  <span className="font-medium">Last updated:</span> {formatDate(submission.stats_updated_at || submission.last_stats_refresh_at)}
                </p>
                {submission.last_stats_refresh_at && !canRefreshStats(submission) && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Stats can be updated once per day. You can update again in {(() => {
                      const lastRefresh = new Date(submission.last_stats_refresh_at);
                      const now = new Date();
                      const hoursSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
                      const hoursRemaining = Math.ceil(24 - hoursSinceRefresh);
                      return hoursRemaining > 0 ? `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}` : 'now';
                    })()}.
                  </p>
                )}
                {canRefreshStats(submission) && (
                  <p className="text-xs text-green-500">
                    Stats can be updated now.
                  </p>
                )}
                {!submission.last_stats_refresh_at && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Stats have not been updated yet. You can update them now.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {actionError && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-red-500">{actionError}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRetryProcessing}
                  isLoading={retryingProcessing}
                  disabled={retryingProcessing || deleting}
                >
                  {statsFetchFailed 
                    ? 'Retry Submission' 
                    : isStuck 
                      ? 'Retry Processing (Stuck)' 
                      : 'Retry Processing'}
                </Button>
                {canRefreshStats(submission) && !statsFetchFailed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshStats}
                    isLoading={refreshingStats}
                    disabled={refreshingStats || deleting}
                  >
                    Update Stats
                  </Button>
                )}
                {submission.hashtag_status === 'fail' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAppealClick('hashtag')}
                    disabled={deleting || retryingProcessing || refreshingStats}
                  >
                    Appeal Hashtag
                  </Button>
                )}
                {submission.description_status === 'fail' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAppealClick('description')}
                    disabled={deleting || retryingProcessing || refreshingStats}
                  >
                    Appeal Description
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  isLoading={deleting}
                  disabled={deleting || retryingProcessing || refreshingStats || requestingReview}
                  title="Remove this submission from your profile. It will still be counted in contest statistics."
                >
                  {deleting ? 'Removing...' : 'Remove from Profile'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ContestsSection({ onNavigateToOwnership }: { onNavigateToOwnership?: () => void }) {
  const { session } = useAuth();
  const sessionToken = session?.access_token ?? null;

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [expandedContests, setExpandedContests] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Record<number, string>>({});

  // Group submissions by contest - memoized to prevent unnecessary recalculations
  const groupedByContest = useMemo(() => {
    return submissions.reduce((acc, submission) => {
      const contestId = submission.contests?.id || 'unknown';
      if (!acc[contestId]) {
        acc[contestId] = {
          contest: submission.contests,
          submissions: [],
        };
      }
      acc[contestId].submissions.push(submission);
      return acc;
    }, {} as Record<string, { contest: any; submissions: any[] }>);
  }, [submissions]);

  const fetchSubmissions = useCallback(async (silent = false) => {
    if (!sessionToken) {
      return;
    }
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/user/submissions?t=${timestamp}`, {
        headers,
        credentials: 'include',
        cache: 'no-store', // Ensure no caching
      });
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const data = await response.json();
      setSubmissions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken) {
      fetchSubmissions();
    }
  }, [sessionToken, fetchSubmissions]);

  // Refresh data when tab becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionToken) {
        fetchSubmissions(true); // Silent refresh when tab becomes visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionToken, fetchSubmissions]);

  // Helper function to check if a submission is actively processing (not stuck)
  const isActivelyProcessing = useCallback((submission: any) => {
    // If status is approved or waiting_review, it's not processing
    if (submission.processing_status === 'approved' || submission.processing_status === 'waiting_review') {
      return false;
    }
    
    // If fetching_stats has failed (invalid_stats_flag or stuck), it's not actively processing
    if (submission.processing_status === 'fetching_stats') {
      // Check if invalid_stats_flag is set (indicates failure)
      if (submission.invalid_stats_flag === true) {
        return false;
      }
      // Check if it's been stuck for too long (> 30 minutes)
      const updatedAt = submission.updated_at || submission.created_at;
      if (updatedAt) {
        const updatedTime = new Date(updatedAt).getTime();
        const now = Date.now();
        const minutesSinceUpdate = (now - updatedTime) / (1000 * 60);
        // If it's been more than 30 minutes, consider it stuck/failed
        if (minutesSinceUpdate > 30) {
          return false;
        }
      }
    }
    
    // For other processing statuses, check if they're stuck (> 1 hour)
    const updatedAt = submission.updated_at || submission.created_at;
    if (updatedAt) {
      const updatedTime = new Date(updatedAt).getTime();
      const now = Date.now();
      const minutesSinceUpdate = (now - updatedTime) / (1000 * 60);
      // If it's been more than 1 hour, consider it stuck
      if (minutesSinceUpdate > 60) {
        return false;
      }
    }
    
    return true;
  }, []);

  // Set up polling for submissions that are still processing (not stuck)
  useEffect(() => {
    const hasProcessing = submissions.some(isActivelyProcessing);
    
    if (!hasProcessing) {
      setPolling(false);
      return;
    }

    setPolling(true);
    const interval = setInterval(() => {
      fetchSubmissions(true); // Silent fetch during polling
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [submissions, fetchSubmissions, isActivelyProcessing]);

  // Expand all contests by default on first load
  useEffect(() => {
    const contestKeys = Object.keys(groupedByContest);
    if (contestKeys.length > 0 && expandedContests.size === 0) {
      setExpandedContests(new Set(contestKeys));
    }
  }, [groupedByContest, expandedContests.size]);

  const clearActionError = (submissionId: number) => {
    setActionErrors(prev => {
      const { [submissionId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleRefreshStats = async (submissionId: number) => {
    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    try {
      clearActionError(submissionId);
      const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
      const response = await fetch(`/api/user/submissions/${submissionId}/refresh-stats`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh stats');
      }
      await fetchSubmissions();
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [submissionId]: err instanceof Error ? err.message : 'Failed to refresh stats' }));
    }
  };

  const handleRetryProcessing = async (submissionId: number) => {
    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    try {
      clearActionError(submissionId);
      const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
      const response = await fetch(`/api/user/submissions/${submissionId}/retry-processing`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to retry processing');
      }
      await fetchSubmissions();
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [submissionId]: err instanceof Error ? err.message : 'Failed to retry processing' }));
    }
  };

  const handleRequestReview = async (submissionId: number) => {
    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    try {
      clearActionError(submissionId);
      const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
      const response = await fetch(`/api/user/submissions/${submissionId}/request-review`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request review');
      }
      await fetchSubmissions();
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [submissionId]: err instanceof Error ? err.message : 'Failed to request review' }));
    }
  };

  const handleDelete = async (submissionId: number) => {
    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    try {
      clearActionError(submissionId);
      const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
      const response = await fetch(`/api/user/submissions/${submissionId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove submission');
      }
      await fetchSubmissions();
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [submissionId]: err instanceof Error ? err.message : 'Failed to remove submission' }));
    }
  };

  const canRefreshStats = (submission: any) => {
    if (!submission.last_stats_refresh_at) return true;
    const lastRefresh = new Date(submission.last_stats_refresh_at);
    const now = new Date();
    const hoursSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
    return hoursSinceRefresh >= 24;
  };

  const toggleContest = (contestId: string) => {
    setExpandedContests(prev => {
      const next = new Set(prev);
      if (next.has(contestId)) {
        next.delete(contestId);
      } else {
        next.add(contestId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              No Submissions Yet
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
              You haven't submitted any edits to contests yet. Browse available contests and submit your best edits to compete for prizes!
            </p>
          </div>
          <Button variant="primary" onClick={() => window.location.href = '/contests'}>
            Browse Contests
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            My Contest Submissions
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            View and manage all your contest submissions. Expand each contest to see your submissions and their review status.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchSubmissions()}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <p className="text-red-500 text-sm">{error}</p>
        </Card>
      )}

      {polling && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-blue-500 text-sm">
              Processing submissions... Status will update automatically.
            </p>
          </div>
        </Card>
      )}
      
      {/* Show warning for stuck submissions */}
      {submissions.some((s) => {
        if (s.processing_status === 'fetching_stats') {
          const updatedAt = s.updated_at || s.created_at;
          if (updatedAt) {
            const minutesSinceUpdate = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60);
            return minutesSinceUpdate > 30;
          }
        }
        return false;
      }) && (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-orange-500 text-sm">
              Some submissions appear to be stuck. Use the "Retry Processing" button on stuck submissions to restart processing.
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {(Object.entries(groupedByContest) as [string, { contest: any; submissions: any[] }][]).map(([contestId, group]) => {
          const { contest, submissions: contestSubmissions } = group;
          const isExpanded = expandedContests.has(contestId);
          
          return (
            <Card key={contestId} className="border border-[var(--color-border)]">
              <button
                onClick={() => toggleContest(contestId)}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface)] transition-colors rounded-lg"
              >
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                    {contest?.title || 'Unknown Contest'}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {contestSubmissions.length} {contestSubmissions.length === 1 ? 'submission' : 'submissions'}
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)] pt-4">
                  {contestSubmissions.map((submission) => (
                    <SubmissionCard
                      key={submission.id}
                      submission={submission}
                      onRefreshStats={handleRefreshStats}
                      onRetryProcessing={handleRetryProcessing}
                      onRequestReview={handleRequestReview}
                      onDelete={handleDelete}
                      canRefreshStats={canRefreshStats}
                      sessionToken={sessionToken}
                      actionError={actionErrors[submission.id]}
                      onNavigateToOwnership={onNavigateToOwnership}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
