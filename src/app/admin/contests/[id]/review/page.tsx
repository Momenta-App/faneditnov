'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../contexts/AuthContext';
import { Card } from '../../../../components/Card';
import { Page, PageSection } from '../../../../components/layout';
import { Button } from '../../../../components/Button';
import { ContestVideoPlayer } from '../../../../components/ContestVideoPlayer';
import { getContestVideoUrl } from '@/lib/storage-utils';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';

interface Submission {
  id: number;
  contest_id: string;
  user_id: string;
  original_video_url: string;
  mp4_bucket?: string | null;
  mp4_path?: string | null;
  platform: string;
  mp4_ownership_status?: string | null;
  mp4_ownership_reason?: string | null;
  mp4_owner_social_account_id?: string | null;
  hashtag_status: string;
  description_status: string;
  content_review_status: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count?: number;
  saves_count?: number;
  impact_score: number;
  description_text?: string | null;
  hashtags_array?: string[] | null;
  created_at: string;
  processing_status: string;
  profiles: {
    email: string;
    display_name?: string;
  };
  contests: {
    id: string;
    title: string;
    required_hashtags: string[];
    required_description_template?: string;
  };
}

interface Appeal {
  id: number;
  submission_id: number;
  user_id: string;
  appeal_type: 'hashtag' | 'description';
  appeal_reason: string;
  status: 'pending' | 'approved' | 'denied';
  admin_response?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  profiles: {
    email: string;
    display_name?: string;
  };
  reviewed_by_profile?: {
    email: string;
    display_name?: string;
  } | null;
  submission: Submission;
}

type TabType = 'approved' | 'pending' | 'denied' | 'appeal';
type ReviewStatus = 'pending' | 'approved' | 'rejected';

export default function ContestReviewPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const contestId = params.id as string;

  const [contest, setContest] = useState<{ id: string; title: string } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingAppeals, setLoadingAppeals] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [updatingAppeal, setUpdatingAppeal] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (!isLoading && profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    if (profile?.role === 'admin' && contestId) {
      fetchContest();
      fetchSubmissions();
    }
  }, [user, profile, isLoading, router, contestId]);

  useEffect(() => {
    if (activeTab === 'appeal' && contestId && profile?.role === 'admin') {
      fetchAppeals();
    }
  }, [activeTab, contestId, profile?.role]);

  const fetchContest = async () => {
    try {
      const response = await authFetch(`/api/admin/contests/${contestId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setError('Access denied. Admin role required.');
          router.push('/');
          return;
        }
        if (response.status === 401) {
          setError('Please sign in to continue.');
          router.push('/auth/login');
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch contest');
      }
      const data = await response.json();
      setContest({ id: data.data.id, title: data.data.title });
    } catch (err) {
      console.error('Error fetching contest:', err);
      if (err instanceof Error && !err.message.includes('Access denied') && !err.message.includes('sign in')) {
        setError(err.message || 'Failed to load contest');
      }
    }
  };

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      // Add cache-busting parameter to ensure fresh data
      const cacheBuster = Date.now();
      const response = await authFetch(`/api/admin/contests/${contestId}/review/submissions?t=${cacheBuster}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setError('Access denied. Admin role required.');
          router.push('/');
          return;
        }
        if (response.status === 401) {
          setError('Please sign in to continue.');
          router.push('/auth/login');
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch submissions');
      }
      const data = await response.json();
      console.log('[Review] Fetched submissions:', data.data?.length || 0);
      if (data.data && data.data.length > 0) {
        console.log('[Review] First submission status:', data.data[0].content_review_status);
      }
      setSubmissions(data.data || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      if (err instanceof Error && !err.message.includes('Access denied') && !err.message.includes('sign in')) {
        setError(err.message || 'Failed to load submissions');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAppeals = async () => {
    try {
      setLoadingAppeals(true);
      setError(null);
      const response = await authFetch(`/api/admin/contests/${contestId}/review/appeals`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setError('Access denied. Admin role required.');
          return;
        }
        if (response.status === 401) {
          setError('Please sign in to continue.');
          return;
        }
        throw new Error(errorData.error || 'Failed to fetch appeals');
      }
      const data = await response.json();
      setAppeals(data.data || []);
    } catch (err) {
      console.error('Error fetching appeals:', err);
      if (err instanceof Error && !err.message.includes('Access denied') && !err.message.includes('sign in')) {
        setError(err.message || 'Failed to load appeals');
      }
    } finally {
      setLoadingAppeals(false);
    }
  };

  const handleUpdateStatus = async (
    submissionId: number,
    updates: {
      hashtag_status?: string;
      description_status?: string;
      content_review_status?: string;
    }
  ) => {
    try {
      setUpdating(submissionId);
      setError(null);
      setSuccessMessage(null);
      
      console.log('[Review] Updating submission:', { submissionId, updates, contestId });
      
      const response = await authFetch(`/api/admin/contests/${contestId}/review/submissions/${submissionId}`, {
        method: 'PUT',
        includeJson: true,
        body: JSON.stringify(updates),
      });

      console.log('[Review] Response status:', response.status, response.ok);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[Review] Error response:', data);
        console.error('[Review] Error details:', data.details);
        let errorMsg = data.error || `Failed to update submission (${response.status})`;
        if (data.details?.message) {
          errorMsg += `: ${data.details.message}`;
        } else if (data.details) {
          errorMsg += `: ${JSON.stringify(data.details)}`;
        }
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
        return;
      }

      const responseData = await response.json();
      console.log('[Review] Update response:', responseData);
      console.log('[Review] Updated submission data:', responseData.data);
      console.log('[Review] Update persisted:', responseData.updatePersisted);
      console.log('[Review] Content review status in response:', responseData.data?.content_review_status);

      if (!responseData.data) {
        console.error('[Review] No data in response!');
        setError('Update response missing data. Please refresh and try again.');
        setTimeout(() => setError(null), 5000);
        return;
      }

      if (responseData.updatePersisted === false) {
        console.warn('[Review] Update verification mismatch, showing optimistic UI anyway');
      }

      // Refresh immediately to ensure UI reflects authoritative backend state
      await fetchSubmissions();
      if (activeTab === 'appeal') {
        await fetchAppeals();
      }
      
      // Show success message
      const updateType = updates.hashtag_status 
        ? 'Hashtag check' 
        : updates.description_status 
        ? 'Description check' 
        : 'Content review';
      setSuccessMessage(`${updateType} updated successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('[Review] Error updating status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update';
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpdating(null);
    }
  };

  const toggleDescription = (submissionId: number) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(submissionId)) {
      newExpanded.delete(submissionId);
    } else {
      newExpanded.add(submissionId);
    }
    setExpandedDescriptions(newExpanded);
  };

  const getVideoUrl = (submission: Submission) => {
    if (submission.mp4_bucket && submission.mp4_path) {
      return getContestVideoUrl(submission.mp4_bucket, submission.mp4_path);
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getReviewStatus = (submission: Submission): ReviewStatus => {
    const contentStatus = submission.content_review_status?.trim().toLowerCase();
    const processingStatus = submission.processing_status?.trim().toLowerCase();

    if (contentStatus === 'rejected') {
      return 'rejected';
    }

    const processingSuggestsPending =
      processingStatus === 'waiting_review' ||
      processingStatus === 'uploaded' ||
      processingStatus === 'fetching_stats' ||
      processingStatus === 'checking_hashtags' ||
      processingStatus === 'checking_description';

    if (processingSuggestsPending) {
      return 'pending';
    }

    if (contentStatus === 'approved') {
      return 'approved';
    }

    return 'pending';
  };

  const getStatusBadge = (status: string, type: 'hashtag' | 'description') => {
    const isPass = status === 'pass' || status === 'approved_manual';
    const isFail = status === 'fail';
    const isPending = status === 'pending_review';

    if (isPass) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20">
          <span>✓</span> Pass
        </span>
      );
    }
    if (isFail) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20">
          <span>✗</span> Fail
        </span>
      );
    }
    if (isPending) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
          <span>⏳</span> Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/20">
        {status}
      </span>
    );
  };

  const getOwnershipBadge = (status: string | null | undefined) => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/20">
          Pending
        </span>
      );
    }
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20">
          <span>✓</span> Verified
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20">
          <span>✗</span> Failed
        </span>
      );
    }
    if (status === 'contested') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-500/10 text-orange-600 border border-orange-500/20">
          <span>⚠</span> Contested
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-500/10 text-gray-600 border border-gray-500/20">
        {status}
      </span>
    );
  };

  const handleAppealUpdate = async (appealId: number, status: 'approved' | 'denied', adminResponse?: string) => {
    try {
      setUpdatingAppeal(appealId);
      setError(null);
      setSuccessMessage(null);
      const response = await authFetch(`/api/admin/contests/${contestId}/review/appeals/${appealId}`, {
        method: 'PUT',
        includeJson: true,
        body: JSON.stringify({ status, admin_response: adminResponse }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update appeal');
      }

      // Refresh appeals and submissions
      await fetchAppeals();
      await fetchSubmissions();
      
      setSuccessMessage(`Appeal ${status} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update appeal');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpdatingAppeal(null);
    }
  };

  // Filter submissions based on active tab
  const getFilteredSubmissions = () => {
    switch (activeTab) {
      case 'approved':
        return submissions.filter(s => getReviewStatus(s) === 'approved');
      case 'pending':
        return submissions.filter(s => getReviewStatus(s) === 'pending');
      case 'denied':
        return submissions.filter(s => getReviewStatus(s) === 'rejected');
      case 'appeal':
        return []; // Appeals are handled separately
      default:
        return submissions;
    }
  };

  const filteredSubmissions = getFilteredSubmissions();
  const pendingAppeals = appeals.filter(a => a.status === 'pending');

  if (isLoading || !user || profile?.role !== 'admin' || !contestId) {
    return null;
  }

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href={`/admin/contests/${contestId}`}>
              <Button variant="ghost" size="sm">
                ← Back to Contest
              </Button>
            </Link>
            <Link href="/admin/contests">
              <Button variant="ghost" size="sm">
                All Contests
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            Review Submissions
          </h1>
          <p className="text-[var(--color-text-muted)]">
            {contest ? `Review submissions for: ${contest.title}` : 'Review and approve contest submissions'}
          </p>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-7xl mx-auto">
          {error && (
            <Card className="mb-6 border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{error}</p>
            </Card>
          )}
          {successMessage && (
            <Card className="mb-6 border-green-500/20 bg-green-500/5">
              <p className="text-green-500">{successMessage}</p>
            </Card>
          )}

          {/* Tabs */}
          <div className="mb-6 border-b border-[var(--color-border)]">
            <div className="flex gap-1">
              {(['pending', 'approved', 'denied', 'appeal'] as TabType[]).map((tab) => {
                const tabLabels = {
                  pending: 'Pending',
                  approved: 'Approved',
                  denied: 'Denied',
                  appeal: 'Appeal',
                };
                const tabCounts = {
                  pending: submissions.filter(s => getReviewStatus(s) === 'pending').length,
                  approved: submissions.filter(s => getReviewStatus(s) === 'approved').length,
                  denied: submissions.filter(s => getReviewStatus(s) === 'rejected').length,
                  appeal: pendingAppeals.length,
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
                    }`}
                  >
                    {tabLabels[tab]} ({tabCounts[tab]})
                  </button>
                );
              })}
            </div>
          </div>

          {loading || (activeTab === 'appeal' && loadingAppeals) ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-6">
                  <div className="h-64 bg-[var(--color-border)]/20 rounded animate-pulse" />
                </Card>
              ))}
            </div>
          ) : activeTab === 'appeal' ? (
            pendingAppeals.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-[var(--color-text-muted)]">
                  No pending appeals for this contest
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  Pending Appeals ({pendingAppeals.length})
                </h2>
                {pendingAppeals.map((appeal) => {
                  const submission = appeal.submission;
                  const videoUrl = getVideoUrl(submission);
                  const isDescriptionExpanded = expandedDescriptions.has(submission.id);
                  const description = submission.description_text || 'No description available';
                  const shouldTruncate = description.length > 200;
                  const displayDescription = isDescriptionExpanded || !shouldTruncate 
                    ? description 
                    : `${description.substring(0, 200)}...`;

                  return (
                    <Card key={appeal.id} className="p-6 hover:shadow-lg transition-shadow border-2 border-orange-500/20">
                      <div className="space-y-6">
                        {/* Appeal Header */}
                        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                                Appeal for {appeal.appeal_type === 'hashtag' ? 'Hashtag Check' : 'Description Check'}
                              </h3>
                              <p className="text-sm text-[var(--color-text-muted)]">
                                Submitted by: {appeal.profiles?.display_name || appeal.profiles?.email}
                              </p>
                              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                Appeal Date: {formatDate(appeal.created_at)}
                              </p>
                            </div>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-600 border border-orange-500/30">
                              {appeal.appeal_type}
                            </span>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                              User's Appeal Reason:
                            </p>
                            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap bg-white/5 p-3 rounded">
                              {appeal.appeal_reason}
                            </p>
                          </div>
                        </div>

                        {/* Submission Details */}
                        <div className="space-y-4">
                          {/* Header: User, Date, Platform */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                  {submission.profiles?.display_name || submission.profiles?.email}
                                </h3>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] uppercase">
                                  {submission.platform || 'unknown'}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--color-text-muted)]">
                                Submitted: {formatDate(submission.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getOwnershipBadge(submission.mp4_ownership_status)}
                            </div>
                          </div>

                          {/* Video and Stats Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Video Player */}
                            <div className="lg:col-span-1">
                              {videoUrl ? (
                                <div className="rounded-lg overflow-hidden bg-black">
                                  <ContestVideoPlayer videoUrl={videoUrl} className="w-full" />
                                </div>
                              ) : (
                                <div className="rounded-lg bg-[var(--color-border)]/20 aspect-video flex items-center justify-center">
                                  <p className="text-sm text-[var(--color-text-muted)]">No video available</p>
                                </div>
                              )}
                              <a
                                href={submission.original_video_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 text-xs text-[var(--color-primary)] hover:underline break-all block"
                              >
                                View Original →
                              </a>
                            </div>

                            {/* Stats Grid */}
                            <div className="lg:col-span-2">
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                                Video Statistics
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Views</p>
                                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {(submission.views_count || 0).toLocaleString()}
                                  </p>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Likes</p>
                                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {(submission.likes_count || 0).toLocaleString()}
                                  </p>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Comments</p>
                                  <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                    {submission.comments_count.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Scraped Data from BrightData */}
                          {appeal.appeal_type === 'hashtag' && submission.hashtags_array && submission.hashtags_array.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                Hashtags from BrightData (System Scraped)
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {submission.hashtags_array.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {submission.contests?.required_hashtags && submission.contests.required_hashtags.length > 0 && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                                  Required: {submission.contests.required_hashtags.join(', ')}
                                </p>
                              )}
                            </div>
                          )}

                          {appeal.appeal_type === 'description' && submission.description_text && (
                            <div>
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                Description from BrightData (System Scraped)
                              </h4>
                              <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                                  {displayDescription}
                                </p>
                                {shouldTruncate && (
                                  <button
                                    onClick={() => toggleDescription(submission.id)}
                                    className="mt-2 text-xs text-[var(--color-primary)] hover:underline"
                                  >
                                    {isDescriptionExpanded ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Current Status */}
                          <div className="p-4 rounded-lg border border-[var(--color-border)]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                Current {appeal.appeal_type === 'hashtag' ? 'Hashtag' : 'Description'} Status
                              </h4>
                              {getStatusBadge(
                                appeal.appeal_type === 'hashtag' ? submission.hashtag_status : submission.description_status,
                                appeal.appeal_type
                              )}
                            </div>
                          </div>

                          {/* Appeal Actions */}
                          <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(e) => {
                                console.log('[Review] BUTTON CLICKED - Approve Appeal button clicked');
                                console.log('[Review] Event:', e);
                                console.log('[Review] Appeal ID:', appeal.id);
                                console.log('[Review] Updating appeal state:', updatingAppeal);
                                
                                e.preventDefault();
                                e.stopPropagation();
                                
                                if (updatingAppeal === appeal.id) {
                                  console.log('[Review] Already updating appeal, skipping');
                                  return;
                                }
                                
                                console.log('[Review] Calling handleAppealUpdate...');
                                handleAppealUpdate(appeal.id, 'approved').catch((error) => {
                                  console.error('[Review] Error in onClick handler:', error);
                                  setError(error instanceof Error ? error.message : 'Failed to update appeal');
                                });
                              }}
                              disabled={updatingAppeal === appeal.id}
                              isLoading={updatingAppeal === appeal.id}
                              type="button"
                            >
                              Approve Appeal
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={(e) => {
                                console.log('[Review] BUTTON CLICKED - Deny Appeal button clicked');
                                console.log('[Review] Event:', e);
                                console.log('[Review] Appeal ID:', appeal.id);
                                console.log('[Review] Updating appeal state:', updatingAppeal);
                                
                                e.preventDefault();
                                e.stopPropagation();
                                
                                if (updatingAppeal === appeal.id) {
                                  console.log('[Review] Already updating appeal, skipping');
                                  return;
                                }
                                
                                console.log('[Review] Calling handleAppealUpdate...');
                                handleAppealUpdate(appeal.id, 'denied').catch((error) => {
                                  console.error('[Review] Error in onClick handler:', error);
                                  setError(error instanceof Error ? error.message : 'Failed to update appeal');
                                });
                              }}
                              disabled={updatingAppeal === appeal.id}
                              isLoading={updatingAppeal === appeal.id}
                              type="button"
                            >
                              Deny Appeal
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : filteredSubmissions.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-[var(--color-text-muted)]">
                No {activeTab} submissions for this contest
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Submissions ({filteredSubmissions.length})
                </h2>
              </div>

              {filteredSubmissions.map((submission) => {
                const reviewStatus = getReviewStatus(submission);
                const videoUrl = getVideoUrl(submission);
                const isDescriptionExpanded = expandedDescriptions.has(submission.id);
                const description = submission.description_text || 'No description available';
                const shouldTruncate = description.length > 200;
                const displayDescription = isDescriptionExpanded || !shouldTruncate 
                  ? description 
                  : `${description.substring(0, 200)}...`;

                return (
                  <Card key={submission.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="space-y-6">
                      {/* Header: User, Date, Platform */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                              {submission.profiles?.display_name || submission.profiles?.email}
                            </h3>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] uppercase">
                              {submission.platform}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            Submitted: {formatDate(submission.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getOwnershipBadge(submission.mp4_ownership_status)}
                        </div>
                      </div>

                      {/* Video and Stats Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Video Player */}
                        <div className="lg:col-span-1">
                          {videoUrl ? (
                            <div className="rounded-lg overflow-hidden bg-black">
                              <ContestVideoPlayer videoUrl={videoUrl} className="w-full" />
                            </div>
                          ) : (
                            <div className="rounded-lg bg-[var(--color-border)]/20 aspect-video flex items-center justify-center">
                              <p className="text-sm text-[var(--color-text-muted)]">No video available</p>
                            </div>
                          )}
                          <a
                            href={submission.original_video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-xs text-[var(--color-primary)] hover:underline break-all block"
                          >
                            View Original →
                          </a>
                        </div>

                        {/* Stats Grid */}
                        <div className="lg:col-span-2">
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                            Video Statistics
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                              <p className="text-xs text-[var(--color-text-muted)] mb-1">Views</p>
                              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {submission.views_count.toLocaleString()}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                              <p className="text-xs text-[var(--color-text-muted)] mb-1">Likes</p>
                              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {submission.likes_count.toLocaleString()}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                              <p className="text-xs text-[var(--color-text-muted)] mb-1">Comments</p>
                              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {submission.comments_count.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hashtags from BrightData */}
                      {submission.hashtags_array && submission.hashtags_array.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                            Hashtags from BrightData
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {submission.hashtags_array.map((tag, idx) => (
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
                              {displayDescription}
                            </p>
                            {shouldTruncate && (
                              <button
                                onClick={() => toggleDescription(submission.id)}
                                className="mt-2 text-xs text-[var(--color-primary)] hover:underline"
                              >
                                {isDescriptionExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Automatic Review Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              Hashtag Check
                            </h4>
                            {getStatusBadge(submission.hashtag_status, 'hashtag')}
                          </div>
                          {submission.contests?.required_hashtags && submission.contests.required_hashtags.length > 0 && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-2">
                              Required: {submission.contests.required_hashtags.join(', ')}
                            </p>
                          )}
                          {submission.hashtag_status !== 'pass' && submission.hashtag_status !== 'approved_manual' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                console.log('[Review] BUTTON CLICKED - Approve Hashtags button clicked');
                                console.log('[Review] Event:', e);
                                console.log('[Review] Submission ID:', submission.id);
                                console.log('[Review] Current hashtag status:', submission.hashtag_status);
                                console.log('[Review] Updating state:', updating);
                                
                                e.preventDefault();
                                e.stopPropagation();
                                
                                if (updating === submission.id) {
                                  console.log('[Review] Already updating, skipping');
                                  return;
                                }
                                
                                console.log('[Review] Calling handleUpdateStatus...');
                                handleUpdateStatus(submission.id, { hashtag_status: 'approved_manual' }).catch((error) => {
                                  console.error('[Review] Error in onClick handler:', error);
                                  setError(error instanceof Error ? error.message : 'Failed to update');
                                });
                              }}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                              className="mt-3"
                              type="button"
                            >
                              Approve Hashtags
                            </Button>
                          )}
                        </div>

                        <div className="p-4 rounded-lg border border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              Description Check
                            </h4>
                            {getStatusBadge(submission.description_status, 'description')}
                          </div>
                          {submission.description_status !== 'pass' && submission.description_status !== 'approved_manual' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                console.log('[Review] BUTTON CLICKED - Approve Description button clicked');
                                console.log('[Review] Event:', e);
                                console.log('[Review] Submission ID:', submission.id);
                                console.log('[Review] Current description status:', submission.description_status);
                                console.log('[Review] Updating state:', updating);
                                
                                e.preventDefault();
                                e.stopPropagation();
                                
                                if (updating === submission.id) {
                                  console.log('[Review] Already updating, skipping');
                                  return;
                                }
                                
                                console.log('[Review] Calling handleUpdateStatus...');
                                handleUpdateStatus(submission.id, { description_status: 'approved_manual' }).catch((error) => {
                                  console.error('[Review] Error in onClick handler:', error);
                                  setError(error instanceof Error ? error.message : 'Failed to update');
                                });
                              }}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                              className="mt-3"
                              type="button"
                            >
                              Approve Description
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Ownership Check */}
                      {submission.mp4_ownership_reason && (
                        <div className="p-4 rounded-lg border border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              Ownership Check
                            </h4>
                            {getOwnershipBadge(submission.mp4_ownership_status)}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-2">
                            {submission.mp4_ownership_reason}
                          </p>
                        </div>
                      )}

                      {/* Content Review Actions */}
                      <div className="flex items-center justify-between p-4 rounded-lg border border-[var(--color-border)]">
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                            Content Review
                          </h4>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                              reviewStatus === 'approved'
                                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                : reviewStatus === 'rejected'
                                ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                            }`}
                          >
                            {reviewStatus === 'approved' && '✓ '}
                            {reviewStatus === 'rejected' && '✗ '}
                            {reviewStatus.charAt(0).toUpperCase() + reviewStatus.slice(1)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              console.log('[Review] BUTTON CLICKED - Approve button clicked');
                              console.log('[Review] Event:', e);
                              console.log('[Review] Submission ID:', submission.id);
                              console.log('[Review] Current status:', reviewStatus);
                              console.log('[Review] Updating state:', updating);
                              console.log('[Review] Is disabled?', updating === submission.id || reviewStatus === 'approved');
                              
                              e.preventDefault();
                              e.stopPropagation();
                              
                              if (reviewStatus === 'approved') {
                                console.log('[Review] Already approved, skipping');
                                return;
                              }
                              
                              if (updating === submission.id) {
                                console.log('[Review] Already updating, skipping');
                                return;
                              }
                              
                              console.log('[Review] Calling handleUpdateStatus...');
                              handleUpdateStatus(submission.id, { content_review_status: 'approved' }).catch((error) => {
                                console.error('[Review] Error in onClick handler:', error);
                                setError(error instanceof Error ? error.message : 'Failed to update');
                              });
                            }}
                            disabled={updating === submission.id || reviewStatus === 'approved'}
                            isLoading={updating === submission.id}
                            type="button"
                          >
                            {reviewStatus === 'approved' ? 'Approved' : 'Approve Content'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              if (reviewStatus === 'rejected' || updating === submission.id) {
                                return;
                              }
                              
                              try {
                                await handleUpdateStatus(submission.id, { content_review_status: 'rejected' });
                              } catch (error) {
                                console.error('[Review] Error rejecting submission:', error);
                                setError(error instanceof Error ? error.message : 'Failed to reject submission');
                                setTimeout(() => setError(null), 5000);
                              }
                            }}
                            disabled={updating === submission.id || reviewStatus === 'rejected'}
                            isLoading={updating === submission.id}
                            type="button"
                          >
                            {reviewStatus === 'rejected' ? 'Rejected' : 'Reject'}
                          </Button>
                          {reviewStatus !== 'pending' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                if (updating === submission.id) {
                                  return;
                                }
                                
                                try {
                                  await handleUpdateStatus(submission.id, { content_review_status: 'pending' });
                                } catch (error) {
                                  console.error('[Review] Error resetting to pending:', error);
                                  setError(error instanceof Error ? error.message : 'Failed to reset to pending');
                                  setTimeout(() => setError(null), 5000);
                                }
                              }}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                              type="button"
                            >
                              Reset to Pending
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageSection>
    </Page>
  );
}
