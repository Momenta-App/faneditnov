'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { VideoCard } from '../../components/VideoCard';
import { CreatorCard } from '../../components/CreatorCard';
import { FilterBar, VIDEO_SORT_OPTIONS } from '../../components/filters';
import { NoVideosEmptyState } from '../../components/empty-states';
import { VideoCardSkeleton } from '../../components/Skeleton';
import {
  useCampaign,
  useCampaignVideos,
  useCampaignCreators,
  useCampaignHashtags,
} from '../../hooks/useData';

// Helper function for formatting numbers
const formatNumber = (num: number) => {
  if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Animated counter hook
const useCountUp = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(end);
  const hasAnimatedRef = React.useRef(false);
  const initialValueRef = React.useRef(end);

  React.useEffect(() => {
    if (hasAnimatedRef.current && end === initialValueRef.current) {
      return;
    }

    if (hasAnimatedRef.current) {
      setCount(end);
      initialValueRef.current = end;
      return;
    }

    setCount(0);
    const startTime = Date.now();
    const endTime = startTime + duration;

    const timer = setInterval(() => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(end * easeOutQuart));

      if (now >= endTime) {
        setCount(end);
        hasAnimatedRef.current = true;
        initialValueRef.current = end;
        clearInterval(timer);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
};

// StatCard component
const StatCard = React.memo(
  ({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) => {
    const animatedValue = useCountUp(value);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay }}
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="relative z-10">
          <p className="text-sm sm:text-base font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {label}
          </p>
          <p className="text-3xl sm:text-4xl lg:text-5xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {formatNumber(animatedValue)}
          </p>
        </div>
        <div
          className="absolute inset-0 opacity-5"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, transparent 100%)',
          }}
        />
      </motion.div>
    );
  }
);

StatCard.displayName = 'StatCard';

export default function CampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaign_id as string;

  const [activeTab, setActiveTab] = useState<'videos' | 'creators' | 'hashtags'>('videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('impact');
  const [timeRange, setTimeRange] = useState('all');

  const { data: campaign, loading: campaignLoading } = useCampaign(campaignId);
  const { data: videos } = useCampaignVideos(campaignId, searchQuery, sortBy, timeRange, 100);
  const { data: creators } = useCampaignCreators(campaignId);
  const { data: hashtags } = useCampaignHashtags(campaignId);

  if (campaignLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <VideoCardSkeleton />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Campaign Not Found
          </h2>
          <button
            onClick={() => router.push('/campaign')}
            className="px-6 py-3 text-white rounded-lg hover:opacity-90 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  // Extract display name from AI payload
  const aiPayload = campaign.ai_payload as any;
  const displayName = aiPayload
    ? `${aiPayload.sport} - ${aiPayload.league}`
    : campaign.name;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="container-page pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32">
          <div className="flex flex-col items-center text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {displayName}
            </motion.h1>

            {campaign.input_text && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg sm:text-xl lg:text-2xl max-w-3xl mb-8 sm:mb-10"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Campaign for: {campaign.input_text}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="relative -mt-16 z-20">
        <div className="container-page">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <StatCard label="Total Views" value={campaign.total_views || 0} delay={0} />
            <StatCard label="Videos" value={campaign.total_videos || 0} delay={0.1} />
            <StatCard label="Creators" value={campaign.total_creators || 0} delay={0.2} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8" style={{ background: 'var(--color-background)' }}>
        <div className="container-page">
          <div className="flex gap-2 sm:gap-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setActiveTab('videos')}
              className="relative py-4 px-4 sm:px-6 font-semibold transition-all hover:scale-105"
              style={{
                color: activeTab === 'videos' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              <span className="relative z-10">🎬 Top Videos</span>
              {activeTab === 'videos' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className="relative py-4 px-4 sm:px-6 font-semibold transition-all hover:scale-105"
              style={{
                color: activeTab === 'creators' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              <span className="relative z-10">⭐ Top Creators</span>
              {activeTab === 'creators' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('hashtags')}
              className="relative py-4 px-4 sm:px-6 font-semibold transition-all hover:scale-105"
              style={{
                color: activeTab === 'hashtags' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              <span className="relative z-10">#️⃣ Trending Tags</span>
              {activeTab === 'hashtags' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filters (only for videos tab) */}
      {activeTab === 'videos' && (
        <div className="pt-2" style={{ background: 'var(--color-background)' }}>
          <div className="container-page pb-4">
            <FilterBar
              searchPlaceholder="🔍 Search videos in this campaign..."
              sortValue={sortBy}
              onSortChange={setSortBy}
              sortOptions={VIDEO_SORT_OPTIONS}
              timeRangeValue={timeRange}
              onTimeRangeChange={setTimeRange}
              showTimeRange={true}
              onSearch={setSearchQuery}
            />
          </div>
        </div>
      )}

      {/* Content Sections */}
      <div className="container-page py-4 sm:py-6 lg:py-8">
        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {videos && videos.length > 0 ? (
              <>
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    Featured Content
                  </h2>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                    Discover the top-performing videos from this campaign
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                  {videos.map((video, index) => (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <VideoCard video={video} />
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <NoVideosEmptyState
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
          </motion.div>
        )}

        {/* Creators Tab */}
        {activeTab === 'creators' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Top Creators
              </h2>
              <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                Meet the talented creators behind this campaign&apos;s success
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {creators?.map((creator, index) => {
                const mappedCreator = {
                  id: creator.creator_id,
                  username: creator.username || '',
                  displayName: creator.display_name || '',
                  bio: creator.bio || '',
                  avatar: creator.avatar_url || '',
                  verified: creator.verified || false,
                  followers: 0,
                  videos: creator.video_count || 0,
                  likes: 0,
                  views: creator.total_views || 0,
                  impact: creator.total_impact_score || 0,
                };
                return (
                  <motion.div
                    key={creator.creator_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="h-full"
                  >
                    <CreatorCard creator={mappedCreator} hideFollowers={true} variant="grid" />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Hashtags Tab */}
        {activeTab === 'hashtags' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Trending Hashtags
              </h2>
              <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                Explore the most popular hashtags in this campaign
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {hashtags?.map((hashtag, index) => (
                <motion.div
                  key={hashtag.hashtag}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link href={`/hashtag/${hashtag.hashtag_norm}`}>
                    <div
                      className="group relative overflow-hidden rounded-2xl p-6 sm:p-8 transition-all hover:scale-105 hover:-translate-y-1"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
                        }}
                      />

                      <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                          #{hashtag.hashtag}
                        </h3>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                              Campaign Views
                            </span>
                            <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                              {formatNumber(hashtag.total_views)}
                            </p>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                              Videos
                            </span>
                            <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                              {formatNumber(hashtag.video_count)}
                            </p>
                          </div>

                          <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted-light)' }}>
                                Global Reach
                              </span>
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                {formatNumber(hashtag.global_views)} views
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

