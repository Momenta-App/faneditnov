'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card } from '../../components/Card';
import { Page, PageSection } from '../../components/layout';
import { Button } from '../../components/Button';
import { ContestVideoPlayer } from '../../components/ContestVideoPlayer';
import { ContestSubmissionCard } from '../../components/ContestSubmissionCard';
import { VideoCard } from '../../components/VideoCard';
import { Video } from '../../types/data';
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

interface ContestAssetLink {
  id: string;
  name: string;
  url: string;
  display_order: number;
}

interface Contest {
  id: string;
  title: string;
  description: string;
  movie_identifier?: string;
  slug?: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'live' | 'ended' | 'draft';
  visibility?: 'open' | 'private_link_only';
  required_hashtags: string[];
  required_description_template?: string;
  submission_count: number;
  total_prize_pool?: number;
  profile_image_url?: string;
  cover_image_url?: string;
  display_stats?: boolean;
  contest_asset_links?: ContestAssetLink[];
  sub_contests?: Array<{ id: string; title: string; status: string; slug?: string }>;
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
  contest_prizes?: Array<{
    id: string;
    name: string;
    description?: string;
    payout_amount: number;
    rank_order: number;
  }>;
}

/**
 * Determine the submission status based on check order:
 * Hashtag → Description → Ownership → Content Approval
 */
function getSubmissionStatus(submission: any): string {
  // Order: Hashtag → Description → Ownership → Content Approval
  
  // 1. Check Hashtag
  if (submission.hashtag_status === 'pending_review') {
    return 'Hashtag Pending';
  }
  if (submission.hashtag_status === 'fail') {
    return 'Hashtag Rejected';
  }
  
  // 2. Check Description (only if hashtag passed)
  if (submission.description_status === 'pending_review') {
    return 'Description Pending';
  }
  if (submission.description_status === 'fail') {
    return 'Description Rejected';
  }
  
  // 3. Check Ownership (only if hashtag and description passed)
  const ownershipStatus = submission.mp4_ownership_status || submission.verification_status || 'pending';
  if (ownershipStatus === 'pending' || ownershipStatus === 'contested') {
    return 'Ownership Pending';
  }
  if (ownershipStatus === 'failed') {
    return 'Ownership Rejected';
  }
  
  // 4. Check Content Approval (only if all previous passed)
  if (submission.content_review_status === 'pending') {
    return 'Content Approval Pending';
  }
  if (submission.content_review_status === 'rejected') {
    return 'Content Approval Rejected';
  }
  
  // All checks passed
  if (submission.content_review_status === 'approved') {
    return 'Approved';
  }
  
  return 'Pending';
}

export default function ContestDetailPage({ params }: { params: { id: string } }) {
  const { user, profile, session } = useAuth();
  const isAdmin = isAdminRole(profile?.role);
  const router = useRouter();
  const [contestId, setContestId] = useState<string | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [userSubmissionsLoading, setUserSubmissionsLoading] = useState(false);
  const [userSubmissionsError, setUserSubmissionsError] = useState<string | null>(null);
  const [allSubmissionsLoading, setAllSubmissionsLoading] = useState(false);
  const [allSubmissionsError, setAllSubmissionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubContest, setSelectedSubContest] = useState<string | null>(null);
  const [userSubmissionsExpanded, setUserSubmissionsExpanded] = useState(true);
  const [allSubmissionsExpanded, setAllSubmissionsExpanded] = useState(true);
  const [userSubmissionsCategoryFilter, setUserSubmissionsCategoryFilter] = useState<string | null>(null);
  const [allSubmissionsCategoryFilter, setAllSubmissionsCategoryFilter] = useState<string | null>(null);
  const [submissionsOffset, setSubmissionsOffset] = useState(0);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsHasMore, setSubmissionsHasMore] = useState(false);
  const [submissionsLoadingMore, setSubmissionsLoadingMore] = useState(false);

  useEffect(() => {
    setContestId(params.id);
  }, [params]);

  const sessionToken = session?.access_token ?? null;

  const fetchUserSubmissions = useCallback(async () => {
    if (!contestId || !user) return;
    try {
      setUserSubmissionsLoading(true);
      setUserSubmissionsError(null);
      const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;
      const response = await fetch(`/api/user/submissions?contest_id=${contestId}`, {
        cache: 'no-store',
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log back in.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch your submissions');
      }
      const data = await response.json();
      
      // Safety filter: ensure all submissions belong to this contest
      // Use contest.id (UUID) if available for filtering
      // If contest not loaded yet, trust the API (it already filters by contest_id)
      const rawData = data.data || [];
      let filteredData = rawData;
      
      console.log('[ContestDetailPage] User submissions raw data:', {
        count: rawData.length,
        contestId: contestId,
        contestLoaded: !!contest,
        contestIdFromContest: contest?.id,
        submissions: rawData.map((s: any) => ({
          id: s.id,
          contest_id: s.contest_id,
          user_id: s.user_id,
        })),
      });
      
      if (contest?.id) {
        // We have the contest UUID, so we can filter properly
        filteredData = rawData.filter((submission: any) => {
          if (submission.contest_id && submission.contest_id !== contest.id) {
            console.warn('[ContestDetailPage] Filtering out user submission from wrong contest:', {
              submissionId: submission.id,
              submissionContestId: submission.contest_id,
              expectedContestId: contest.id,
              currentContestId: contestId,
            });
            return false;
          }
          return true;
        });
        console.log('[ContestDetailPage] After UUID filter:', {
          before: rawData.length,
          after: filteredData.length,
        });
      } else {
        // Contest not loaded yet - trust the API filtering
        // The API already filters by contest_id, so submissions should be correct
        console.log('[ContestDetailPage] Contest not loaded yet for user submissions, trusting API filtering. Raw data:', {
          count: rawData.length,
          firstSubmission: rawData[0] ? {
            id: rawData[0].id,
            contest_id: rawData[0].contest_id,
          } : null,
        });
      }
      
      console.log('[ContestDetailPage] User submissions fetched:', {
        rawCount: rawData.length,
        afterContestFilter: filteredData.length,
        contestId,
        contestLoaded: !!contest,
        finalSubmissions: filteredData.map((s: any) => ({
          id: s.id,
          contest_id: s.contest_id,
        })),
      });
      setUserSubmissions(filteredData);
      // Clear error if we successfully got an empty array (no submissions is valid)
      if (filteredData.length === 0) {
        setUserSubmissionsError(null);
      }
    } catch (err) {
      setUserSubmissionsError(err instanceof Error ? err.message : 'Failed to load your submissions');
    } finally {
      setUserSubmissionsLoading(false);
    }
  }, [contestId, user, sessionToken]);

  useEffect(() => {
    if (contestId) {
      fetchContest();
      fetchSubmissions();
    }
  }, [contestId]);

  useEffect(() => {
    if (user && contestId) {
      fetchUserSubmissions();
    } else {
      setUserSubmissions([]);
    }
  }, [user, contestId, fetchUserSubmissions]);

  // Re-filter user submissions when contest loads (to use correct UUID for filtering)
  useEffect(() => {
    if (contest?.id) {
      setUserSubmissions(prev => {
        console.log('[ContestDetailPage] Re-filter useEffect triggered:', {
          contestId: contest.id,
          currentSubmissionsCount: prev.length,
          submissions: prev.map((s: any) => ({
            id: s.id,
            contest_id: s.contest_id,
          })),
        });
        
        if (prev.length === 0) {
          console.log('[ContestDetailPage] No submissions to re-filter');
          return prev;
        }
        
        const filtered = prev.filter((submission: any) => {
          if (submission.contest_id && submission.contest_id !== contest.id) {
            console.warn('[ContestDetailPage] Re-filtering: Removing user submission from wrong contest:', {
              submissionId: submission.id,
              submissionContestId: submission.contest_id,
              expectedContestId: contest.id,
            });
            return false;
          }
          console.log('[ContestDetailPage] Re-filtering: Keeping submission:', {
            submissionId: submission.id,
            submissionContestId: submission.contest_id,
            expectedContestId: contest.id,
            match: submission.contest_id === contest.id,
          });
          return true;
        });
        
        console.log('[ContestDetailPage] Re-filter result:', {
          before: prev.length,
          after: filtered.length,
          filteredOut: prev.length - filtered.length,
        });
        
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }
  }, [contest?.id]);

  // Track private contest access when page loads
  useEffect(() => {
    if (contest && contest.visibility === 'private_link_only' && user) {
      // Track access asynchronously (don't block page load)
      fetch(`/api/contests/${contestId}/access`, {
        method: 'POST',
        credentials: 'include',
      }).catch((err) => {
        console.error('Error tracking contest access:', err);
        // Don't show error to user - access tracking is not critical
      });
    }
  }, [contest, contestId, user]);

  const fetchSubmissions = async (categoryId?: string | null, offset: number = 0, append: boolean = false) => {
    if (!contestId) return;
    try {
      if (append) {
        setSubmissionsLoadingMore(true);
      } else {
        setAllSubmissionsLoading(true);
        setSubmissionsOffset(0);
      }
      setAllSubmissionsError(null);
      
      // Build URL - handle both UUID and slug
      const apiPath = `/api/contests/${contestId}/submissions-public`;
      const url = new URL(apiPath, window.location.origin);
      if (categoryId) {
        url.searchParams.set('category_id', categoryId);
      }
      url.searchParams.set('limit', '50');
      url.searchParams.set('offset', offset.toString());
      
      console.log('[ContestDetailPage] Fetching submissions:', {
        contestId,
        categoryId: categoryId || 'all',
        offset,
        append,
        url: url.toString(),
      });
      
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        credentials: 'include',
      });
      
      if (!response.ok) {
        // If it's a 404 or empty result, that's fine - just return empty array
        if (response.status === 404) {
          console.log('[ContestDetailPage] No submissions found (404)');
          setSubmissions([]);
          setSubmissionsTotal(0);
          setSubmissionsHasMore(false);
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        const errorCode = errorData.code || '';
        const errorHint = errorData.hint || '';
        
        console.error('[ContestDetailPage] API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          code: errorCode,
          hint: errorHint,
          fullError: errorData,
        });
        
        // Create a more detailed error message
        let detailedError = errorMessage;
        if (errorCode) {
          detailedError += ` (Code: ${errorCode})`;
        }
        if (errorHint && process.env.NODE_ENV === 'development') {
          detailedError += ` - ${errorHint}`;
        }
        
        throw new Error(detailedError);
      }
      
      const data = await response.json();
      
      // If we got an empty result, that's fine - don't treat it as an error
      if (!data.data || data.data.length === 0) {
        console.log('[ContestDetailPage] No submissions found (empty result)');
        setSubmissions([]);
        setSubmissionsTotal(0);
        setSubmissionsHasMore(false);
        return;
      }
      
      // CRITICAL: Safety filter - ensure all submissions belong to this contest
      // Use contest.id (UUID) if available for filtering
      // If contest not loaded yet, trust the API (it already filters by contest_id)
      const rawData = data.data || [];
      let filteredData = rawData;
      
      if (contest?.id) {
        // We have the contest UUID, so we can filter properly
        filteredData = rawData.filter((submission: any) => {
          // If contest_id exists and doesn't match, filter it out
          if (submission.contest_id) {
            if (submission.contest_id !== contest.id) {
              console.warn('[ContestDetailPage] Filtering out submission from wrong contest:', {
                submissionId: submission.id,
                submissionContestId: submission.contest_id,
                expectedContestId: contest.id,
                currentContestId: contestId,
              });
              return false;
            }
          } else {
            // If contest_id is missing, log a warning but include it (might be a data issue)
            console.warn('[ContestDetailPage] Submission missing contest_id:', {
              submissionId: submission.id,
              expectedContestId: contest.id,
              currentContestId: contestId,
            });
          }
          return true;
        });
      } else {
        // Contest not loaded yet - trust the API filtering
        // The API already filters by contest_id, so submissions should be correct
        console.log('[ContestDetailPage] Contest not loaded yet, trusting API filtering');
      }
      
      // Additional check: verify we're not showing submissions from other contests
      const wrongContestCount = rawData.length - filteredData.length;
      if (wrongContestCount > 0) {
        console.error('[ContestDetailPage] WARNING: Filtered out', wrongContestCount, 'submissions from wrong contest');
      }
      
      console.log('[ContestDetailPage] Submissions fetched:', {
        rawCount: rawData.length,
        afterContestFilter: filteredData.length,
        contestId,
        filteredOut: wrongContestCount,
        total: data.total,
        hasMore: data.hasMore,
      });
      
      if (append) {
        setSubmissions(prev => [...prev, ...filteredData]);
      } else {
        setSubmissions(filteredData);
      }
      setSubmissionsTotal(data.total || 0);
      setSubmissionsHasMore(data.hasMore || false);
      setSubmissionsOffset(offset);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load submissions';
      // Only set error if it's a real error, not just an empty result
      if (!errorMessage.includes('404') && !errorMessage.includes('No submissions')) {
        setAllSubmissionsError(errorMessage);
      } else {
        setAllSubmissionsError(null);
      }
      if (!append) {
        setSubmissions([]);
        setSubmissionsTotal(0);
        setSubmissionsHasMore(false);
      }
      console.error('[ContestDetailPage] Error fetching submissions:', err);
    } finally {
      setAllSubmissionsLoading(false);
      setSubmissionsLoadingMore(false);
    }
  };

  const loadMoreSubmissions = () => {
    if (!submissionsLoadingMore && submissionsHasMore) {
      const nextOffset = submissionsOffset + 50;
      fetchSubmissions(allSubmissionsCategoryFilter, nextOffset, true);
    }
  };

  // Map contest submission to Video format for VideoCard
  const mapSubmissionToVideo = (submission: any): Video => {
    // Debug: Log submission structure to understand data format
    if (!submission.profiles && submission.user_id) {
      console.warn('[ContestDetailPage] Submission missing profiles data:', {
        submissionId: submission.id,
        userId: submission.user_id,
        hasProfiles: !!submission.profiles,
        submissionKeys: Object.keys(submission),
      });
    }
    
    // Handle profiles - could be an object or array
    let profileData = null;
    if (submission.profiles) {
      profileData = Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles;
    }
    
    const creator = profileData ? {
      id: profileData.id || submission.user_id || '',
      username: profileData.display_name || profileData.email || profileData.username || 'Unknown',
      avatar: profileData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.display_name || profileData.email || profileData.username || 'U')}&background=120F23&color=fff`,
      verified: profileData.is_verified || false,
    } : {
      id: submission.user_id || '',
      username: 'Unknown',
      avatar: 'https://ui-avatars.com/api/?name=U&background=120F23&color=fff',
      verified: false,
    };

    // Get video data from videos_hot
    const videoHot = submission.videos_hot;
    const videoUrl = videoHot?.video_url || videoHot?.url || '';
    
    // Use cover_url or thumbnail_url from videos_hot
    let thumbnail = videoHot?.cover_url || videoHot?.thumbnail_url || '';
    
    // Fallback: Generate thumbnail URL based on platform and video URL
    if (!thumbnail && videoUrl) {
      if (videoUrl.includes('tiktok.com')) {
        // TikTok thumbnail - would need to be fetched or use a service
        thumbnail = `https://www.tiktok.com/api/img/?itemId=${videoHot?.video_id || videoHot?.post_id || ''}`;
      } else if (videoUrl.includes('instagram.com')) {
        // Instagram thumbnail
        thumbnail = '';
      } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        // YouTube thumbnail
        const videoId = videoHot?.video_id || videoHot?.post_id || videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || '';
        thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
      }
    }

    // Use default thumbnail if none found
    if (!thumbnail) {
      thumbnail = 'https://via.placeholder.com/400x600?text=Video';
    }

    return {
      id: videoHot?.video_id || submission.id.toString(),
      postId: videoHot?.post_id || videoHot?.video_id || submission.id.toString(),
      title: videoHot?.caption || videoHot?.description || videoUrl || 'Contest Submission',
      description: videoHot?.description || '',
      thumbnail,
      videoUrl,
      platform: (videoHot?.platform as 'tiktok' | 'instagram' | 'youtube') || 'unknown',
      creator,
      views: videoHot?.views_count || 0,
      likes: videoHot?.likes_count || 0,
      comments: videoHot?.comments_count || 0,
      shares: videoHot?.shares_count || 0,
      saves: videoHot?.collect_count || 0,
      impact: Number(videoHot?.impact_score) || 0,
      duration: 0,
      createdAt: submission.created_at || new Date().toISOString(),
      hashtags: [],
    };
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

  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'waiting_review':
      case 'pending':
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'failed':
      case 'rejected':
      case 'fail':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'contested':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getProcessingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      uploaded: 'Uploaded',
      fetching_stats: 'Fetching stats',
      checking_hashtags: 'Checking hashtags',
      checking_description: 'Checking description',
      waiting_review: 'Waiting review',
      approved: 'Approved',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter submissions by category and ensure they belong to current contest
  const filterSubmissionsByCategory = (submissions: any[], categoryId: string | null) => {
    // First, filter by contest_id to ensure we only show submissions for this contest
    // Use contest.id (UUID) if available, otherwise trust the submissions (API already filtered)
    const expectedContestId = contest?.id || contestId;
    let filtered = submissions.filter((submission) => {
      // Safety check: ensure submission belongs to current contest
      // Only filter if we have the contest UUID, otherwise trust the API filtering
      if (contest?.id && submission.contest_id && submission.contest_id !== contest.id) {
        console.warn('[ContestDetailPage] Filtering out submission from wrong contest:', {
          submissionId: submission.id,
          submissionContestId: submission.contest_id,
          expectedContestId: contest.id,
          currentContestId: contestId,
        });
        return false;
      }
      return true;
    });
    
    // Then filter by category if specified
    if (!categoryId) {
      return filtered;
    }
    
    console.log('[ContestDetailPage] Filtering by category:', {
      categoryId,
      totalSubmissions: filtered.length,
    });
    
    const categoryFiltered = filtered.filter((submission) => {
      const categories = submission.contest_submission_categories || [];
      
      // Debug logging for first submission
      if (filtered.indexOf(submission) === 0) {
        console.log('[ContestDetailPage] Sample submission categories:', {
          submissionId: submission.id,
          categories: categories.map((c: any) => ({
            category_id: c.category_id,
            is_primary: c.is_primary,
            categoryName: c.contest_categories?.name,
          })),
          lookingFor: categoryId,
        });
      }
      
      // Check if submission has this category
      const hasCategory = categories.some((csc: any) => {
        // Handle both direct category_id and nested structure
        const catId = csc.category_id || csc.contest_categories?.id;
        return catId === categoryId || String(catId) === String(categoryId);
      });
      
      if (!hasCategory && filtered.indexOf(submission) < 3) {
        console.log('[ContestDetailPage] Submission does not have category:', {
          submissionId: submission.id,
          submissionCategories: categories.map((c: any) => c.category_id || c.contest_categories?.id),
          lookingFor: categoryId,
        });
      }
      
      return hasCategory;
    });
    
    console.log('[ContestDetailPage] Category filter result:', {
      categoryId,
      beforeFilter: filtered.length,
      afterFilter: categoryFiltered.length,
    });
    
    return categoryFiltered;
  };

  if (loading || !contest) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="h-64 w-64 animate-pulse rounded-lg" style={{ background: 'var(--color-surface)' }} />
        </div>
      </div>
    );
  }

  const allowMultipleSubmissions = contest.allow_multiple_submissions ?? true;
  const forceSingleCategory = contest.force_single_category ?? false;
  const requireSocialVerification = contest.require_social_verification ?? false;
  const requireMp4Upload = contest.require_mp4_upload ?? false;
  const submissionVisibility = contest.public_submissions_visibility || 'public_hide_metrics';
  const displayStats = contest.display_stats ?? true;
  const assetLinks = contest.contest_asset_links || [];

  const handleSubmitClick = () => {
    if (!user) {
      const submitUrl = contest?.slug ? `/contests/${contest.slug}/submit` : `/contests/${contestId}/submit`;
    router.push('/auth/login?redirect=' + encodeURIComponent(submitUrl));
      return;
    }

    const targetContestId = selectedSubContest || contestId;
    const targetContest = contest?.sub_contests?.find((sc: any) => sc.id === targetContestId);
    const submitUrl = targetContest?.slug ? `/contests/${targetContest.slug}/submit` : `/contests/${targetContestId}/submit`;
    router.push(submitUrl);
  };

  const handleLaunchContest = async () => {
    if (!isAdmin && contest?.created_by !== user?.id) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/contests/${contestId}/launch`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to launch contest');
      }

      // Refresh the contest data
      fetchContest();
    } catch (err) {
      console.error('Error launching contest:', err);
      alert(err instanceof Error ? err.message : 'Failed to launch contest');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Netflix-style Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Image with Gradient Overlay */}
        {contest.cover_image_url && (
          <div className="absolute inset-0 z-0">
            <Image
              src={contest.cover_image_url}
              alt={contest.title}
              fill
              className="object-cover"
              priority
            />
            <div 
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.3) 100%),
                  linear-gradient(to bottom, transparent 0%, transparent 20%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.8) 80%, var(--color-background) 95%, var(--color-background) 100%)
                `
              }}
            />
          </div>
        )}
        
        {/* Hero Content - Netflix Style */}
        <div className="relative z-10 container-page pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-32 lg:pb-24">
          <div className="flex flex-col lg:flex-row items-end gap-8 lg:gap-12">
            {/* Movie Poster - Vertical Rectangle (2:3 aspect ratio) */}
            {contest.profile_image_url && (
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative flex-shrink-0 w-32 sm:w-40 md:w-48 lg:w-56 xl:w-64"
                style={{
                  aspectRatio: '2/3', // Standard movie poster aspect ratio
                }}
              >
                <div className="relative w-full h-full rounded-lg overflow-hidden shadow-2xl"
                  style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  <Image
                    src={contest.profile_image_url}
                    alt={contest.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, (max-width: 1024px) 192px, (max-width: 1280px) 224px, 256px"
                  />
                </div>
              </motion.div>
            )}
            
            {/* Text Content - Beside Poster */}
            <div className="flex-1 flex flex-col justify-end pb-4 lg:pb-6">
              {/* Contest Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6"
                style={{ 
                  color: '#ffffff',
                  textShadow: '0 2px 20px rgba(0,0,0,0.8)'
                }}
              >
                {contest.title}
              </motion.h1>
              
              {/* Description */}
              {contest.description && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-base sm:text-lg lg:text-xl max-w-2xl mb-6 leading-relaxed"
                  style={{ 
                    color: 'rgba(255,255,255,0.9)',
                    textShadow: '0 1px 10px rgba(0,0,0,0.5)'
                  }}
                >
                  {contest.description}
                </motion.p>
              )}

              {/* Contest Dates and Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap items-center gap-4 mb-6"
              >
                <span className="text-sm sm:text-base font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {formatDate(contest.start_date)} - {formatDate(contest.end_date)}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${
                    contest.status === 'live'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : contest.status === 'upcoming'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : contest.status === 'ended'
                      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      : contest.status === 'draft'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  {contest.status === 'ended' ? 'ENDED' : contest.status.toUpperCase()}
                </span>
              </motion.div>
            </div>
          </div>

          {/* Action Buttons Row - Below Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap items-center gap-4 mt-8"
          >
            {/* Submit Video Button - Only show for live contests */}
            {contest.status === 'live' && (
              <div>
                {user ? (
                  <Button 
                    variant="primary" 
                    size="lg" 
                    onClick={handleSubmitClick}
                    className="px-6 py-3 text-base sm:text-lg font-bold"
                  >
                    🎬 Submit Your Edit
                  </Button>
                ) : (
                  <Link href={`/auth/login?redirect=${encodeURIComponent(contest?.slug ? `/contests/${contest.slug}/submit` : `/contests/${contestId}/submit`)}`}>
                    <Button 
                      variant="primary" 
                      size="lg"
                      className="px-6 py-3 text-base sm:text-lg font-bold"
                    >
                      🔐 Login to Submit
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* Launch Contest Button - Only show for draft contests (admin/creator only) */}
            {contest.status === 'draft' && (isAdmin || contest.created_by === user?.id) && (
              <Button 
                variant="primary" 
                size="lg" 
                onClick={handleLaunchContest}
                className="px-6 py-3 text-base sm:text-lg font-bold"
              >
                🚀 Launch Contest
              </Button>
            )}

            {/* Asset Links - In same row */}
            {assetLinks.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {assetLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-lg font-medium transition-all hover:scale-105"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(10px)',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}
                  >
                    📎 {link.name}
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Premium Stats Section - Only show if display_stats is true */}
      {displayStats && (
        <div className="relative -mt-16 z-20">
          <div className="container-page">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0 }}
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)'
                }}
              >
                <div className="relative z-10">
                  <p className="text-sm sm:text-base font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Submissions
                  </p>
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {contest.submission_count || 0}
                  </p>
                </div>
              </motion.div>
              
              {contest.total_prize_pool && contest.total_prize_pool > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  <div className="relative z-10">
                    <p className="text-sm sm:text-base font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                      Prize Pool
                    </p>
                    <p className="text-3xl sm:text-4xl lg:text-5xl font-bold" style={{ color: 'var(--color-primary)' }}>
                      ${contest.total_prize_pool.toFixed(0)}
                    </p>
                  </div>
                </motion.div>
              )}
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)'
                }}
              >
                <div className="relative z-10">
                  <p className="text-sm sm:text-base font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Status
                  </p>
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-bold capitalize" style={{ color: 'var(--color-text-primary)' }}>
                    {contest.status === 'ended' ? 'Ended' : contest.status}
                  </p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)'
                }}
              >
                <div className="relative z-10">
                  <p className="text-sm sm:text-base font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Ends
                  </p>
                  <p className="text-lg sm:text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatDate(contest.end_date)}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Contest Details Section */}
      <div className="container-page py-8 sm:py-12 lg:py-16">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10"
            style={{
              background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
              Contest Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Dates */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Contest Dates
                </p>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {formatDate(contest.start_date)} - {formatDate(contest.end_date)}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Status
                </p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                    contest.status === 'live'
                      ? 'bg-green-500/20 text-green-500 border-green-500/30'
                      : contest.status === 'upcoming'
                      ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                      : contest.status === 'ended'
                      ? 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                      : contest.status === 'draft'
                      ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                      : 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                  }`}
                >
                  {contest.status === 'ended' ? 'ENDED' : contest.status.toUpperCase()}
                </span>
              </div>

              {/* Total Prize Pool */}
              {contest.total_prize_pool !== undefined && contest.total_prize_pool > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Total Prize Pool
                  </p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    ${contest.total_prize_pool.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Submission Count */}
              {contest.submission_count > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Total Submissions
                  </p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {contest.submission_count}
                  </p>
                </div>
              )}
            </div>

            {/* Required Hashtags */}
            {contest.required_hashtags && contest.required_hashtags.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Required Hashtags
                </p>
                <div className="flex flex-wrap gap-2">
                  {contest.required_hashtags.map((hashtag, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-sm font-medium border border-[var(--color-primary)]/20"
                    >
                      {hashtag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Required Description Template */}
            {contest.required_description_template && (
              <div className="mb-6">
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Description Requirements
                </p>
                <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                  {contest.required_description_template}
                </p>
              </div>
            )}

            {/* Submission Rules */}
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Submission Rules
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-background)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Multiple submissions</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {allowMultipleSubmissions ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-background)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Single category</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {forceSingleCategory ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-background)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Social verification</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {requireSocialVerification ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-background)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>MP4 upload required</span>
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {requireMp4Upload ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container-page py-4 sm:py-6 lg:py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {error && (
            <Card className="border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{error}</p>
            </Card>
          )}

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

          {/* General Categories (Always First, Full-Width, Visually Distinct) */}
          {contest.contest_categories && contest.contest_categories.filter((cat: any) => cat.is_general).length > 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  General Categories
                </h2>
                <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                  All submissions are automatically entered in these categories
                </p>
              </div>
              <div className="space-y-4">
                {contest.contest_categories
                  .filter((cat: any) => cat.is_general)
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any, index: number) => {
                    const rankingLabels: Record<string, string> = {
                      manual: 'Manual Judging',
                      views: 'Most Views',
                      likes: 'Most Likes',
                      comments: 'Most Comments',
                      impact_score: 'Manual Judging',
                    };
                    return (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10 w-full"
                        style={{
                          background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb, 120, 15, 35), 0.1) 0%, rgba(var(--color-primary-rgb, 120, 15, 35), 0.05) 100%)',
                          border: '2px solid var(--color-primary)',
                          borderColor: 'var(--color-primary)',
                          boxShadow: 'var(--shadow-lg)'
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {category.name}
                          </h3>
                          <span className="px-3 py-1 text-xs sm:text-sm font-medium rounded-full" style={{
                            background: 'var(--color-primary)',
                            color: '#ffffff'
                          }}>
                            Auto-Entry
                          </span>
                          {category.ranking_method && category.ranking_method !== 'manual' && category.ranking_method !== 'shares' && (
                            <span className="px-3 py-1 text-xs sm:text-sm font-medium rounded-full" style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: 'rgb(59, 130, 246)',
                              border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                              Ranked by: {rankingLabels[category.ranking_method] || category.ranking_method}
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-base mb-4 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                            {category.description}
                          </p>
                        )}
                        {category.rules && (
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                              Rules:
                            </p>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                              {category.rules}
                            </p>
                          </div>
                        )}
                        {category.contest_prizes && category.contest_prizes.length > 0 && (
                          <div className="mt-6">
                            <p className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                              Prizes
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {category.contest_prizes
                                .sort((a: any, b: any) => a.rank_order - b.rank_order)
                                .map((prize: any) => {
                                  const placeNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
                                  const placeName = placeNames[prize.rank_order - 1] || `${prize.rank_order}th`;
                                  return (
                                    <div key={prize.id} className="p-4 rounded-lg" style={{
                                      background: 'var(--color-surface)',
                                      border: '1px solid var(--color-border)'
                                    }}>
                                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {placeName} Place
                                      </p>
                                      <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                                        ${prize.payout_amount.toFixed(2)}
                                      </p>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Specific Categories (Premium Cards Grid) */}
          {contest.contest_categories && contest.contest_categories.filter((cat: any) => !cat.is_general).length > 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Contest Categories
                </h2>
                <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                  Select a category when submitting your edit
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contest.contest_categories
                  .filter((cat: any) => !cat.is_general)
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((category: any, index: number) => {
                    // Rules truncation logic (will be handled by component state if needed)
                    const rulesTruncated = category.rules && category.rules.length > 150;
                    
                    const rankingLabels: Record<string, string> = {
                      manual: 'Manual Judging',
                      views: 'Most Views',
                      likes: 'Most Likes',
                      comments: 'Most Comments',
                      impact_score: 'Manual Judging',
                    };

                    return (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        className="relative overflow-hidden rounded-2xl p-6 h-full flex flex-col group"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
                          border: '1px solid var(--color-border)',
                          boxShadow: 'var(--shadow-md)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="text-xl font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
                              {category.name}
                            </h3>
                            {category.ranking_method && category.ranking_method !== 'manual' && category.ranking_method !== 'shares' && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full ml-2 flex-shrink-0" style={{
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: 'rgb(59, 130, 246)'
                              }}>
                                {rankingLabels[category.ranking_method] || category.ranking_method}
                              </span>
                            )}
                          </div>
                          
                          {category.description && (
                            <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                              {category.description}
                            </p>
                          )}
                          
                          {category.rules && (
                            <div className="mb-4">
                              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                Rules:
                              </p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                                {category.rules}
                              </p>
                            </div>
                          )}
                          
                          {category.contest_prizes && category.contest_prizes.length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                Prizes
                              </p>
                              <div className="space-y-2">
                                {category.contest_prizes
                                  .sort((a: any, b: any) => a.rank_order - b.rank_order)
                                  .slice(0, 3)
                                  .map((prize: any) => {
                                    const placeNames = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
                                    const placeName = placeNames[prize.rank_order - 1] || `${prize.rank_order}th`;
                                    return (
                                      <div key={prize.id} className="flex items-center justify-between p-2 rounded" style={{
                                        background: 'var(--color-background)'
                                      }}>
                                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                          {placeName}
                                        </p>
                                        <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                                          ${prize.payout_amount.toFixed(2)}
                                        </p>
                                      </div>
                                    );
                                  })}
                                {category.contest_prizes.length > 3 && (
                                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    +{category.contest_prizes.length - 3} more prizes
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Submit Button */}
                        {contest.status === 'live' && (
                          <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            {user ? (
                              <Link href={`/contests/${contest?.slug || contestId}/submit?category=${category.id}`}>
                                <Button variant="primary" size="md" className="w-full">
                                  Submit to This Category
                                </Button>
                              </Link>
                            ) : (
                              <Link href={`/auth/login?redirect=${encodeURIComponent(`/contests/${contest?.slug || contestId}/submit?category=${category.id}`)}`}>
                                <Button variant="primary" size="md" className="w-full">
                                  Login to Submit
                                </Button>
                              </Link>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </div>
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

          {/* User Submissions - At the top, very visible - Only show if user has actual submissions */}
          {user && !userSubmissionsLoading && userSubmissions.length > 0 && (
            <Card className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    Your Submissions
                  </h2>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                    View and manage your contest submissions
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="secondary" onClick={fetchUserSubmissions} isLoading={userSubmissionsLoading}>
                    Refresh
                  </Button>
                  <button
                    onClick={() => setUserSubmissionsExpanded(!userSubmissionsExpanded)}
                    className="p-2 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                    aria-label={userSubmissionsExpanded ? 'Collapse' : 'Expand'}
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${userSubmissionsExpanded ? '' : '-rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              {userSubmissionsError && (
                <div className="mb-4 p-3 rounded border border-red-500/20 bg-red-500/5 text-sm text-red-500">
                  {userSubmissionsError}
                </div>
              )}
              {userSubmissionsExpanded && (
                <>
                  {/* Category Filter - Exclude general categories */}
                  {contest.contest_categories && contest.contest_categories.filter((cat: any) => !cat.is_general).length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        Filter by Category
                      </label>
                      <select
                        value={userSubmissionsCategoryFilter || ''}
                        onChange={(e) => setUserSubmissionsCategoryFilter(e.target.value || null)}
                        className="px-4 py-2 rounded-lg border"
                        style={{
                          background: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <option value="">All Categories</option>
                        {contest.contest_categories
                          .filter((cat: any) => !cat.is_general)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {userSubmissionsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                      {[...Array(2)].map((_, idx) => (
                        <div key={idx} className="h-64 rounded border border-[var(--color-border)] animate-pulse" />
                      ))}
                    </div>
                  ) : (() => {
                    const filteredSubmissions = filterSubmissionsByCategory(userSubmissions, userSubmissionsCategoryFilter);
                    return filteredSubmissions.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {userSubmissionsCategoryFilter ? 'No submissions found for this category.' : 'You have not submitted to this contest yet.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                        {filteredSubmissions.map((submission) => (
                          <ContestSubmissionCard
                            key={submission.id}
                            submission={submission}
                            showStats={false}
                            showCreator={false}
                            isUserSubmission={true}
                            hideCreatorInfo={true}
                            status={getSubmissionStatus(submission)}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </Card>
          )}

          {/* All Submissions - Similar to Communities */}
          {submissionVisibility !== 'private_judges_only' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    All Submissions
                  </h2>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                    {submissionVisibility === 'public_with_rankings' 
                      ? 'Discover the top-performing submissions from this contest' 
                      : 'View all contest submissions'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => fetchSubmissions(allSubmissionsCategoryFilter)} 
                    isLoading={allSubmissionsLoading}
                  >
                    Refresh
                  </Button>
                  <button
                    onClick={() => setAllSubmissionsExpanded(!allSubmissionsExpanded)}
                    className="p-2 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                    aria-label={allSubmissionsExpanded ? 'Collapse' : 'Expand'}
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${allSubmissionsExpanded ? '' : '-rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
              {allSubmissionsError && (
                <div className="mb-4 p-3 rounded border border-red-500/20 bg-red-500/5 text-sm text-red-500">
                  {allSubmissionsError}
                </div>
              )}
              {allSubmissionsExpanded && (
                <>
                  {/* Category Filter - Exclude general categories */}
                  {contest.contest_categories && contest.contest_categories.filter((cat: any) => !cat.is_general).length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        Filter by Category
                      </label>
                      <select
                        value={allSubmissionsCategoryFilter || ''}
                        onChange={(e) => {
                          const newFilter = e.target.value || null;
                          setAllSubmissionsCategoryFilter(newFilter);
                          // Reset offset and fetch submissions for the new category
                          fetchSubmissions(newFilter, 0, false);
                        }}
                        className="px-4 py-2 rounded-lg border"
                        style={{
                          background: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <option value="">All Categories</option>
                        {contest.contest_categories
                          .filter((cat: any) => !cat.is_general)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {allSubmissionsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                      {[...Array(4)].map((_, idx) => (
                        <div key={idx} className="h-64 rounded border border-[var(--color-border)] animate-pulse" />
                      ))}
                    </div>
                  ) : (() => {
                    // Category filtering is now done at database level, but keep submissions as-is
                    // No need for client-side filtering since API handles it
                    return submissions.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {allSubmissionsCategoryFilter ? 'No submissions found for this category.' : 'No submissions available.'}
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                          {submissions.map((submission, index) => {
                            const hideCreatorInfo = submissionVisibility === 'public_hide_metrics';
                            // Hide stats when visibility is 'public_hide_metrics' - never show stats for this visibility setting
                            // Explicitly set showStats to false when hideCreatorInfo is true
                            const showStats = hideCreatorInfo ? false : (submissionVisibility === 'public_with_rankings' && displayStats);
                            
                            return (
                              <motion.div
                                key={submission.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: index * 0.05 }}
                              >
                                <ContestSubmissionCard 
                                  submission={submission}
                                  showStats={showStats}
                                  showCreator={!hideCreatorInfo}
                                  hideCreatorInfo={hideCreatorInfo}
                                  isUserSubmission={false}
                                  rank={submissionVisibility === 'public_with_rankings' && displayStats ? index + 1 : undefined}
                                />
                              </motion.div>
                            );
                          })}
                        </div>
                        {submissionsHasMore && (
                          <div className="mt-6 flex justify-center">
                            <Button
                              onClick={loadMoreSubmissions}
                              isLoading={submissionsLoadingMore}
                              variant="secondary"
                              size="lg"
                            >
                              {submissionsLoadingMore ? 'Loading...' : `Load More (${submissionsTotal - submissions.length} remaining)`}
                            </Button>
                          </div>
                        )}
                        {submissionsTotal > 0 && !submissionsHasMore && (
                          <div className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
                            Showing all {submissionsTotal} submission{submissionsTotal !== 1 ? 's' : ''}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

