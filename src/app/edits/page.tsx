'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useVideos } from '../hooks/useData';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/Skeleton';
import { PageHeaderWithFilters } from '../components/PageHeaderWithFilters';
import { NoVideosEmptyState } from '../components/empty-states';
import { VIDEO_SORT_OPTIONS } from '../components/filters/SortDropdown';

export default function EditsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('impact'); // Impact Score as default
  
  const { data: videos, loading, error } = useVideos('', sortBy, timeRange, 100, 0);

  // API now handles timeRange and sortBy filtering
  // Only client-side search filter is needed for hashtags and creator names
  const filteredVideos = useMemo(() => {
    if (!searchQuery) {
      return videos;
    }

    const query = searchQuery.toLowerCase();
    return videos.filter((video) => {
      const title = (video.title || '').toLowerCase();
      const creator = (video.creator?.username || '').toLowerCase();
      const hashtags = (video.hashtags || []).join(' ').toLowerCase();
      return title.includes(query) || creator.includes(query) || hashtags.includes(query);
    });
  }, [videos, searchQuery]);

  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading videos: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header with Filters */}
      <PageHeaderWithFilters
        title="Edits"
        description="Discover amazing video edits from talented creators"
        action={{
          label: 'Upload Edit',
          onClick: () => router.push('/upload'),
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          ),
        }}
        searchPlaceholder="Search titles, creators, hashtags..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        sortValue={sortBy}
        onSortChange={setSortBy}
        sortOptions={VIDEO_SORT_OPTIONS}
        onSearch={setSearchQuery}
      />

      {/* Content */}
      <div className="container-base max-w-[1440px] mx-auto py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {[...Array(10)].map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredVideos.length > 0 ? (
          <>
            {/* Results Count */}
            <div className="mb-6">
              <p style={{ color: 'var(--color-text-muted)' }}>
                Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{filteredVideos.length}</span> video{filteredVideos.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredVideos.map((video, index) => (
                <VideoCard key={video.id} video={video} rank={index + 1} ranked={true} />
              ))}
            </div>
          </>
        ) : (
          <NoVideosEmptyState
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}
      </div>
    </div>
  );
}
