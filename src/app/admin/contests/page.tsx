'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/Card';
import { Page, PageSection } from '../../components/layout';
import { Button } from '../../components/Button';
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
  created_at: string;
  stats: {
    total_submissions: number;
    verified_submissions: number;
    pending_review: number;
  };
  contest_prizes: Array<{
    id: string;
    name: string;
    payout_amount: number;
    rank_order: number;
  }>;
}

export default function AdminContestsPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (!isLoading && profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    if (profile?.role === 'admin') {
      fetchContests();
    }
  }, [user, profile, isLoading, router]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/admin/contests');
      if (!response.ok) {
        throw new Error('Failed to fetch contests');
      }
      const data = await response.json();
      setContests(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user || profile?.role !== 'admin') {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'upcoming':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'closed':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
                Contest Management
              </h1>
              <p className="text-[var(--color-text-muted)]">
                Create and manage fan edit contests
              </p>
            </div>
            <Link href="/admin/contests/create">
              <Button variant="primary" size="md">
                Create Contest
              </Button>
            </Link>
          </div>
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
                <Card key={i} className="h-32 animate-pulse" />
              ))}
            </div>
          ) : contests.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <p className="text-[var(--color-text-muted)] mb-4">
                  No contests yet. Create your first contest to get started.
                </p>
                <Link href="/admin/contests/create">
                  <Button variant="primary">Create Contest</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {contests.map((contest) => {
                const totalPrizePool = contest.contest_prizes?.reduce(
                  (sum, prize) => sum + Number(prize.payout_amount || 0),
                  0
                ) || 0;

                return (
                  <Link key={contest.id} href={`/admin/contests/${contest.id}`}>
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
                          {contest.movie_identifier && (
                            <p className="text-sm text-[var(--color-text-muted)] mb-2">
                              Movie: {contest.movie_identifier}
                            </p>
                          )}
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
                                {contest.stats.total_submissions}
                              </span>
                            </div>
                            <div>
                              <span className="text-[var(--color-text-muted)]">Verified: </span>
                              <span className="text-[var(--color-text-primary)] font-medium">
                                {contest.stats.verified_submissions}
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
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </PageSection>
    </Page>
  );
}

