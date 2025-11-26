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
  mp4_bucket: string;
  mp4_path: string;
  platform: string;
  mp4_ownership_status?: string;
  mp4_ownership_reason?: string | null;
  mp4_owner_social_account_id?: string | null;
  hashtag_status: string;
  description_status: string;
  content_review_status: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  impact_score: number;
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
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
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
      if (response.ok) {
        const data = await response.json();
        setContest({ id: data.data.id, title: data.data.title });
      }
    } catch (err) {
      console.error('Error fetching contest:', err);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch(`/api/admin/contests/${contestId}/review/submissions`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch submissions');
      }
      const data = await response.json();
      setSubmissions(data.data || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
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
      setUpdating(true);
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
      if (selectedSubmission?.id === submissionId) {
        const response = await authFetch(`/api/admin/contests/${contestId}/review/submissions/${submissionId}`);
        if (response.ok) {
          const updated = await response.json();
          setSelectedSubmission(updated.data);
        }
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
      setError(err instanceof Error ? err.message : 'Failed to update');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpdating(false);
    }
  };

  const getVideoUrl = (submission: Submission) => {
    if (submission.mp4_bucket && submission.mp4_path) {
      return getContestVideoUrl(submission.mp4_bucket, submission.mp4_path);
    }
    return null;
  };

  if (isLoading || !user || profile?.role !== 'admin' || !contestId) {
    return null;
  }

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-6xl mx-auto">
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
        <div className="max-w-6xl mx-auto">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submissions List */}
            <div className="lg:col-span-1">
              <Card>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
                  Pending Review ({submissions.length})
                </h2>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-[var(--color-border)]/20 rounded animate-pulse" />
                    ))}
                  </div>
                ) : submissions.length === 0 ? (
                  <p className="text-[var(--color-text-muted)] text-sm">
                    No submissions pending review for this contest
                  </p>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((submission) => (
                      <button
                        key={submission.id}
                        onClick={() => setSelectedSubmission(submission)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedSubmission?.id === submission.id
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                        }`}
                      >
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">
                          {submission.profiles?.display_name || submission.profiles?.email}
                        </p>
                        <div className="flex gap-1 mt-1">
                          {submission.hashtag_status === 'fail' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">
                              Hashtag
                            </span>
                          )}
                          {submission.hashtag_status === 'pending_review' && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">
                              Hashtag
                            </span>
                          )}
                          {submission.description_status === 'fail' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">
                              Description
                            </span>
                          )}
                          {submission.description_status === 'pending_review' && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">
                              Description
                            </span>
                          )}
                          {submission.content_review_status === 'pending' && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">
                              Review
                            </span>
                          )}
                          {submission.mp4_ownership_status === 'contested' && (
                            <span className="text-xs px-1.5 py-0.5 bg-orange-500/10 text-orange-500 rounded">
                              Ownership
                            </span>
                          )}
                          {submission.mp4_ownership_status === 'failed' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded">
                              Ownership Failed
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Review Panel */}
            <div className="lg:col-span-2">
              {selectedSubmission ? (
                <Card>
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                        Review Submission
                      </h2>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Contest: {selectedSubmission.contests?.title || contest?.title}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        User: {selectedSubmission.profiles?.display_name || selectedSubmission.profiles?.email}
                      </p>
                    </div>

                    {/* Video Player */}
                    {getVideoUrl(selectedSubmission) && (
                      <div>
                        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                          Video
                        </h3>
                        <ContestVideoPlayer
                          videoUrl={getVideoUrl(selectedSubmission)!}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Original URL */}
                    <div>
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Original Social URL
                      </h3>
                      <a
                        href={selectedSubmission.original_video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-primary)] hover:underline break-all"
                      >
                        {selectedSubmission.original_video_url}
                      </a>
                    </div>

                    {/* Stats */}
                    {selectedSubmission.views_count > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                          Stats
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-[var(--color-text-muted)]">Views</p>
                            <p className="font-medium text-[var(--color-text-primary)]">
                              {selectedSubmission.views_count.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[var(--color-text-muted)]">Likes</p>
                            <p className="font-medium text-[var(--color-text-primary)]">
                              {selectedSubmission.likes_count.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[var(--color-text-muted)]">Comments</p>
                            <p className="font-medium text-[var(--color-text-primary)]">
                              {selectedSubmission.comments_count.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Checks */}
                    <div>
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                        Verification Status
                      </h3>
                      <div className="space-y-3">
                        {/* Hashtag Check */}
                        <div
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            selectedSubmission.hashtag_status === 'fail' ||
                            selectedSubmission.hashtag_status === 'pending_review'
                              ? 'border-red-500/50 bg-red-500/5'
                              : selectedSubmission.hashtag_status === 'pass' ||
                                selectedSubmission.hashtag_status === 'approved_manual'
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                Hashtag Check
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  selectedSubmission.hashtag_status === 'fail' ||
                                  selectedSubmission.hashtag_status === 'pending_review'
                                    ? 'bg-red-500/10 text-red-500'
                                    : selectedSubmission.hashtag_status === 'pass' ||
                                      selectedSubmission.hashtag_status === 'approved_manual'
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-yellow-500/10 text-yellow-500'
                                }`}
                              >
                                {selectedSubmission.hashtag_status}
                              </span>
                            </div>
                            {selectedSubmission.hashtag_status === 'fail' && (
                              <p className="text-xs text-red-600 font-medium mb-1">
                                ❌ Failed: Required hashtags not found
                              </p>
                            )}
                            {selectedSubmission.hashtag_status === 'pending_review' && (
                              <p className="text-xs text-yellow-600 font-medium mb-1">
                                ⏳ Pending manual review
                              </p>
                            )}
                            {selectedSubmission.contests?.required_hashtags && (
                              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                Required: {selectedSubmission.contests.required_hashtags.join(', ')}
                              </p>
                            )}
                          </div>
                          {selectedSubmission.hashtag_status !== 'pass' &&
                            selectedSubmission.hashtag_status !== 'approved_manual' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleUpdateStatus(selectedSubmission.id, {
                                    hashtag_status: 'approved_manual',
                                  })
                                }
                                disabled={updating}
                                isLoading={updating}
                              >
                                Approve Hashtags
                              </Button>
                            )}
                          {(selectedSubmission.hashtag_status === 'pass' ||
                            selectedSubmission.hashtag_status === 'approved_manual') && (
                            <span className="text-green-600 text-sm font-medium">✓ Approved</span>
                          )}
                        </div>

                        {/* Description Check */}
                        <div
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            selectedSubmission.description_status === 'fail' ||
                            selectedSubmission.description_status === 'pending_review'
                              ? 'border-red-500/50 bg-red-500/5'
                              : selectedSubmission.description_status === 'pass' ||
                                selectedSubmission.description_status === 'approved_manual'
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                Description Check
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  selectedSubmission.description_status === 'fail' ||
                                  selectedSubmission.description_status === 'pending_review'
                                    ? 'bg-red-500/10 text-red-500'
                                    : selectedSubmission.description_status === 'pass' ||
                                      selectedSubmission.description_status === 'approved_manual'
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-yellow-500/10 text-yellow-500'
                                }`}
                              >
                                {selectedSubmission.description_status}
                              </span>
                            </div>
                            {selectedSubmission.description_status === 'fail' && (
                              <p className="text-xs text-red-600 font-medium mb-1">
                                ❌ Failed: Description does not match required template
                              </p>
                            )}
                            {selectedSubmission.description_status === 'pending_review' && (
                              <p className="text-xs text-yellow-600 font-medium mb-1">
                                ⏳ Pending manual review
                              </p>
                            )}
                          </div>
                          {selectedSubmission.description_status !== 'pass' &&
                            selectedSubmission.description_status !== 'approved_manual' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleUpdateStatus(selectedSubmission.id, {
                                    description_status: 'approved_manual',
                                  })
                                }
                                disabled={updating}
                                isLoading={updating}
                              >
                                Approve Description
                              </Button>
                            )}
                          {(selectedSubmission.description_status === 'pass' ||
                            selectedSubmission.description_status === 'approved_manual') && (
                            <span className="text-green-600 text-sm font-medium">✓ Approved</span>
                          )}
                        </div>

                        {/* Content Review */}
                        <div
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            selectedSubmission.content_review_status === 'rejected'
                              ? 'border-red-500/50 bg-red-500/5'
                              : selectedSubmission.content_review_status === 'approved'
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                Content Review
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  selectedSubmission.content_review_status === 'rejected'
                                    ? 'bg-red-500/10 text-red-500'
                                    : selectedSubmission.content_review_status === 'approved'
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-yellow-500/10 text-yellow-500'
                                }`}
                              >
                                {selectedSubmission.content_review_status}
                              </span>
                            </div>
                            {selectedSubmission.content_review_status === 'pending' && (
                              <p className="text-xs text-yellow-600 font-medium">
                                ⏳ Awaiting content review
                              </p>
                            )}
                            {selectedSubmission.content_review_status === 'approved' && (
                              <p className="text-xs text-green-600 font-medium">✓ Content approved</p>
                            )}
                            {selectedSubmission.content_review_status === 'rejected' && (
                              <p className="text-xs text-red-600 font-medium">❌ Content rejected</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {selectedSubmission.content_review_status !== 'approved' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                  handleUpdateStatus(selectedSubmission.id, {
                                    content_review_status: 'approved',
                                  })
                                }
                                disabled={updating}
                                isLoading={updating}
                              >
                                Approve Content
                              </Button>
                            )}
                            {selectedSubmission.content_review_status !== 'rejected' && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  handleUpdateStatus(selectedSubmission.id, {
                                    content_review_status: 'rejected',
                                  })
                                }
                                disabled={updating}
                                isLoading={updating}
                              >
                                Reject
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* MP4 Ownership */}
                        <div
                          className={`p-3 border rounded-lg ${
                            selectedSubmission.mp4_ownership_status === 'failed' ||
                            selectedSubmission.mp4_ownership_status === 'contested'
                              ? 'border-orange-500/50 bg-orange-500/5'
                              : selectedSubmission.mp4_ownership_status === 'verified'
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                MP4 Ownership
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  selectedSubmission.mp4_ownership_status === 'verified'
                                    ? 'bg-green-500/10 text-green-500'
                                    : selectedSubmission.mp4_ownership_status === 'failed' ||
                                      selectedSubmission.mp4_ownership_status === 'contested'
                                    ? 'bg-orange-500/10 text-orange-500'
                                    : 'bg-yellow-500/10 text-yellow-500'
                                }`}
                              >
                                {selectedSubmission.mp4_ownership_status || 'pending'}
                              </span>
                            </div>
                            {selectedSubmission.mp4_ownership_reason && (
                              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                {selectedSubmission.mp4_ownership_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <p className="text-[var(--color-text-muted)]">
                      Select a submission from the list to review
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </PageSection>
    </Page>
  );
}

