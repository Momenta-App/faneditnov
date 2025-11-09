'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { VideoCard } from '../../components/VideoCard';
import { BrandAccountHeader } from '../../components/BrandAccountHeader';
import { NoVideosEmptyState, NoCreatorsEmptyState } from '../../components/empty-states';
import { VideoCardSkeleton } from '../../components/Skeleton';
import { useSounds, useSoundVideos, useSoundCreators } from '../../hooks/useData';

export default function SoundPage() {
  const params = useParams();
  const router = useRouter();
  const soundId = params.soundId as string;
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  
  // Fetch data - use sound-specific hooks
  const { data: sounds, loading: loadingSounds } = useSounds('', 'views', 'all', 100);
  const { data: filteredVideos, loading: loadingVideos } = useSoundVideos(
    soundId,
    searchQuery,
    'impact', // Impact Score as default
    timeRange,
    100
  );
  const { data: topCreators, loading: loadingCreators } = useSoundCreators(soundId);
  
  const sound = sounds.find((s) => s.id === soundId);

  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (!sound && !loadingSounds) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Sound Not Found</h2>
          <button
            onClick={() => router.push('/sounds')}
            className="px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            Back to Sounds
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Brand Account Header */}
      <BrandAccountHeader
        title={sound?.title || 'Unknown Sound'}
        subtitle={sound?.author ? `by: ${sound.author}` : undefined}
        stats={[
          { value: formatNumber(sound?.views || 0), label: 'Total Views' },
          { value: formatNumber(sound?.videos || 0), label: 'Videos' },
          { value: formatNumber(topCreators.length || 0), label: 'Creators' },
          { value: formatNumber(sound?.impact || 0), label: 'Impact Score' },
        ]}
        searchPlaceholder="Search titles, creators, hashtags..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        onSearch={setSearchQuery}
      />

      {/* Content Area */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        {/* Results Summary - Full Width */}
        <div className="mb-8">
          <p style={{ color: 'var(--color-text-muted)' }}>
            Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{filteredVideos.length}</span> video{filteredVideos.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex gap-8">
          {/* Main Content - Videos */}
          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {loadingVideos ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {[...Array(10)].map((_, i) => (
                    <VideoCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {filteredVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <NoVideosEmptyState
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                />
              )}
            </motion.div>
          </div>

          {/* Sidebar - Top Creators (Desktop) */}
          <aside className="hidden xl:block w-80 shrink-0">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-32"
            >
              <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Top Creators</h2>
                
                {loadingCreators ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: 'var(--color-border)' }}></div>
                        <div className="flex-1">
                          <div className="h-4 rounded animate-pulse mb-2" style={{ background: 'var(--color-border)' }}></div>
                          <div className="h-3 rounded animate-pulse w-2/3" style={{ background: 'var(--color-border)' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topCreators.length > 0 ? (
                  <div className="space-y-3">
                    {topCreators.map((creator, index) => (
                      <Link
                        key={creator.creator_id}
                        href={`/creator/${creator.creator_id}`}
                        className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-[var(--color-border)]"
                      >
                        <div className="flex-shrink-0">
                          <span className="text-lg font-bold w-6 inline-block" style={{ color: 'var(--color-text-muted)' }}>{index + 1}</span>
                        </div>
                        <div className="flex-shrink-0">
                          <img
                            src={creator.avatar_url}
                            alt={creator.display_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {creator.display_name}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {formatNumber(creator.video_count)} video{creator.video_count !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {formatNumber(creator.total_views)} views
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No creators found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </aside>
        </div>

        {/* Mobile/Tablet Top Creators Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="xl:hidden mt-12"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Top Creators</h2>
          </div>

          {loadingCreators ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'var(--color-border)' }}></div>
                  <div className="flex-1">
                    <div className="h-4 rounded animate-pulse mb-2" style={{ background: 'var(--color-border)' }}></div>
                    <div className="h-3 rounded animate-pulse w-2/3" style={{ background: 'var(--color-border)' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : topCreators.length > 0 ? (
            <div className="space-y-3">
              {topCreators.map((creator, index) => (
                <Link
                  key={creator.creator_id}
                  href={`/creator/${creator.creator_id}`}
                  className="flex items-center gap-3 p-4 rounded-lg border transition-colors"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex-shrink-0">
                    <span className="text-xl font-bold" style={{ color: 'var(--color-text-muted)' }}>{index + 1}</span>
                  </div>
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {creator.display_name}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {formatNumber(creator.video_count)} video{creator.video_count !== 1 ? 's' : ''} • {formatNumber(creator.total_views)} views
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <NoCreatorsEmptyState />
          )}
        </motion.div>
      </div>
    </div>
  );
}
