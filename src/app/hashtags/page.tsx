'use client';

import React, { useState, useMemo } from 'react';
import { useHashtags } from '../hooks/useData';
import { HashtagCard } from '../components/HashtagCard';
import { PageHeaderWithFilters } from '../components/PageHeaderWithFilters';
import { NoHashtagsEmptyState } from '../components/empty-states';
import { Skeleton } from '../components/Skeleton';
import { Stack } from '../components/layout';
import { Typography } from '../components/Typography';
import { HASHTAG_SORT_OPTIONS } from '../components/filters/SortDropdown';

// Blocked hashtags that shouldn't appear on the listing page
const BLOCKED_HASHTAGS = [
  '120fps',
  '4k',
  'ae',
  'aesthetic',
  'afftereffects',
  'blowthisup',
  'capcut',
  'edit',
  'foryou',
  'foryoupage',
  'fy',
  'fyp',
  'fypシ',
  'fyppppppppppppppppppppppp',
  'goviral',
  'trend',
  'trending',
  'viral',
  'viralvideo',
  'xyzbca'
];

function HashtagCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-48" />
      </div>
    </div>
  );
}

export default function HashtagsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('impact'); // Impact Score as default
  
  const { data: hashtags, loading, error } = useHashtags(searchQuery, sortBy, timeRange, 100);

  // Filter out blocked hashtags from the display
  const filteredHashtags = useMemo(() => {
    return hashtags.filter(hashtag => {
      const normalizedName = hashtag.name?.toLowerCase().replace(/^#/, '') || hashtag.id?.toLowerCase().replace(/^#/, '');
      return !BLOCKED_HASHTAGS.includes(normalizedName);
    });
  }, [hashtags]);

  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <Typography.H3 className="text-[var(--color-danger)] mb-2">Error loading hashtags</Typography.H3>
          <Typography.Muted>{error}</Typography.Muted>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header with Filters */}
      <PageHeaderWithFilters
        title="Hashtags"
        description="Discover trending hashtags and explore viral content"
        searchPlaceholder="Search hashtags..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        sortValue={sortBy}
        onSortChange={setSortBy}
        sortOptions={HASHTAG_SORT_OPTIONS}
        onSearch={setSearchQuery}
      />

      {/* Content */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        <Stack gap={6}>

          {loading ? (
            <Stack gap={2}>
              {[...Array(8)].map((_, i) => (
                <HashtagCardSkeleton key={i} />
              ))}
            </Stack>
          ) : filteredHashtags.length > 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                  Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{filteredHashtags.length}</span> {filteredHashtags.length === 1 ? 'hashtag' : 'hashtags'}
                </p>
              </div>
              <div className="space-y-3">
                {filteredHashtags.map((hashtag, index) => (
                  <HashtagCard 
                    key={hashtag.id} 
                    hashtag={hashtag}
                    rank={index + 1}
                  />
                ))}
              </div>
            </div>
          ) : (
            <NoHashtagsEmptyState
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}
        </Stack>
      </div>
    </div>
  );
}
