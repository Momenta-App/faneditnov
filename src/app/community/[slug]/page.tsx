'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useAnimation, useInView } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { VideoCard } from '../../components/VideoCard';
import { CreatorCard } from '../../components/CreatorCard';
import { FilterBar, VIDEO_SORT_OPTIONS } from '../../components/filters';
import { NoVideosEmptyState } from '../../components/empty-states';
import { VideoCardSkeleton } from '../../components/Skeleton';
import { useCommunities, useCommunityVideos, useCommunityCreators, useCommunityHashtags } from '../../hooks/useData';
import { CommunityEditModal } from '../../components/CommunityEditModal';
import { Community } from '../../types/data';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase-client';

// Helper function for formatting numbers
const formatNumber = (num: number) => {
  if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Animated counter hook - defined outside component to maintain stable state
const useCountUp = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(end);
  const hasAnimatedRef = useRef(false);
  const initialValueRef = useRef(end);

  useEffect(() => {
    // Only animate on first render or if value actually changes
    if (hasAnimatedRef.current && end === initialValueRef.current) {
      return;
    }
    
    if (hasAnimatedRef.current) {
      // Value changed, just update without animation
      setCount(end);
      initialValueRef.current = end;
      return;
    }
    
    // First animation only
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

// StatCard component - defined outside to prevent recreation
const StatCard = React.memo(({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) => {
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
        boxShadow: 'var(--shadow-lg)'
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
          background: 'linear-gradient(135deg, var(--color-primary) 0%, transparent 100%)'
        }}
      />
    </motion.div>
  );
});

StatCard.displayName = 'StatCard';

export default function CommunityPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'videos' | 'creators' | 'hashtags'>('videos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('impact'); // Impact Score as default
  const [timeRange, setTimeRange] = useState('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editsOnly, setEditsOnly] = useState(true); // Default to edits only
  
  // Only admin can edit communities
  const canEditCommunity = profile && profile.role === 'admin';
  
  // Find community by slug first
  const { data: communities, loading: loadingCommunities } = useCommunities('', 'created_at', 'all', 1000);
  const community = communities?.find(c => c.slug === slug);
  const communityId = community?.id || '';

  // Fetch data only if we have community ID
  const shouldFetchData = !!communityId && !!community;
  const { data: videos } = useCommunityVideos(communityId, searchQuery, sortBy, timeRange, 100, editsOnly);
  const { data: creators } = useCommunityCreators(communityId, editsOnly);
  const { data: hashtags } = useCommunityHashtags(communityId, editsOnly);

  const handleSaveCommunity = async (data: Community) => {
    if (!community?.id) return;
    
    // Get access token for Authorization header
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header if we have a token
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(`/api/communities/${community.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update community');
    }
    
    // Refresh page to show updated data
    window.location.reload();
  };

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Community Not Found</h2>
          <button
            onClick={() => router.push('/communities')}
            className="px-6 py-3 text-white rounded-lg hover:opacity-90 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            Back to Communities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Premium Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Image with Gradient Overlay */}
        {community.cover_image_url && (
          <>
            <div className="absolute inset-0 z-0">
              <Image
                src={community.cover_image_url}
                alt={community.name}
                fill
                className="object-cover"
                priority
              />
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, var(--color-background) 100%)'
                }}
              />
            </div>
          </>
        )}
        
        {/* Hero Content */}
        <div className="relative z-10 container-page pt-16 pb-24 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32">
          <div className="flex flex-col items-center text-center">
            {/* Profile Image */}
            {community.profile_image_url && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
                className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full overflow-hidden mb-6 sm:mb-8 border-4 sm:border-8 shadow-2xl"
                style={{ 
                  borderColor: 'var(--color-background)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }}
              >
                <Image
                  src={community.profile_image_url}
                  alt={community.name}
                  fill
                  className="object-cover"
                  priority
                />
              </motion.div>
            )}
            
            {/* Community Name */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6"
              style={{ 
                color: community.cover_image_url ? '#ffffff' : 'var(--color-text-primary)',
                textShadow: community.cover_image_url ? '0 2px 20px rgba(0,0,0,0.5)' : 'none'
              }}
            >
              {community.name}
            </motion.h1>
            
            {/* Description */}
            {community.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-lg sm:text-xl lg:text-2xl max-w-3xl mb-8 sm:mb-10"
                style={{ 
                  color: community.cover_image_url ? 'rgba(255,255,255,0.9)' : 'var(--color-text-muted)',
                  textShadow: community.cover_image_url ? '0 1px 10px rgba(0,0,0,0.3)' : 'none'
                }}
              >
                {community.description}
              </motion.p>
            )}

            {/* Social Links */}
            {community.links && Object.values(community.links).some(link => link) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap gap-3 sm:gap-4 justify-center mb-8"
              >
                {community.links.website && (
                  <a
                    href={community.links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                    style={{
                      background: community.cover_image_url ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                      backdropFilter: 'blur(10px)',
                      color: community.cover_image_url ? '#ffffff' : 'var(--color-text-primary)',
                      border: `1px solid ${community.cover_image_url ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`
                    }}
                  >
                    🌐 Website
                  </a>
                )}
                {community.links.tiktok && (
                  <a
                    href={community.links.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                    style={{
                      background: community.cover_image_url ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                      backdropFilter: 'blur(10px)',
                      color: community.cover_image_url ? '#ffffff' : 'var(--color-text-primary)',
                      border: `1px solid ${community.cover_image_url ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`
                    }}
                  >
                    🎵 TikTok
                  </a>
                )}
                {community.links.instagram && (
                  <a
                    href={community.links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                    style={{
                      background: community.cover_image_url ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                      backdropFilter: 'blur(10px)',
                      color: community.cover_image_url ? '#ffffff' : 'var(--color-text-primary)',
                      border: `1px solid ${community.cover_image_url ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`
                    }}
                  >
                    📸 Instagram
                  </a>
                )}
                {community.links.youtube && (
                  <a
                    href={community.links.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                    style={{
                      background: community.cover_image_url ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                      backdropFilter: 'blur(10px)',
                      color: community.cover_image_url ? '#ffffff' : 'var(--color-text-primary)',
                      border: `1px solid ${community.cover_image_url ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`
                    }}
                  >
                    ▶️ YouTube
                  </a>
                )}
              </motion.div>
            )}

            {/* Edit Button - Admin only */}
            {canEditCommunity && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => setIsEditModalOpen(true)}
                className="px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                style={{
                  background: 'var(--color-primary)',
                  color: '#ffffff'
                }}
              >
                ✏️ Edit Community
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Premium Stats Section */}
      <div className="relative -mt-16 z-20">
        <div className="container-page">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <StatCard label="Total Views" value={community.total_views} delay={0} />
            <StatCard label="Videos" value={community.total_videos} delay={0.1} />
            <StatCard label="Creators" value={community.total_creators} delay={0.2} />
            <StatCard label="Impact Score" value={community.total_impact_score || 0} delay={0.3} />
          </div>
        </div>
      </div>

      {/* Premium Tabs */}
      <div className="mt-8" style={{ background: 'var(--color-background)' }}>
        <div className="container-page">
          <div className="flex gap-2 sm:gap-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setActiveTab('videos')}
              className="relative py-4 px-4 sm:px-6 font-semibold transition-all hover:scale-105"
              style={{
                color: activeTab === 'videos' ? 'var(--color-primary)' : 'var(--color-text-muted)'
              }}
            >
              <span className="relative z-10">🎬 Top Videos</span>
              {activeTab === 'videos' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className="relative py-4 px-4 sm:px-6 font-semibold transition-all hover:scale-105"
              style={{
                color: activeTab === 'creators' ? 'var(--color-primary)' : 'var(--color-text-muted)'
              }}
            >
              <span className="relative z-10">⭐ Top Creators</span>
              {activeTab === 'creators' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('hashtags')}
              className="relative py-4 px-4 sm:px-6 font-semibold transition-all hover:scale-105"
              style={{
                color: activeTab === 'hashtags' ? 'var(--color-primary)' : 'var(--color-text-muted)'
              }}
            >
              <span className="relative z-10">#️⃣ Trending Tags</span>
              {activeTab === 'hashtags' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Edits Only Toggle */}
      <div className="pt-4" style={{ background: 'var(--color-background)' }}>
        <div className="container-page pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditsOnly(!editsOnly)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
              style={{
                background: editsOnly ? 'var(--color-primary)' : 'var(--color-surface)',
                color: editsOnly ? '#fff' : 'var(--color-text-primary)',
                border: editsOnly ? 'none' : '1px solid var(--color-border)'
              }}
            >
              <span>{editsOnly ? '✓' : '○'}</span>
              <span>Edits Only</span>
            </button>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {editsOnly 
                ? 'Showing videos with "edit" hashtags' 
                : 'Showing all videos in this community'}
            </span>
          </div>
        </div>
      </div>

      {/* Filters (only for videos tab) */}
      {activeTab === 'videos' && (
        <div className="pt-2" style={{ background: 'var(--color-background)' }}>
          <div className="container-page pb-4">
            <FilterBar
              searchPlaceholder="🔍 Search videos in this community..."
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
                {/* Section Header */}
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                    Featured Content
                  </h2>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                    Discover the top-performing videos from this community
                  </p>
                </div>

                {/* Video Grid */}
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
            {/* Section Header */}
            <div className="mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Top Creators
              </h2>
              <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                Meet the talented creators behind this community&apos;s success
              </p>
            </div>

            {/* Creators Grid */}
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
                  impact: creator.total_impact_score || 0
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
            {/* Section Header */}
            <div className="mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Trending Hashtags
              </h2>
              <p className="text-base sm:text-lg" style={{ color: 'var(--color-text-muted)' }}>
                Explore the most popular hashtags in this community
              </p>
            </div>

            {/* Hashtags Grid */}
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
                        boxShadow: 'var(--shadow-md)'
                      }}
                    >
                      {/* Background Gradient */}
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)'
                        }}
                      />
                      
                      <div className="relative z-10">
                        <h3 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                          #{hashtag.hashtag}
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                              Community Views
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

      {/* Edit Modal */}
      {isEditModalOpen && community && (
        <CommunityEditModal
          community={community}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveCommunity}
        />
      )}
    </div>
  );
}

