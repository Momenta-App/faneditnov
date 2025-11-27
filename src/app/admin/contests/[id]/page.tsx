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
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

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
      setError(null);
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
      setContest(data.data);
    } catch (err) {
      console.error('Error fetching contest:', err);
      if (err instanceof Error && !err.message.includes('Access denied') && !err.message.includes('sign in')) {
        setError(err.message || 'Failed to load contest');
      }
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
      setSubmissionsError(null);
      const queryParams = new URLSearchParams();
      if (hashtagFilter) queryParams.append('hashtag_status', hashtagFilter);
      if (descriptionFilter) queryParams.append('description_status', descriptionFilter);
      if (contentReviewFilter) queryParams.append('content_review_status', contentReviewFilter);
      if (categoryFilter) queryParams.append('category_id', categoryFilter);
      queryParams.append('sort_by', 'views_count');
      queryParams.append('sort_order', 'desc');

      console.log('[Admin Contest Page] Fetching submissions:', {
        contestId,
        filters: { hashtagFilter, descriptionFilter, contentReviewFilter, categoryFilter },
      });

      const response = await authFetch(
        `/api/admin/contests/${contestId}/submissions?${queryParams.toString()}`,
      );
      
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
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[Admin Contest Page] Failed to fetch submissions:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          contestId,
        });
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('[Admin Contest Page] Submissions fetched:', {
        contestId,
        count: data.data?.length || 0,
        total: data.total || 0,
      });
      setSubmissions(data.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load submissions';
      console.error('[Admin Contest Page] Error in fetchSubmissions:', {
        error: errorMessage,
        contestId,
        err,
      });
      if (err instanceof Error && !err.message.includes('Access denied') && !err.message.includes('sign in')) {
        setSubmissionsError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setCategoryFilter(categoryId);
  };

  useEffect(() => {
    if (contestId) {
      fetchSubmissions();
    }
  }, [hashtagFilter, descriptionFilter, contentReviewFilter, contestId, categoryFilter]);

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

  const specificCategories =
    contest.contest_categories?.filter((cat: any) => !cat.is_general) ?? [];
  const generalCategories =
    contest.contest_categories?.filter((cat: any) => cat.is_general) ?? [];
  const rankingLabels: Record<string, string> = {
    manual: 'Manual Judging',
    views: 'Most Views',
    likes: 'Most Likes',
    comments: 'Most Comments',
    impact_score: 'Manual Judging',
  };
  const combinedCategories = [
    ...specificCategories.map((cat: any) => ({ ...cat, categoryType: 'specific' })),
    ...generalCategories.map((cat: any) => ({ ...cat, categoryType: 'general' })),
  ];

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
            <Link href="/admin/contests">
              <Button variant="ghost" size="xs" className="px-2 py-1 min-h-0 min-w-0 text-[10px]">
                ← Back to Contests
              </Button>
            </Link>
            <Link href={`/admin/contests/${contestId}/review`}>
              <Button variant="secondary" size="xs" className="px-2 py-1 min-h-0 min-w-0 text-[10px]">
                Review Submissions
              </Button>
            </Link>
            <Link href={`/admin/contests/${contestId}/edit`}>
              <Button variant="secondary" size="xs" className="px-2 py-1 min-h-0 min-w-0 text-[10px]">
                Edit Contest
              </Button>
            </Link>
            <Button
              variant="danger"
              size="xs"
              className="px-2 py-1 min-h-0 min-w-0 text-[10px]"
              onClick={handleDeleteContest}
              isLoading={isDeleting}
            >
              Delete Contest
            </Button>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-1">
            {contest.title}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] max-w-3xl">{contest.description}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <div>
              <p>Status</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] capitalize">
                {contest.status}
              </p>
            </div>
            <div>
              <p>Dates</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {formatDate(contest.start_date)} — {formatDate(contest.end_date)}
              </p>
            </div>
            <div>
              <p>Total Subs</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {contest.stats.total_submissions}
              </p>
            </div>
            <div>
              <p>Pending Review</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {contest.stats.pending_review}
              </p>
            </div>
          </div>
          {contest.movie_identifier && (
            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              Movie Identifier: <span className="text-[var(--color-text-primary)]">{contest.movie_identifier}</span>
            </p>
          )}
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 text-xs">
          {error && (
            <Card className="border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{error}</p>
            </Card>
          )}

          {/* Overview */}
          <Card className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p className="uppercase tracking-wide text-[10px] text-[var(--color-text-muted)] mb-2">
              Contest Overview
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px]">
              <div>
                <p className="text-[var(--color-text-muted)]">Status</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)] capitalize">{contest.status}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Window</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {formatDate(contest.start_date)} → {formatDate(contest.end_date)}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Total Subs</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {contest.stats.total_submissions}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Pending Review</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {contest.stats.pending_review}
                </p>
              </div>
              {contest.total_prize_pool !== undefined && contest.total_prize_pool > 0 && (
                <div>
                  <p className="text-[var(--color-text-muted)]">Prize Pool</p>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    ${contest.total_prize_pool.toFixed(2)}
                  </p>
                </div>
              )}
              {contest.movie_identifier && (
                <div>
                  <p className="text-[var(--color-text-muted)]">Identifier</p>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] break-all">
                    {contest.movie_identifier}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Requirements */}
          <Card className="p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              Required Hashtags
            </h2>
              <div className="flex flex-wrap gap-1">
                {contest.required_hashtags.map((hashtag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-[11px] font-medium"
                  >
                    {hashtag}
                  </span>
                ))}
              </div>
            </div>
            {contest.required_description_template && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Description template</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {contest.required_description_template}
                </p>
              </div>
            )}
          </Card>

          {combinedCategories.length > 0 && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Categories & Prizes</h2>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Sorted by display order • Two columns for quick scanning
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {combinedCategories
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any) => {
                    const placeNames = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
                    const categoryStyle =
                      category.categoryType === 'general'
                        ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)]';
                    return (
                      <div
                        key={category.id}
                        className={`text-left rounded border p-3 space-y-1 w-full ${categoryStyle}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                            {category.name}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                            {category.categoryType === 'general' && (
                              <span className="px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
                                Auto
                              </span>
                            )}
                            {category.ranking_method !== 'manual' && category.ranking_method !== 'shares' && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                                {rankingLabels[category.ranking_method] || category.ranking_method}
                              </span>
                            )}
                          </div>
                        </div>
                        {category.description && (
                          <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2">
                            {category.description}
                          </p>
                        )}
                        {category.rules && (
                          <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-2">
                            Rules: {category.rules}
                          </p>
                        )}
                        {category.contest_prizes && category.contest_prizes.length > 0 && (
                          <ul className="space-y-0.5 text-[11px] mt-1">
                            {category.contest_prizes
                              .sort((a: any, b: any) => a.rank_order - b.rank_order)
                              .map((prize: any) => {
                                const label = placeNames[prize.rank_order - 1] || `${prize.rank_order}th`;
                                return (
                                  <li key={prize.id} className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-[var(--color-text-primary)]">{label}</span>
                                    <span className="tabular-nums text-[var(--color-text-muted)]">
                                      ${prize.payout_amount.toFixed(2)}
                                    </span>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Submissions */}
          <Card className="p-4 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Submissions <span className="text-[10px] text-[var(--color-text-muted)]">({submissions.length})</span>
                </h2>
              </div>
              {submissionsError && (
                <div className="p-3 rounded border border-red-500/20 bg-red-500/5">
                  <p className="text-red-500 text-xs">{submissionsError}</p>
                </div>
              )}

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                {combinedCategories.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--color-text-primary)] mb-1 uppercase">
                      Category
                    </label>
                    <select
                      value={categoryFilter || ''}
                      onChange={(e) => handleCategorySelect(e.target.value || null)}
                      className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs"
                    >
                      <option value="">All</option>
                      {combinedCategories
                        .sort((a: any, b: any) => a.display_order - b.display_order)
                        .map((category: any) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-primary)] mb-1 uppercase">
                    Hashtag Status
                  </label>
                  <select
                    value={hashtagFilter}
                    onChange={(e) => setHashtagFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs"
                  >
                    <option value="">All</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved_manual">Approved Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-primary)] mb-1 uppercase">
                    Description Status
                  </label>
                  <select
                    value={descriptionFilter}
                    onChange={(e) => setDescriptionFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs"
                  >
                    <option value="">All</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved_manual">Approved Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-primary)] mb-1 uppercase">
                    Content Review
                  </label>
                  <select
                    value={contentReviewFilter}
                    onChange={(e) => setContentReviewFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-xs"
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
                <div className="space-y-2">
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
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left py-1.5 px-2 font-medium text-[var(--color-text-muted)]">
                          Rank
                        </th>
                        <th className="text-left py-1.5 px-2 font-medium text-[var(--color-text-muted)]">
                          User
                        </th>
                        <th className="text-left py-1.5 px-2 font-medium text-[var(--color-text-muted)]">
                          Stats
                        </th>
                        <th className="text-left py-1.5 px-2 font-medium text-[var(--color-text-muted)]">
                          Status
                        </th>
                        <th className="text-left py-1.5 px-2 font-medium text-[var(--color-text-muted)]">
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
                          <td className="py-1.5 px-2 text-[var(--color-text-primary)] font-semibold">
                            #{index + 1}
                          </td>
                          <td className="py-1.5 px-2">
                            <p className="text-[var(--color-text-primary)]">
                              {submission.profiles?.display_name || submission.profiles?.email}
                            </p>
                          </td>
                          <td className="py-1.5 px-2 text-[var(--color-text-muted)]">
                            <div className="space-y-0.5">
                              <p>Views: {submission.views_count.toLocaleString()}</p>
                              <p>Likes: {submission.likes_count.toLocaleString()}</p>
                              <p>Comments: {submission.comments_count.toLocaleString()}</p>
                            </div>
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="space-y-0.5">
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
                          <td className="py-1.5 px-2">
                            <Link href={`/admin/review?submission=${submission.id}`}>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="px-2 py-1 min-h-0 min-w-0 text-[10px]"
                              >
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

