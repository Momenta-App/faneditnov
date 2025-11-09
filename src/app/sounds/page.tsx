'use client';

import React, { useState } from 'react';
import { useSounds } from '../hooks/useData';
import { SoundCard } from '../components/SoundCard';
import { PageHeaderWithFilters } from '../components/PageHeaderWithFilters';
import { NoSoundsEmptyState } from '../components/empty-states';
import { Skeleton } from '../components/Skeleton';
import { Stack } from '../components/layout';
import { Typography } from '../components/Typography';
import { SOUND_SORT_OPTIONS } from '../components/filters/SortDropdown';

function SoundCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
          <div className="border-l border-gray-200 pl-4 shrink-0">
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SoundsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('impact'); // Impact Score as default
  
  const { data: sounds, loading, error } = useSounds(searchQuery, sortBy, timeRange, 100);

  // Sounds are already filtered and sorted by backend
  const filteredSounds = sounds;

  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <Typography.H3 className="text-[var(--color-danger)] mb-2">Error loading sounds</Typography.H3>
          <Typography.Muted>{error}</Typography.Muted>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header with Filters */}
      <PageHeaderWithFilters
        title="Sounds"
        description="Discover trending sounds and audio clips from creators worldwide"
        searchPlaceholder="Search sounds, artists..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        sortValue={sortBy}
        onSortChange={setSortBy}
        sortOptions={SOUND_SORT_OPTIONS}
        onSearch={setSearchQuery}
      />

      {/* Content */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        <Stack gap={6}>

          {loading ? (
            <Stack gap={4}>
              {[...Array(8)].map((_, i) => (
                <SoundCardSkeleton key={i} />
              ))}
            </Stack>
          ) : filteredSounds.length > 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                  Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{filteredSounds.length}</span> {filteredSounds.length === 1 ? 'sound' : 'sounds'}
                </p>
              </div>
              <div className="space-y-3">
                {filteredSounds.map((sound, index) => (
                  <SoundCard 
                    key={sound.id} 
                    sound={sound}
                    rank={index + 1}
                  />
                ))}
              </div>
            </div>
          ) : (
            <NoSoundsEmptyState
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
            />
          )}
        </Stack>
      </div>
    </div>
  );
}
