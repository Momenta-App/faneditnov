'use client';

import { useState, useEffect } from 'react';

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

  useEffect(() => {
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
        const response = await fetch(`/api/homepage?${params}`);
        if (!response.ok) throw new Error('Failed to fetch homepage data');
        const result = await response.json();
        setData(result.data || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHomepage();
  }, [timeRange]);

  return { data, loading, error };
}
