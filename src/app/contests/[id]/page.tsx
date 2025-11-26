'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import { Card } from '../../components/Card';
import { Page, PageSection } from '../../components/layout';
import { Button } from '../../components/Button';
import { ContestVideoPlayer } from '../../components/ContestVideoPlayer';
import { getContestVideoUrl } from '@/lib/storage-utils';
import { isAdmin as isAdminRole } from '@/lib/role-utils';

interface ContestCategory {
  id: string;
  name: string;
  description?: string;
  rules?: string;
  display_order: number;
  is_general?: boolean;
  ranking_method?: 'manual' | 'views' | 'likes' | 'comments' | 'shares' | 'impact_score';
}

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
  submission_count: number;
  total_prize_pool?: number;
  sub_contests?: Array<{ id: string; title: string; status: string }>;
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
  allow_multiple_submissions?: boolean;
  force_single_category?: boolean;
  require_social_verification?: boolean;
  require_mp4_upload?: boolean;
  public_submissions_visibility?: 'public_hide_metrics' | 'public_with_rankings' | 'private_judges_only';
}

export default function ContestDetailPage({ params }: { params: { id: string } }) {
  const { user, profile } = useAuth();
  const isAdmin = isAdminRole(profile?.role);
  const router = useRouter();
  const [contestId, setContestId] = useState<string | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubContest, setSelectedSubContest] = useState<string | null>(null);

  useEffect(() => {
    setContestId(params.id);
  }, [params]);

  useEffect(() => {
    if (contestId) {
      fetchContest();
      fetchSubmissions();
    }
  }, [contestId]);

  const fetchSubmissions = async () => {
    if (!contestId) return;
    try {
      const response = await fetch(`/api/contests/${contestId}/submissions-public`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.data || []);
      }
    } catch (err) {
      // Silently fail - submissions are optional
    }
  };

  const fetchContest = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contests/${contestId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contest');
      }
      const data = await response.json();
      setContest(data.data);
      // If there are sub-contests, select the first one by default
      if (data.data.sub_contests && data.data.sub_contests.length > 0) {
        setSelectedSubContest(data.data.sub_contests[0].id);
      } else {
        setSelectedSubContest(contestId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contest');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSubmitClick = () => {
    if (!user) {
      router.push('/auth/login?redirect=' + encodeURIComponent(`/contests/${contestId}/submit`));
      return;
    }

    const targetContestId = selectedSubContest || contestId;
    router.push(`/contests/${targetContestId}/submit`);
  };

  if (loading || !contest) {
    return (
      <Page>
        <PageSection variant="content">
          <div className="max-w-4xl mx-auto">
            <Card className="h-64 animate-pulse" />
          </div>
        </PageSection>
      </Page>
    );
  }

  const allowMultipleSubmissions = contest.allow_multiple_submissions ?? true;
  const forceSingleCategory = contest.force_single_category ?? false;
  const requireSocialVerification = contest.require_social_verification ?? false;
  const requireMp4Upload = contest.require_mp4_upload ?? false;
  const submissionVisibility = contest.public_submissions_visibility || 'public_hide_metrics';
  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Link href="/contests">
                <Button variant="ghost" size="sm">
                  ← Back to Contests
                </Button>
              </Link>
            </div>
            {isAdmin && (
              <Link href="/admin/contests/create">
                <Button variant="primary" size="sm">
                  Create Contest
                </Button>
              </Link>
            )}
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            {contest.title}
          </h1>
          <p className="text-[var(--color-text-muted)]">{contest.description}</p>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-4xl mx-auto space-y-6">
          {error && (
            <Card className="border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{error}</p>
            </Card>
          )}

          {/* Contest Info */}
          <Card>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Contest Details
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">Dates</p>
                <p className="text-[var(--color-text-primary)]">
                  {formatDate(contest.start_date)} - {formatDate(contest.end_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-muted)] mb-1">Status</p>
                <p className="text-[var(--color-text-primary)] capitalize">{contest.status}</p>
              </div>
              {contest.submission_count > 0 && (
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-1">Submissions</p>
                  <p className="text-[var(--color-text-primary)]">{contest.submission_count}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Sub-contests selector if multiple contests for same movie */}
          {contest.sub_contests && contest.sub_contests.length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Contest Categories
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                This movie has multiple contest categories. Please select one to submit your edit:
              </p>
              <div className="space-y-2">
                {contest.sub_contests.map((subContest) => (
                  <button
                    key={subContest.id}
                    onClick={() => setSelectedSubContest(subContest.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedSubContest === subContest.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    }`}
                  >
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {subContest.title}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] capitalize">
                      {subContest.status}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          )}

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
                Total prize money across all categories
              </p>
            </Card>
          )}

          {/* Specific Categories with Prizes */}
          {contest.contest_categories && contest.contest_categories.filter((cat: any) => !cat.is_general).length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Contest Categories & Prizes
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Select a category when submitting your edit
              </p>
              <div className="space-y-6">
                {contest.contest_categories
                  .filter((cat: any) => !cat.is_general)
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any) => (
                    <div
                      key={category.id}
                      className="p-4 border border-[var(--color-border)] rounded-lg"
                    >
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                        {category.name}
                      </h3>
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
                  ))}
              </div>
            </Card>
          )}

          {/* General Categories (Auto-Entry) */}
          {contest.contest_categories && contest.contest_categories.filter((cat: any) => cat.is_general).length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                General Categories (Auto-Entry)
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                All submissions are automatically entered in these categories
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

          {/* Legacy Prizes (if no categories but prizes exist - backward compatibility) */}
          {(!contest.contest_categories || contest.contest_categories.length === 0) &&
            Array.isArray(contest.contest_prizes) &&
            contest.contest_prizes.length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Prizes
              </h2>
              <div className="space-y-2">
                {[...contest.contest_prizes]
                  .sort((a, b) => a.rank_order - b.rank_order)
                  .map((prize) => {
                    const placeNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
                    const placeName = placeNames[prize.rank_order - 1] || `${prize.rank_order}th`;
                    return (
                    <div
                      key={prize.id}
                      className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg"
                    >
                        <p className="font-medium text-[var(--color-text-primary)]">
                          {placeName} Place
                        </p>
                      <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        ${Number(prize.payout_amount).toFixed(2)}
                      </p>
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
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Your submission must include all of these hashtags:
            </p>
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

          {/* Description Template */}
          {contest.required_description_template && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Description Requirements
              </h2>
              <p className="text-[var(--color-text-primary)]">
                {contest.required_description_template}
              </p>
            </Card>
          )}

          {/* Submission Rules */}
          <Card>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Submission Rules
            </h2>
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Allow multiple submissions per user</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {allowMultipleSubmissions ? 'Yes' : 'No'}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Force single category selection</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {forceSingleCategory ? 'Yes' : 'No'}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Require social account verification</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {requireSocialVerification ? 'Yes' : 'No'}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Require MP4 upload</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {requireMp4Upload ? 'Yes' : 'No'}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Submission visibility</span>
                <span className="font-medium text-[var(--color-text-primary)] capitalize">
                  {(() => {
                    switch (submissionVisibility) {
                      case 'public_with_rankings':
                        return 'Public with rankings';
                      case 'private_judges_only':
                        return 'Private, only judges';
                      default:
                        return 'Public but hide metrics';
                    }
                  })()}
                </span>
              </p>
            </div>
          </Card>

          {/* Submit Button */}
          {contest.status === 'live' && (
            <Card>
              {user ? (
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                    Submit Your Edit
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    Upload your fan edit to compete in this contest.
                  </p>
                  <Button variant="primary" size="lg" onClick={handleSubmitClick}>
                    Submit Your Edit
                  </Button>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                    Login to Submit
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    You must be logged in to submit your edit to this contest.
                  </p>
                  <Link href={`/auth/login?redirect=${encodeURIComponent(`/contests/${contestId}/submit`)}`}>
                    <Button variant="primary" size="lg">
                      Login to Submit
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          )}

          {/* Approved Submissions */}
          {submissions.length > 0 && (
            <Card>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Top Submissions
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Ranked by top views
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {submissions.map((submission, index) => {
                  // Construct video URL from Supabase storage
                  const videoUrl = submission.mp4_bucket && submission.mp4_path
                    ? getContestVideoUrl(submission.mp4_bucket, submission.mp4_path)
                    : null;

                  return (
                    <div
                      key={submission.id}
                      className="border border-[var(--color-border)] rounded-lg overflow-hidden"
                    >
                      {videoUrl && (
                        <ContestVideoPlayer videoUrl={videoUrl} />
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Views: {submission.views_count.toLocaleString()}
                          </span>
                        </div>
                        {submission.profiles?.display_name && (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            by {submission.profiles.display_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        </div>
      </PageSection>
    </Page>
  );
}

