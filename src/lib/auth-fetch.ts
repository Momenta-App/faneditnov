'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient } from './supabase-client';

type FetchInput = RequestInfo | URL;

interface AuthFetchOptions extends RequestInit {
  includeJson?: boolean;
}

const DEFAULT_HEADERS: HeadersInit = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function buildAuthHeaders(extraHeaders?: HeadersInit): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const headers: HeadersInit = {
    ...DEFAULT_HEADERS,
    ...(extraHeaders || {}),
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

export async function authFetch(input: FetchInput, init?: AuthFetchOptions) {
  const headers = await buildAuthHeaders(init?.headers);
  const finalInit: RequestInit = {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers,
  };

  if (init?.includeJson && !headers['Content-Type']) {
    (finalInit.headers as HeadersInit)['Content-Type'] = 'application/json';
  }

  return fetch(input, finalInit);
}

export function useAuthFetch() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!mounted) return;
      setAccessToken(session?.access_token ?? null);
      setInitialized(true);
    };

    hydrate();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authHeaders = useCallback(
    async (headers?: HeadersInit) => {
      const merged: HeadersInit = {
        ...DEFAULT_HEADERS,
        ...(headers || {}),
      };

      if (accessToken) {
        merged['Authorization'] = `Bearer ${accessToken}`;
      }

      return merged;
    },
    [accessToken]
  );

  const authFetchWithState = useCallback(
    async (input: FetchInput, init?: AuthFetchOptions) => {
      const headers = await authHeaders(init?.headers);
      const finalInit: RequestInit = {
        cache: 'no-store',
        credentials: 'include',
        ...init,
        headers,
      };

      if (init?.includeJson && !headers['Content-Type']) {
        (finalInit.headers as HeadersInit)['Content-Type'] = 'application/json';
      }

      return fetch(input, finalInit);
    },
    [authHeaders]
  );

  return useMemo(
    () => ({
      initialized,
      authFetch: authFetchWithState,
      buildHeaders: authHeaders,
    }),
    [initialized, authFetchWithState, authHeaders]
  );
}


