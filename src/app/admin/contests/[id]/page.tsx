'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/Card';
import { Page, PageSection } from '../../../components/layout';
import { Button } from '../../../components/Button';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';

interface Contest {
  id: string;
  title: string;
  description: string;
  movie_identifier?: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'live' | 'closed';
  required_hashtags: string[];
  required_description_template?: string;
  created_at: string;
  total_prize_pool?: number;
  stats: {
    total_submissions: number;
    verified_submissions: number;
    pending_review: number;
    approved_submissions: number;
  };
  contest_categories?: Array<{
    id: string;
    name: string;
    description?: string;
    rules?: string;
    display_order: number;
    is_general?: boolean;
    ranking_method?: 'manual' | 'views' | 'likes' | 'comments' | 'shares' | 'impact_score';
  contest_prizes: Array<{
    id: string;
    name: string;
    description?: string;
    payout_amount: number;
    rank_order: number;
    }>;
  }>;
}

interface Submission {
  id: number;
  original_video_url: string;
  platform: string;
  impact_score: number;
  views_count: number;
  likes_count: number;
  comments_count: number;
  hashtag_status: string;
  description_status: string;
  content_review_status: string;
  processing_status: string;
  verification_status: string;
  created_at: string;
  profiles: {
    email: string;
    display_name?: string;
  };
}

export default function ContestDetailPage({ params }: { params: { id: string } }) {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [contestId, setContestId] = useState<string | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [hashtagFilter, setHashtagFilter] = useState<string>('');
  const [descriptionFilter, setDescriptionFilter] = useState<string>('');
  const [contentReviewFilter, setContentReviewFilter] = useState<string>('');

  useEffect(() => {
    setContestId(params.id);
  }, [params]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (!isLoading && profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    if (contestId && profile?.role === 'admin') {
      fetchContest();
      fetchSubmissions();
    }
  }, [user, profile, isLoading, router, contestId]);

  const fetchContest = async () => {
    try {
      const response = await authFetch(`/api/admin/contests/${contestId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contest');
      }
      const data = await response.json();
      setContest(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contest');
    }
  };
  const handleDeleteContest = async () => {
    if (!contestId) return;
    const confirmed = window.confirm(
      'Are you sure you want to delete this contest? This action cannot be undone.'
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      const response = await authFetch(`/api/admin/contests/${contestId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete contest');
      }
      router.push('/admin/contests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contest');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (hashtagFilter) queryParams.append('hashtag_status', hashtagFilter);
      if (descriptionFilter) queryParams.append('description_status', descriptionFilter);
      if (contentReviewFilter) queryParams.append('content_review_status', contentReviewFilter);
      queryParams.append('sort_by', 'views_count');
      queryParams.append('sort_order', 'desc');

      const response = await authFetch(
        `/api/admin/contests/${contestId}/submissions?${queryParams.toString()}`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const data = await response.json();
      setSubmissions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contestId) {
      fetchSubmissions();
    }
  }, [hashtagFilter, descriptionFilter, contentReviewFilter, contestId]);

  if (isLoading || !user || profile?.role !== 'admin' || !contest) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      case 'pending':
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/contests">
              <Button variant="ghost" size="sm">
                ← Back to Contests
              </Button>
            </Link>
            <Link href="/admin/review">
              <Button variant="secondary" size="sm">
                Review Submissions
              </Button>
            </Link>
            <Link href={`/admin/contests/${contestId}/edit`}>
              <Button variant="secondary" size="sm">
                Edit Contest
              </Button>
            </Link>
            <Button variant="danger" size="sm" onClick={handleDeleteContest} isLoading={isDeleting}>
              Delete Contest
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            {contest.title}
          </h1>
          <p className="text-[var(--color-text-muted)]">{contest.description}</p>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-6xl mx-auto space-y-6">
          {error && (
            <Card className="border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{error}</p>
            </Card>
          )}

          {/* Stats Overview */}
          <Card>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Contest Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Status</p>
                <p className="text-lg font-semibold text-[var(--color-text-primary)] capitalize">
                  {contest.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Total Submissions</p>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {contest.stats.total_submissions}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Verified</p>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {contest.stats.verified_submissions}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Pending Review</p>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {contest.stats.pending_review}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-muted)] mb-2">Dates</p>
              <p className="text-[var(--color-text-primary)]">
                {formatDate(contest.start_date)} - {formatDate(contest.end_date)}
              </p>
            </div>
            {contest.movie_identifier && (
              <div className="mt-2">
                <p className="text-sm text-[var(--color-text-muted)] mb-2">Movie Identifier</p>
                <p className="text-[var(--color-text-primary)]">{contest.movie_identifier}</p>
              </div>
            )}
          </Card>

          {/* Total Prize Pool */}
          {contest.total_prize_pool !== undefined && contest.total_prize_pool > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                Total Prize Pool
              </h2>
              <p className="text-3xl font-bold text-[var(--color-primary)]">
                ${contest.total_prize_pool.toFixed(2)}
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">
                Calculated from all prizes across all categories
              </p>
            </Card>
          )}

          {/* Specific Categories with Prizes */}
          {contest.contest_categories && contest.contest_categories.filter((cat: any) => !cat.is_general).length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Specific Categories & Prizes
              </h2>
              <div className="space-y-6">
                {contest.contest_categories
                  .filter((cat: any) => !cat.is_general)
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any) => {
                    const rankingLabels: Record<string, string> = {
                      manual: 'Manual Judging',
                      views: 'Most Views',
                      likes: 'Most Likes',
                      comments: 'Most Comments',
                      shares: 'Most Shares',
                      impact_score: 'Manual Judging',
                    };
                    return (
                    <div
                      key={category.id}
                      className="p-4 border border-[var(--color-border)] rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {category.name}
                        </h3>
                        {category.ranking_method !== 'manual' && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-500 rounded">
                            Ranked by: {rankingLabels[category.ranking_method] || category.ranking_method}
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-[var(--color-text-muted)] mb-2">
                          {category.description}
                        </p>
                      )}
                      {category.rules && (
                        <p className="text-xs text-[var(--color-text-muted)] mb-4">
                          Rules: {category.rules}
                        </p>
                      )}
                      {category.contest_prizes && category.contest_prizes.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">Prizes:</p>
                          {category.contest_prizes
                            .sort((a, b) => a.rank_order - b.rank_order)
                            .map((prize) => {
                              const placeNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
                              const placeName = placeNames[prize.rank_order - 1] || `${prize.rank_order}th`;
                              return (
                                <div key={prize.id} className="flex items-center justify-between p-2 bg-[var(--color-surface)] rounded">
                                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                    {placeName} Place
                                  </p>
                                  <p className="text-sm font-semibold text-[var(--color-primary)]">
                                    ${prize.payout_amount.toFixed(2)}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* General Categories with Prizes */}
          {contest.contest_categories && contest.contest_categories.filter((cat: any) => cat.is_general).length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                General Categories (Auto-Entry) & Prizes
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                All submissions automatically enter these categories
              </p>
              <div className="space-y-6">
                {contest.contest_categories
                  .filter((cat: any) => cat.is_general)
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any) => {
                    const rankingLabels: Record<string, string> = {
                      manual: 'Manual Judging',
                      views: 'Most Views',
                      likes: 'Most Likes',
                      comments: 'Most Comments',
                      shares: 'Most Shares',
                      impact_score: 'Manual Judging',
                    };
                    return (
                      <div
                        key={category.id}
                        className="p-4 border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {category.name}
                          </h3>
                          <span className="px-2 py-1 text-xs font-medium bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">
                            Auto-Entry
                          </span>
                          {category.ranking_method !== 'manual' && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-500 rounded">
                              Ranked by: {rankingLabels[category.ranking_method] || category.ranking_method}
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-[var(--color-text-muted)] mb-2">
                            {category.description}
                          </p>
                        )}
                        {category.rules && (
                          <p className="text-xs text-[var(--color-text-muted)] mb-4">
                            Rules: {category.rules}
                          </p>
                        )}
                        {category.contest_prizes && category.contest_prizes.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">Prizes:</p>
                            {category.contest_prizes
                              .sort((a: any, b: any) => a.rank_order - b.rank_order)
                              .map((prize: any) => {
                                const placeNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
                                const placeName = placeNames[prize.rank_order - 1] || `${prize.rank_order}th`;
                                return (
                                  <div key={prize.id} className="flex items-center justify-between p-2 bg-[var(--color-surface)] rounded">
                                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                      {placeName} Place
                                    </p>
                                    <p className="text-sm font-semibold text-[var(--color-primary)]">
                                      ${prize.payout_amount.toFixed(2)}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Required Hashtags */}
          <Card>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Required Hashtags
            </h2>
            <div className="flex flex-wrap gap-2">
              {contest.required_hashtags.map((hashtag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-sm font-medium"
                >
                  {hashtag}
                </span>
              ))}
            </div>
          </Card>

          {/* Submissions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                Submissions ({submissions.length})
              </h2>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Hashtag Status
                </label>
                <select
                  value={hashtagFilter}
                  onChange={(e) => setHashtagFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  <option value="">All</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="approved_manual">Approved Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Description Status
                </label>
                <select
                  value={descriptionFilter}
                  onChange={(e) => setDescriptionFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  <option value="">All</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="approved_manual">Approved Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Content Review
                </label>
                <select
                  value={contentReviewFilter}
                  onChange={(e) => setContentReviewFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Submissions Table */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-[var(--color-border)]/20 rounded animate-pulse" />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-[var(--color-text-muted)] text-center py-8">
                No submissions yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                        Rank
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                        User
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                        Stats
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission, index) => (
                      <tr
                        key={submission.id}
                        className="border-b border-[var(--color-border)] hover:bg-[var(--color-border)]/10"
                      >
                        <td className="py-3 px-4 text-[var(--color-text-primary)] font-medium">
                          #{index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-[var(--color-text-primary)]">
                            {submission.profiles?.display_name || submission.profiles?.email}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">
                          <div className="space-y-1">
                            <p>Views: {submission.views_count.toLocaleString()}</p>
                            <p>Likes: {submission.likes_count.toLocaleString()}</p>
                            <p>Comments: {submission.comments_count.toLocaleString()}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                                submission.hashtag_status
                              )}`}
                            >
                              Hashtag: {submission.hashtag_status}
                            </span>
                            <br />
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                                submission.content_review_status
                              )}`}
                            >
                              Review: {submission.content_review_status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/admin/review?submission=${submission.id}`}>
                            <Button variant="ghost" size="sm">
                              Review
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </PageSection>
    </Page>
  );
}

