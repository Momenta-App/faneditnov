'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin as isAdminRole } from '@/lib/role-utils';
import { ContestCard } from '../components/ContestCard';
import { Skeleton } from '../components/Skeleton';

interface Contest {
  id: string;
  title: string;
  description: string;
  slug?: string;
  movie_identifier?: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'live' | 'ended' | 'draft';
  visibility: 'open' | 'private_link_only';
  required_hashtags: string[];
  submission_count: number;
  total_prize_pool?: number;
  profile_image_url?: string;
  cover_image_url?: string;
  contest_prizes?: Array<{
    id: string;
    name: string;
    payout_amount: number;
    rank_order: number;
  }>;
}

function ContestCardSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      {/* Cover Image Skeleton */}
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-primary)]">
        <Skeleton className="h-full w-full" />
      </div>
      
      {/* Content Skeleton */}
      <div className="relative px-[var(--spacing-6)] pb-[var(--spacing-6)]">
        {/* Profile Picture - Overlapping the cover */}
        <div className="flex items-end mb-[var(--spacing-4)]" style={{ marginTop: '-60px' }}>
          <div className="w-20 flex-shrink-0" style={{ aspectRatio: '2/3' }}>
            <Skeleton className="w-full h-full rounded-2xl" />
          </div>
          <div className="ml-auto">
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
        
        {/* Title Skeleton */}
        <div className="mb-[var(--spacing-5)]">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        {/* Stats Skeleton */}
        <div className="flex gap-4 pt-[var(--spacing-4)] border-t border-[var(--color-border)]">
          <div className="flex-1 text-center">
            <Skeleton className="h-5 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
          <div className="flex-1 text-center">
            <Skeleton className="h-5 w-12 mx-auto mb-1" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContestsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [openContests, setOpenContests] = useState<Contest[]>([]);
  const [privateContests, setPrivateContests] = useState<Contest[]>([]);
  const [draftContests, setDraftContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = isAdminRole(profile?.role);

  const fetchContests = useCallback(async (forceHardRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Force router refresh if hard refresh requested
      if (forceHardRefresh) {
        router.refresh();
      }
      
      const params = new URLSearchParams({
        t: Date.now().toString(),
        _: Math.random().toString(36).substring(7), // Additional cache buster
      });
      if (isAdmin) {
        params.set('include_all', 'true');
      }
      const response = await fetch(`/api/contests?${params.toString()}`, {
        cache: 'no-store',
        method: 'GET',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest', // Some browsers respect this
        },
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.message || data.error || 'Failed to fetch contests';
        throw new Error(errorMessage);
      }
      // Handle both old format (data.data) and new format (separate sections)
      if (data.open_contests !== undefined) {
        setOpenContests(data.open_contests || []);
        setPrivateContests(data.private_contests || []);
        setDraftContests(data.draft_contests || []);
        // Combine all for backward compatibility
        setContests([
          ...(data.open_contests || []),
          ...(data.private_contests || []),
          ...(data.draft_contests || []),
        ]);
      } else {
        // Fallback to old format
        const allContests = data.data || [];
        setContests(allContests);
        setOpenContests(allContests.filter((c: Contest) => c.visibility === 'open'));
        setPrivateContests(allContests.filter((c: Contest) => c.visibility === 'private_link_only'));
        setDraftContests(isAdmin ? allContests.filter((c: Contest) => c.status === 'draft') : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, router]);

  useEffect(() => {
    fetchContests();
  }, [fetchContests, refreshKey]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);


  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading contests: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Fan Edit Contests
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
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

        {/* Content */}
        <div className="container-base max-w-[1440px] mx-auto">
          {loading ? (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <ContestCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Open Contests */}
              {openContests.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                      Open Contests
                    </h2>
                    <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                      Public contests available to everyone
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openContests.map((contest) => (
                      <ContestCard key={contest.id} contest={contest} />
                    ))}
                  </div>
                </div>
              )}

              {/* Private Contests */}
              {privateContests.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                      Private Contests
                    </h2>
                    <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                      Contests you have access to via private link
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {privateContests.map((contest) => (
                      <ContestCard key={contest.id} contest={contest} />
                    ))}
                  </div>
                </div>
              )}

              {/* Draft Contests (Admin Only) */}
              {isAdmin && draftContests.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                      Draft Contests
                    </h2>
                    <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                      Contests not yet published
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {draftContests.map((contest) => (
                      <ContestCard key={contest.id} contest={contest} />
                    ))}
                  </div>
                </div>
              )}

              {/* No Contests Message */}
              {openContests.length === 0 && privateContests.length === 0 && (!isAdmin || draftContests.length === 0) && (
                <div className="text-center py-12">
                  <p className="text-lg mb-4" style={{ color: 'var(--color-text-muted)' }}>No contests found</p>
                  {isAdmin && (
                    <Link href="/admin/contests/create">
                      <Button>
                        Create Your First Contest
                      </Button>
                    </Link>
                  )}
                  {!isAdmin && (
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Check back soon for new contests!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

