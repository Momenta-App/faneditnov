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

export default function ContestReviewPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const contestId = params.id as string;

  const [contest, setContest] = useState<{ id: string; title: string } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
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
      const response = await authFetch(`/api/admin/contests/${contestId}/review/submissions`);
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
      const response = await authFetch(`/api/admin/contests/${contestId}/review/submissions/${submissionId}`, {
        method: 'PUT',
        includeJson: true,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update submission');
      }

      // Refresh submissions
      await fetchSubmissions();
      
      // Show success message
      const updateType = updates.hashtag_status 
        ? 'Hashtag check' 
        : updates.description_status 
        ? 'Description check' 
        : 'Content review';
      setSuccessMessage(`${updateType} updated successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
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

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-6">
                  <div className="h-64 bg-[var(--color-border)]/20 rounded animate-pulse" />
                </Card>
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-[var(--color-text-muted)]">
                No submissions for this contest
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  All Submissions ({submissions.length})
                </h2>
              </div>

              {submissions.map((submission) => {
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
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                            <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                              <p className="text-xs text-[var(--color-text-muted)] mb-1">Shares</p>
                              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {(submission.shares_count || 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[var(--color-border)]/10">
                              <p className="text-xs text-[var(--color-text-muted)] mb-1">Saves</p>
                              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                                {(submission.saves_count || 0).toLocaleString()}
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
                              onClick={() => handleUpdateStatus(submission.id, { hashtag_status: 'approved_manual' })}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                              className="mt-3"
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
                              onClick={() => handleUpdateStatus(submission.id, { description_status: 'approved_manual' })}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                              className="mt-3"
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
                              submission.content_review_status === 'approved'
                                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                : submission.content_review_status === 'rejected'
                                ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                            }`}
                          >
                            {submission.content_review_status === 'approved' && '✓ '}
                            {submission.content_review_status === 'rejected' && '✗ '}
                            {submission.content_review_status}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {submission.content_review_status !== 'approved' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleUpdateStatus(submission.id, { content_review_status: 'approved' })}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                            >
                              Approve Content
                            </Button>
                          )}
                          {submission.content_review_status !== 'rejected' && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleUpdateStatus(submission.id, { content_review_status: 'rejected' })}
                              disabled={updating === submission.id}
                              isLoading={updating === submission.id}
                            >
                              Reject
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
