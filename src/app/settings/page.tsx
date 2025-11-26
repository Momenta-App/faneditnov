'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useCampaigns } from '../hooks/useData';
import { Card } from '../components/Card';
import { Page, PageSection, Stack } from '../components/layout';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '../components/Tabs';
import { getRoleDisplayName, getRoleDescription } from '@/lib/role-utils';

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
              <Tab isActive={activeTab === 0} onClick={() => setActiveTab(0)}>
                Profile
              </Tab>
              <Tab isActive={activeTab === 1} onClick={() => setActiveTab(1)}>
                Contests
              </Tab>
            </TabList>
            <TabPanels className="mt-6">
              <TabPanel className={activeTab === 0 ? 'block' : 'hidden'}>
                <ProfileSection />
                <ConnectedAccountsSection />
                <SavedCampaignsSection />
              </TabPanel>
              <TabPanel className={activeTab === 1 ? 'block' : 'hidden'}>
                <ContestsSection />
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

function ContestsSection() {
  const { session } = useAuth();
  const sessionToken = session?.access_token ?? null;
  const authHeaders = useMemo(
    () => (sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    [sessionToken]
  );

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (sessionToken) {
      fetchSubmissions();
    }
  }, [sessionToken]);

  // Set up polling for submissions that are still processing
  useEffect(() => {
    const hasProcessing = submissions.some(
      (s) => s.processing_status !== 'approved' && s.processing_status !== 'waiting_review'
    );
    
    if (!hasProcessing) {
      setPolling(false);
      return;
    }

    setPolling(true);
    const interval = setInterval(() => {
      fetchSubmissions();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [submissions]);

  const fetchSubmissions = async () => {
    if (!sessionToken) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/user/submissions', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const data = await response.json();
      setSubmissions(data.data || []);
      setPolling(
        (data.data || []).some(
          (s: any) => s.processing_status !== 'approved' && s.processing_status !== 'waiting_review'
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStats = async (submissionId: number) => {
    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    try {
      const response = await fetch(`/api/user/submissions/${submissionId}/refresh-stats`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh stats');
      }
      // Refetch submissions
      await fetchSubmissions();
      // Show success message (could use a toast library in the future)
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh stats');
    }
  };

  const handleRequestReview = async (submissionId: number) => {
    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }
    try {
      const response = await fetch(`/api/user/submissions/${submissionId}/request-review`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request review');
      }
      // Refetch submissions
      await fetchSubmissions();
      // Show success message
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request review');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
      case 'approved':
      case 'verified':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'fail':
      case 'rejected':
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'contested':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'pending':
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getProcessingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      fetching_stats: 'Fetching stats from platform',
      checking_hashtags: 'Checking hashtags',
      checking_description: 'Checking description',
      waiting_review: 'Waiting for human review',
      approved: 'Approved',
    };
    return labels[status] || status;
  };

  const canRefreshStats = (submission: any) => {
    if (!submission.last_stats_refresh_at) return true;
    const lastRefresh = new Date(submission.last_stats_refresh_at);
    const now = new Date();
    const hoursSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
    return hoursSinceRefresh >= 24;
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
          <p className="text-[var(--color-text-muted)] mb-4">
            You haven't submitted any edits to contests yet.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/contests'}>
            Browse Contests
          </Button>
        </div>
      </Card>
    );
  }

  // Group submissions by contest
  const groupedByContest = submissions.reduce((acc, submission) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Contest Submissions
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Track the status of every edit you have submitted.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchSubmissions} isLoading={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <p className="text-red-500">{error}</p>
        </Card>
      )}

      {polling && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <p className="text-blue-500 text-sm">
            ⏳ Processing submissions... Status will update automatically.
          </p>
        </Card>
      )}

      {Object.entries(groupedByContest).map(([contestId, { contest, submissions: contestSubmissions }]) => (
        <Card key={contestId}>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
            {contest?.title || 'Unknown Contest'}
          </h2>
          <div className="space-y-4">
            {contestSubmissions.map((submission) => {
              // Get all categories this submission belongs to (primary + general)
              const allCategories = submission.contest_submission_categories || [];
              const primaryCategory = allCategories.find((c: any) => c.is_primary)?.contest_categories;
              const generalCategories = allCategories.filter((c: any) => !c.is_primary).map((c: any) => c.contest_categories);
              
              return (
                <div
                  key={submission.id}
                  className="p-4 border border-[var(--color-border)] rounded-lg"
                >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                          submission.processing_status
                        )}`}
                      >
                        {getProcessingStatusLabel(submission.processing_status)}
                      </span>
                    </div>
                    <a
                      href={submission.original_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-primary)] hover:underline"
                    >
                      View Original Video →
                    </a>
                  </div>
                </div>

                {/* Stats */}
                {submission.views_count > 0 && (
                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-[var(--color-text-muted)]">Views</p>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {submission.views_count.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-muted)]">Likes</p>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {submission.likes_count.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-muted)]">Comments</p>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {submission.comments_count.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      submission.hashtag_status
                    )}`}
                  >
                    Hashtags: {submission.hashtag_status}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      submission.description_status
                    )}`}
                  >
                    Description: {submission.description_status}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      submission.content_review_status
                    )}`}
                  >
                    Review: {submission.content_review_status}
                  </span>
                  {submission.mp4_ownership_status && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                        submission.mp4_ownership_status
                      )}`}
                    >
                      Ownership: {submission.mp4_ownership_status}
                    </span>
                  )}
                </div>

                {/* Categories */}
                {(primaryCategory || generalCategories.length > 0) && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {primaryCategory && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
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
                          className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"
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

                {submission.mp4_ownership_reason && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    {submission.mp4_ownership_reason}
                  </p>
                )}

                {submission.mp4_ownership_status === 'failed' && (
                  <div className="mb-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-500">
                    Ownership verification failed for this video. Only the verified social account owner can
                    compete for prizes.
                  </div>
                )}
                {submission.mp4_ownership_status === 'contested' && (
                  <div className="mb-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 text-sm text-orange-500">
                    Another creator has also submitted this video. Ownership will be assigned once the matching
                    social account is verified.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {canRefreshStats(submission) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRefreshStats(submission.id)}
                    >
                      Update Stats
                    </Button>
                  )}
                  {(submission.hashtag_status === 'fail' || submission.description_status === 'fail') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRequestReview(submission.id)}
                    >
                      Request Review
                    </Button>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
