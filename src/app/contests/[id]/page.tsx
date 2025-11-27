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
  status: 'upcoming' | 'live' | 'closed';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubContest, setSelectedSubContest] = useState<string | null>(null);

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
        throw new Error('Failed to fetch your submissions');
      }
      const data = await response.json();
      setUserSubmissions(data.data || []);
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

  // Map contest submission to Video format for VideoCard
  const mapSubmissionToVideo = (submission: any): Video => {
    const creator = submission.profiles ? {
      id: submission.profiles.id,
      username: submission.profiles.display_name || submission.profiles.email || 'Unknown',
      avatar: submission.profiles.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(submission.profiles.display_name || submission.profiles.email || 'U')}&background=120F23&color=fff`,
      verified: submission.profiles.is_verified || false,
    } : {
      id: '',
      username: 'Unknown',
      avatar: 'https://ui-avatars.com/api/?name=U&background=120F23&color=fff',
      verified: false,
    };

    // Generate thumbnail URL based on platform and video URL
    let thumbnail = '';
    const videoUrl = submission.original_video_url || '';
    if (videoUrl) {
      if (videoUrl.includes('tiktok.com')) {
        // TikTok thumbnail - would need to be fetched or use a service
        thumbnail = `https://www.tiktok.com/api/img/?itemId=${submission.video_id || ''}`;
      } else if (videoUrl.includes('instagram.com')) {
        // Instagram thumbnail
        thumbnail = '';
      } else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        // YouTube thumbnail
        const videoId = submission.video_id || videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || '';
        thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
      }
    }

    // Use default thumbnail if none found
    if (!thumbnail) {
      thumbnail = 'https://via.placeholder.com/400x600?text=Video';
    }

    return {
      id: submission.id.toString(),
      postId: submission.video_id || submission.id.toString(),
      title: videoUrl || 'Contest Submission',
      description: '',
      thumbnail,
      videoUrl,
      platform: (submission.platform as 'tiktok' | 'instagram' | 'youtube') || 'unknown',
      creator,
      views: submission.views_count || 0,
      likes: submission.likes_count || 0,
      comments: submission.comments_count || 0,
      shares: submission.shares_count || 0,
      saves: submission.saves_count || 0,
      impact: Number(submission.impact_score) || 0,
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
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  {contest.status.toUpperCase()}
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
            {/* Submit Video Button */}
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
                    {contest.status}
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
                      : 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                  }`}
                >
                  {contest.status.toUpperCase()}
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

          {/* User Submissions - At the top, very visible */}
          {user && (userSubmissionsLoading || userSubmissions.length > 0 || userSubmissionsError) && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    Your Submissions
                  </h2>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                    View and manage your contest submissions
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={fetchUserSubmissions} isLoading={userSubmissionsLoading}>
                  Refresh
                </Button>
              </div>
              {userSubmissionsError && (
                <div className="mb-4 p-3 rounded border border-red-500/20 bg-red-500/5 text-sm text-red-500">
                  {userSubmissionsError}
                </div>
              )}
              {userSubmissionsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                  {[...Array(2)].map((_, idx) => (
                    <div key={idx} className="h-64 rounded border border-[var(--color-border)] animate-pulse" />
                  ))}
                </div>
              ) : userSubmissions.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  You have not submitted to this contest yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 mb-12">
                  {userSubmissions.map((submission) => (
                    <ContestSubmissionCard
                      key={submission.id}
                      submission={submission}
                      showStats={displayStats}
                      showCreator={false}
                      isUserSubmission={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Submissions - Similar to Communities */}
          {submissionVisibility !== 'private_judges_only' && submissions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Section Header */}
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Featured Submissions
                </h2>
                <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                  {submissionVisibility === 'public_with_rankings' 
                    ? 'Discover the top-performing submissions from this contest' 
                    : 'View all contest submissions'}
                </p>
              </div>

              {/* Video Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                {submissions.map((submission, index) => {
                  const video = mapSubmissionToVideo(submission);
                  const showStats = submissionVisibility === 'public_with_rankings' && displayStats;
                  
                  return (
                    <motion.div
                      key={submission.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <VideoCard 
                        video={video}
                        rank={submissionVisibility === 'public_with_rankings' && displayStats ? index + 1 : undefined}
                        ranked={submissionVisibility === 'public_with_rankings' && displayStats}
                        hideLikes={!showStats}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}

