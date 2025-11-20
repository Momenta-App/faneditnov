'use client';

import { useState, useEffect, useRef } from 'react';

export function useVideos(search = '', sortBy = 'views', timeRange = 'all', limit = 50, offset = 0) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ 
          limit: limit.toString(), 
          offset: offset.toString(),
          sort: sortBy,
          timeRange: timeRange
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/videos?${params}`);
        if (!response.ok) throw new Error('Failed to fetch videos');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [search, sortBy, timeRange, limit, offset]);

  return { data, loading, error };
}

export function useCreators(search = '', sortBy = 'views', timeRange = 'all', limit = 50) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ 
          limit: limit.toString(),
          sort: sortBy,
          timeRange: timeRange
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/creators?${params}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch creators: ${response.status}`);
        }
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCreators();
  }, [search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useHashtags(search = '', sortBy = 'views', timeRange = 'all', limit = 50) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHashtags = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ 
          limit: limit.toString(),
          sort: sortBy,
          timeRange: timeRange
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/hashtags?${params}`);
        if (!response.ok) throw new Error('Failed to fetch hashtags');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHashtags();
  }, [search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useHashtag(tag: string) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHashtag = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/hashtags/${encodeURIComponent(tag)}`);
        if (!response.ok) throw new Error('Failed to fetch hashtag');
        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (tag) {
      fetchHashtag();
    }
  }, [tag]);

  return { data, loading, error };
}

export function useCreator(creatorId: string) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreator = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/creators/${encodeURIComponent(creatorId)}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Creator not found');
          } else {
            throw new Error('Failed to fetch creator');
          }
          return;
        }
        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (creatorId) {
      fetchCreator();
    }
  }, [creatorId]);

  return { data, loading, error };
}

export function useCreatorVideos(
  creatorId: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100,
  offset = 0
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
          sort: sortBy,
          timeRange,
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/creators/${encodeURIComponent(creatorId)}/videos?${params}`);
        if (!response.ok) {
          if (response.status === 404) {
            setData([]);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch creator videos');
        }
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (creatorId) {
      fetchVideos();
    }
  }, [creatorId, search, sortBy, timeRange, limit, offset]);

  return { data, loading, error };
}

export function useSounds(search = '', sortBy = 'views', timeRange = 'all', limit = 50) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSounds = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ 
          limit: limit.toString(),
          sort: sortBy,
          timeRange: timeRange
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/sounds?${params}`);
        if (!response.ok) throw new Error('Failed to fetch sounds');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSounds();
  }, [search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useHashtagVideos(
  tag: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHashtagVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          sort: sortBy,
          timeRange: timeRange
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/hashtags/${encodeURIComponent(tag)}/videos?${params}`);
        if (!response.ok) throw new Error('Failed to fetch hashtag videos');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (tag) {
      fetchHashtagVideos();
    }
  }, [tag, search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useHashtagCreators(tag: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHashtagCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/hashtags/${encodeURIComponent(tag)}/creators`);
        if (!response.ok) throw new Error('Failed to fetch hashtag creators');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (tag) {
      fetchHashtagCreators();
    }
  }, [tag]);

  return { data, loading, error };
}

export function useSoundVideos(
  soundId: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSoundVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          sort: sortBy,
          timeRange: timeRange
        });
        if (search) {
          params.append('search', search);
        }
        const response = await fetch(`/api/sounds/${encodeURIComponent(soundId)}/videos?${params}`);
        if (!response.ok) throw new Error('Failed to fetch sound videos');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (soundId) {
      fetchSoundVideos();
    }
  }, [soundId, search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useSoundCreators(soundId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSoundCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sounds/${encodeURIComponent(soundId)}/creators`);
        if (!response.ok) throw new Error('Failed to fetch sound creators');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (soundId) {
      fetchSoundCreators();
    }
  }, [soundId]);

  return { data, loading, error };
}

export function useCommunities(search = '', sortBy = 'views', timeRange = 'all', limit = 50) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommunities = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          search,
          sort: sortBy,
          timeRange: timeRange,
          limit: limit.toString()
        });
        const response = await fetch(`/api/communities?${params}`);
        if (!response.ok) throw new Error('Failed to fetch communities');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, [search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useCommunity(communityId: string) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommunity = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/communities/${communityId}`);
        if (!response.ok) throw new Error('Failed to fetch community');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (communityId) {
      fetchCommunity();
    }
  }, [communityId]);

  return { data, loading, error };
}

export function useCommunityVideos(
  communityId: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100,
  editsOnly = true
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          search,
          sort: sortBy,
          timeRange,
          limit: limit.toString(),
          editsOnly: editsOnly.toString()
        });
        const response = await fetch(`/api/communities/${communityId}/videos?${params}`);
        if (!response.ok) throw new Error('Failed to fetch community videos');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (communityId) {
      fetchVideos();
    }
  }, [communityId, search, sortBy, timeRange, limit, editsOnly]);

  return { data, loading, error };
}

export function useCommunityCreators(communityId: string, editsOnly = true) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          editsOnly: editsOnly.toString()
        });
        const response = await fetch(`/api/communities/${communityId}/creators?${params}`);
        if (!response.ok) throw new Error('Failed to fetch community creators');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (communityId) {
      fetchCreators();
    }
  }, [communityId, editsOnly]);

  return { data, loading, error };
}

export function useCommunityHashtags(communityId: string, editsOnly = true) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHashtags = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          editsOnly: editsOnly.toString()
        });
        const response = await fetch(`/api/communities/${communityId}/hashtags?${params}`);
        if (!response.ok) throw new Error('Failed to fetch community hashtags');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (communityId) {
      fetchHashtags();
    }
  }, [communityId, editsOnly]);

  return { data, loading, error };
}

export function useHomepage(timeRange = 'all') {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchHomepage = async () => {
      setLoading(true);
      setError(null);
      try {
        // Map frontend time range to API time range
        const apiTimeRange = timeRange === 'all' ? 'all' : 
                           timeRange === 'year' ? '1y' : 
                           '30d';
        
        const params = new URLSearchParams({ 
          timeRange: apiTimeRange
        });
        
        const response = await fetch(`/api/homepage?${params}`, {
          signal: abortController.signal,
          cache: 'no-store', // Prevent caching issues
        });
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }
        
        const result = await response.json();
        
        console.log('[useHomepage] API response:', {
          ok: response.ok,
          status: response.status,
          hasData: !!result.data,
          hasStats: !!result.stats,
          success: result.success,
          resultKeys: Object.keys(result)
        });
        
        // Handle different response statuses
        if (!response.ok) {
          if (response.status === 401) {
            console.error('Homepage API: Unauthorized - authentication may be required');
            setError('Unauthorized access');
          } else if (response.status >= 500) {
          setError(result.error || 'Failed to fetch homepage data');
          } else {
            // For other errors, still try to use data if available
            console.warn('Homepage API returned error:', response.status, result);
          }
        }
        
        // Always set data if available, even if there was an error
        // The API may return data with an error flag
        if (result.data) {
          console.log('[useHomepage] Setting data from result.data:', {
            hasStats: !!result.data.stats,
            stats: result.data.stats
          });
          setData(result.data);
        } else if (result.stats) {
          // Fallback: if stats are at top level (from /api/stats)
          console.log('[useHomepage] Setting data from result.stats (fallback)');
          setData({ stats: result.stats });
        } else {
          console.warn('[useHomepage] No data found in response, setting null');
          setData(null);
        }
      } catch (err: any) {
        // Don't set error if request was aborted
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        // Only update loading state if request wasn't aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchHomepage();

    // Cleanup: abort request on unmount or dependency change
    return () => {
      abortController.abort();
    };
  }, [timeRange]);

  return { data, loading, error };
}

export function useCampaigns() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get session token for authentication
        const { supabaseClient } = await import('@/lib/supabase-client');
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
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  return { data, loading, error };
}

export function useCampaign(campaignId: string) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaign = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get session token for authentication
        const { supabaseClient } = await import('@/lib/supabase-client');
        const { data: { session } } = await supabaseClient.auth.getSession();
        const headers: HeadersInit = {};
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/campaigns/${campaignId}`, {
          headers,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch campaign');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchCampaign();
    }
  }, [campaignId]);

  return { data, loading, error };
}

export function useCampaignVideos(
  campaignId: string,
  search = '',
  sortBy = 'views',
  timeRange = 'all',
  limit = 100
) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get session token for authentication
        const { supabaseClient } = await import('@/lib/supabase-client');
        const { data: { session } } = await supabaseClient.auth.getSession();
        const headers: HeadersInit = {};
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const params = new URLSearchParams({
          search,
          sort: sortBy,
          timeRange,
          limit: limit.toString(),
        });
        const response = await fetch(`/api/campaigns/${campaignId}/videos?${params}`, {
          headers,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch campaign videos');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchVideos();
    }
  }, [campaignId, search, sortBy, timeRange, limit]);

  return { data, loading, error };
}

export function useCampaignCreators(campaignId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreators = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get session token for authentication
        const { supabaseClient } = await import('@/lib/supabase-client');
        const { data: { session } } = await supabaseClient.auth.getSession();
        const headers: HeadersInit = {};
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/campaigns/${campaignId}/creators`, {
          headers,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch campaign creators');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchCreators();
    }
  }, [campaignId]);

  return { data, loading, error };
}

export function useCampaignHashtags(campaignId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHashtags = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get session token for authentication
        const { supabaseClient } = await import('@/lib/supabase-client');
        const { data: { session } } = await supabaseClient.auth.getSession();
        const headers: HeadersInit = {};
        
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/campaigns/${campaignId}/hashtags`, {
          headers,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch campaign hashtags');
        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      fetchHashtags();
    }
  }, [campaignId]);

  return { data, loading, error };
}
