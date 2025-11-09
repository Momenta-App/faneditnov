'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCommunities } from '../hooks/useData';
import { CommunityCard } from '../components/CommunityCard';
import { PageHeaderWithFilters } from '../components/PageHeaderWithFilters';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabaseClient } from '@/lib/supabase-client';
import { COMMUNITY_SORT_OPTIONS } from '../components/filters/SortDropdown';

function CommunityCardSkeleton() {
  return (
    <div className="rounded-lg border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="flex gap-4 mt-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}


export default function CommunitiesPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('impact'); // Impact Score as default
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Check if user can create communities (admin role only)
  const canCreateCommunity = profile && profile.role === 'admin';
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    hashtags: '',
    profile_image_url: '',
    cover_image_url: '',
    website: '',
    tiktok: '',
    instagram: '',
    youtube: ''
  });
  
  const { data: communities, loading, error } = useCommunities(searchQuery, sortBy, timeRange, 100);

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const hashtagArray = formData.hashtags.split(',').map(tag => tag.trim()).filter(Boolean);
      
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
      
      const response = await fetch('/api/communities', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          linked_hashtags: hashtagArray,
          profile_image_url: formData.profile_image_url || undefined,
          cover_image_url: formData.cover_image_url || undefined,
          links: {
            website: formData.website || undefined,
            tiktok: formData.tiktok || undefined,
            instagram: formData.instagram || undefined,
            youtube: formData.youtube || undefined
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create community');
      }
      
      const data = await response.json();
      console.log('Community created:', data);
      
      // Close modal and reset form
      setShowCreateModal(false);
      setFormData({
        name: '',
        slug: '',
        description: '',
        hashtags: '',
        profile_image_url: '',
        cover_image_url: '',
        website: '',
        tiktok: '',
        instagram: '',
        youtube: ''
      });
      
      // Refresh communities list
      window.location.reload(); // Simple reload for now
    } catch (error) {
      console.error('Error creating community:', error);
      alert('Failed to create community. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen py-12 flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading communities: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Page Header with Filters */}
      <PageHeaderWithFilters
        title="Communities"
        description="Discover curated collections of content organized by hashtag groups"
        action={canCreateCommunity ? {
          label: 'Create Community',
          onClick: () => setShowCreateModal(true),
        } : undefined}
        searchPlaceholder="Search communities..."
        timeRangeValue={timeRange}
        onTimeRangeChange={setTimeRange}
        showTimeRange={true}
        sortValue={sortBy}
        onSortChange={setSortBy}
        sortOptions={COMMUNITY_SORT_OPTIONS}
        onSearch={setSearchQuery}
      />

      {/* Content */}
      <div className="container-base max-w-[1440px] mx-auto py-12">
        {loading ? (
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <CommunityCardSkeleton key={i} />
            ))}
          </div>
        ) : communities.length > 0 ? (
          <div className="space-y-4">
            <div>
              <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                Showing <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{communities.length}</span> communities
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg mb-4" style={{ color: 'var(--color-text-muted)' }}>No communities found</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Community
            </Button>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="hover:underline mt-2 block mx-auto"
                style={{ color: 'var(--color-primary)' }}
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" style={{ background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Create New Community</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-2xl hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <Input
                label="Community Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              
              <Input
                label="URL Slug *"
                placeholder="nba-edits"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                required
              />
              
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  Hashtags * (comma-separated)
                </label>
                <input
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  type="text"
                  placeholder="edit, nba, basketball"
                  value={formData.hashtags}
                  onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />

              <Input
                label="Profile Image URL"
                type="url"
                value={formData.profile_image_url}
                onChange={(e) => setFormData({ ...formData, profile_image_url: e.target.value })}
              />

              <Input
                label="Cover Image URL"
                type="url"
                value={formData.cover_image_url}
                onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4 pt-2">
                <Input
                  label="Website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                
                <Input
                  label="TikTok"
                  type="url"
                  value={formData.tiktok}
                  onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                />
                
                <Input
                  label="Instagram"
                  type="url"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                />
                
                <Input
                  label="YouTube"
                  type="url"
                  value={formData.youtube}
                  onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="submit" 
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? 'Creating...' : 'Create Community'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

