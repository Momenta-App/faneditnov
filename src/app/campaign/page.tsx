'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useCampaigns } from '../hooks/useData';
import { SearchInput } from '../components/filters/SearchInput';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import type { CampaignSuggestion } from '@/lib/openai';

export default function CampaignPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: campaigns, loading: campaignsLoading } = useCampaigns();

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

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_text: query }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle authentication errors
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        
        throw new Error(errorData.error || 'Failed to generate suggestions');
      }

      const result = await response.json();
      setSuggestions(result.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerate = async (suggestion: CampaignSuggestion, inputText: string) => {
    setIsGenerating(JSON.stringify(suggestion));
    setError(null);

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_text: inputText,
          ai_payload: suggestion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle authentication errors
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      const campaign = await response.json();
      
      // Redirect to campaign results page
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(null);
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
              Search for a region or market to generate AI-powered campaign suggestions
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchInput.trim()) {
                  handleSearch(searchInput);
                }
              }}
            >
              <div className="flex gap-4">
                <div className="flex-1">
                  <SearchInput
                    placeholder="Type a region or market, such as Canada or India"
                    onSearch={handleSearch}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSearching}
                  disabled={!searchInput.trim() || isSearching}
                >
                  Search
                </Button>
              </div>
            </form>
          </div>

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

          {/* AI Suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                AI Suggestions
              </h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion, index) => {
                  const suggestionKey = JSON.stringify(suggestion);
                  const isGeneratingThis = isGenerating === suggestionKey;

                  return (
                    <div
                      key={index}
                      className="p-6 rounded-lg border"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            {suggestion.sport} - {suggestion.league}
                          </h3>
                          {suggestion.teams.length > 0 && (
                            <div className="mb-2">
                              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                Teams:
                              </p>
                              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                {suggestion.teams.map((t) => t.team_name).join(', ')}
                              </p>
                            </div>
                          )}
                          {suggestion.global_hashtags.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                Hashtags:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {suggestion.global_hashtags.slice(0, 10).map((tag, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 rounded text-xs"
                                    style={{
                                      background: 'var(--color-primary)/10',
                                      color: 'var(--color-primary)',
                                    }}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {suggestion.global_hashtags.length > 10 && (
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    +{suggestion.global_hashtags.length - 10} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleGenerate(suggestion, searchInput)}
                          isLoading={isGeneratingThis}
                          disabled={isGeneratingThis || !!isGenerating}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved Campaigns */}
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
                  // Extract name from AI payload if available
                  const aiPayload = campaign.ai_payload as CampaignSuggestion | null;
                  const displayName = aiPayload
                    ? `${aiPayload.sport} - ${aiPayload.league}`
                    : campaign.name;

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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                      >
                        View Campaign
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                  No saved campaigns yet. Search for a region to get started!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

