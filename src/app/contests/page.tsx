'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../components/Card';
import { Page, PageSection } from '../components/layout';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin as isAdminRole } from '@/lib/role-utils';

interface Contest {
  id: string;
  title: string;
  description: string;
  movie_identifier?: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'live' | 'closed';
  required_hashtags: string[];
  submission_count: number;
  contest_prizes: Array<{
    id: string;
    name: string;
    payout_amount: number;
    rank_order: number;
  }>;
}

export default function ContestsPage() {
  const { profile } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = isAdminRole(profile?.role);

  useEffect(() => {
    const controller = new AbortController();

    const fetchContests = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          t: Date.now().toString(),
        });
        if (isAdmin) {
          params.set('include_all', 'true');
        }
        const response = await fetch(`/api/contests?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store',
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to fetch contests');
        }
        const data = await response.json();
        setContests(data.data || []);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load contests');
      } finally {
        setLoading(false);
      }
    };

    fetchContests();

    return () => controller.abort();
  }, [isAdmin]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'upcoming':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  // Group contests by movie if they have movie_identifier
  const groupedContests = contests.reduce((acc, contest) => {
    const key = contest.movie_identifier || 'other';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(contest);
    return acc;
  }, {} as Record<string, Contest[]>);

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-6xl mx-auto flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
              Fan Edit Contests
            </h1>
            <p className="text-[var(--color-text-muted)]">
              Submit your fan edits and compete for prizes
            </p>
          </div>
          {isAdmin && (
            <Link href="/admin/contests/create">
              <Button variant="primary" size="sm">
                Create Contest
              </Button>
            </Link>
          )}
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-6xl mx-auto">
          {error && (
            <Card className="mb-6 border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{error}</p>
            </Card>
          )}

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-32 animate-pulse">
                  <div />
                </Card>
              ))}
            </div>
          ) : contests.length === 0 ? (
            <Card>
              <div className="text-center py-12 space-y-2">
                <p className="text-[var(--color-text-muted)]">
                  No contests available at the moment. Check back soon!
                </p>
                {isAdmin && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This public page only lists live and upcoming contests. Closed or draft contests remain visible on the admin dashboard.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedContests).map(([movieKey, movieContests]) => (
                <div key={movieKey}>
                  {movieKey !== 'other' && (
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
                      {movieContests[0].movie_identifier}
                    </h2>
                  )}
                  <div className="space-y-4">
                    {movieContests.map((contest) => {
                      const totalPrizePool = contest.contest_prizes?.reduce(
                        (sum, prize) => sum + Number(prize.payout_amount || 0),
                        0
                      ) || 0;

                      return (
                        <Link key={contest.id} href={`/contests/${contest.id}`}>
                          <Card className="hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                                    {contest.title}
                                  </h2>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                      contest.status
                                    )}`}
                                  >
                                    {contest.status}
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-2">
                                  {contest.description}
                                </p>
                                <div className="flex items-center gap-6 text-sm">
                                  <div>
                                    <span className="text-[var(--color-text-muted)]">Dates: </span>
                                    <span className="text-[var(--color-text-primary)]">
                                      {formatDate(contest.start_date)} - {formatDate(contest.end_date)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[var(--color-text-muted)]">Submissions: </span>
                                    <span className="text-[var(--color-text-primary)] font-medium">
                                      {contest.submission_count}
                                    </span>
                                  </div>
                                  {totalPrizePool > 0 && (
                                    <div>
                                      <span className="text-[var(--color-text-muted)]">Prize Pool: </span>
                                      <span className="text-[var(--color-text-primary)] font-medium">
                                        ${totalPrizePool.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button variant="primary" size="sm">
                                View Contest
                              </Button>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageSection>
    </Page>
  );
}

