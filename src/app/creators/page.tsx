'use client';

import React, { useState } from 'react';
import { useCreators } from '../hooks/useData';
import { CreatorCard } from '../components/CreatorCard';
import { PageHeaderWithFilters } from '../components/PageHeaderWithFilters';
import { NoCreatorsEmptyState } from '../components/empty-states';
import { VideoCardSkeleton } from '../components/Skeleton';
import { CREATOR_SORT_OPTIONS } from '../components/filters/SortDropdown';

export default function CreatorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('impact'); // Impact Score as default
  
  const { data: creators, loading, error } = useCreators(searchQuery, sortBy, timeRange, 100);

  // Creators are already filtered and sorted by backend
  const filteredCreators = Array.isArray(creators) ? creators : [];

  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading creators: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header with Filters */}
      <PageHeaderWithFilters
        title="Creators"
        description="Discover talented content creators and connect with the best"
        searchPlaceholder="Search creators, categories, or bios..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        sortValue={sortBy}
        onSortChange={setSortBy}
        sortOptions={CREATOR_SORT_OPTIONS}
        onSearch={setSearchQuery}
      />

      {/* Content */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        {loading ? (
          <div className="space-y-6">
            {[...Array(8)].map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCreators.length > 0 ? (
          <div className="space-y-4">
            {/* Results Summary */}
            <div>
              <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{filteredCreators.length}</span> {filteredCreators.length === 1 ? 'creator' : 'creators'}
              </p>
            </div>
            
            {/* Creators List */}
            <div className="space-y-3">
              {filteredCreators.map((creator, index) => (
                <CreatorCard 
                  key={creator.id} 
                  creator={creator} 
                  variant="list"
                  rank={index + 1}
                />
              ))}
            </div>
          </div>
        ) : (
          <NoCreatorsEmptyState
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
          />
        )}
      </div>
    </div>
  );
}
