'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { supabaseClient } from '@/lib/supabase-client';
import type { CampaignSuggestion } from '@/lib/openai';
import { useCampaignGenerator } from '../hooks/useCampaignGenerator';
import { CampaignTabs } from '../components/CampaignTabs';

export default function CampaignPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const { isGenerating, loadingMessage, error, setError, generateCampaign } = useCampaignGenerator();

  // Fetch campaigns
  React.useEffect(() => {
    const fetchCampaigns = async () => {
      setCampaignsLoading(true);
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const headers: HeadersInit = {};
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch('/api/campaigns', {
          headers,
          credentials: 'include',
        });
        
        if (!response.ok) throw new Error('Failed to fetch campaigns');
        const result = await response.json();
        setCampaigns(result.data || []);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setCampaigns([]);
      } finally {
        setCampaignsLoading(false);
      }
    };

    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Show loading or nothing while checking auth
  if (authLoading || !user) {
    return null;
  }

  const handleDelete = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Are you sure you want to delete "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingCampaignId(campaignId);
    setError(null);

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete campaign');
      }

      // Remove campaign from local state
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDisplayName = (campaign: any): string => {
    const aiPayload = campaign.ai_payload as CampaignSuggestion | null;
    if (!aiPayload) {
      return campaign.name;
    }

    if (aiPayload.category === 'media') {
      if (aiPayload.franchise && aiPayload.series) {
        return `${aiPayload.franchise} - ${aiPayload.series}`;
      } else if (aiPayload.franchise) {
        return aiPayload.franchise;
      }
    } else {
      if (aiPayload.sport && aiPayload.league) {
        return `${aiPayload.sport} - ${aiPayload.league}`;
      } else if (aiPayload.sport) {
        return aiPayload.sport;
      }
    }

    return campaign.name;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <div className="container-page py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Campaign
            </h1>
            <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
              Create AI-powered campaigns for sports, movies, TV shows, and more
            </p>
          </div>

          {/* Campaign / Upload tabs */}
          <div className="flex justify-center mb-8">
            <CampaignTabs active="campaign" />
          </div>

          {/* Loading State */}
          {isGenerating && (
            <div className="mb-8">
              <div className="p-8 rounded-lg border text-center" style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}>
                <div className="mb-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{
                    borderColor: 'var(--color-primary)',
                  }}></div>
                </div>
                <p className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {loadingMessage}
                </p>
              </div>
            </div>
          )}

          {/* Search Bar */}
          {!isGenerating && (
            <div className="mb-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchInput.trim() && !isGenerating) {
                    generateCampaign(searchInput);
                  }
                }}
              >
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Type a region, sport, movie, or franchise (e.g., Canada, Marvel, NBA)"
                      className="w-full px-4 py-3 rounded-lg border"
                      style={{
                        background: 'var(--color-background)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                      disabled={isGenerating}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isGenerating}
                    disabled={!searchInput.trim() || isGenerating}
                  >
                    Generate
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="mb-6 p-4 rounded-lg"
              style={{
                background: 'var(--color-danger)/10',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
              }}
            >
              {error}
            </div>
          )}

          {/* Saved Campaigns */}
          {!isGenerating && (
            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Saved Campaigns
              </h2>
              {campaignsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : campaigns && campaigns.length > 0 ? (
                <div className="space-y-4">
                  {campaigns.map((campaign: any) => {
                    const displayName = getDisplayName(campaign);

                    return (
                      <div
                        key={campaign.id}
                        className="p-6 rounded-lg border flex items-center justify-between"
                        style={{
                          background: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        <div>
                          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                            {displayName}
                          </h3>
                          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Created {formatDate(campaign.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/campaigns/${campaign.id}`)}
                          >
                            View Campaign
                          </Button>
                          <button
                            onClick={() => handleDelete(campaign.id, displayName)}
                            disabled={deletingCampaignId === campaign.id}
                            className="p-2 rounded-lg transition-all duration-200 hover:bg-(--color-danger)/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              color: 'var(--color-danger)',
                            }}
                            aria-label="Delete campaign"
                            title="Delete campaign"
                          >
                            {deletingCampaignId === campaign.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{
                                borderColor: 'var(--color-danger)',
                              }}></div>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                    No saved campaigns yet. Generate your first campaign to get started!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

