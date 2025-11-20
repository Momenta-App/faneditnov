'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase-client';

const LOADING_MESSAGES = [
  'Initializing campaign parameters...',
  'Analyzing market opportunities...',
  'Scanning creator networks...',
  'Compiling content database...',
  'Finalizing campaign structure...',
];

export function useCampaignGenerator() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGenerating) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        if (prev < LOADING_MESSAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const loadingMessage = useMemo(() => LOADING_MESSAGES[loadingMessageIndex], [loadingMessageIndex]);

  const generateCampaign = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        return;
      }

      setIsGenerating(true);
      setError(null);
      setLoadingMessageIndex(0);

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const generateResponse = await fetch('/api/campaigns/generate', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ input_text: query }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to generate campaign');
        }

        const generateResult = await generateResponse.json();
        const suggestion = generateResult.suggestions?.[0];

        if (!suggestion) {
          throw new Error('No suggestion generated');
        }

        const createResponse = await fetch('/api/campaigns', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            input_text: query,
            ai_payload: suggestion,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create campaign');
        }

        const campaign = await createResponse.json();

        await new Promise((resolve) => setTimeout(resolve, 500));

        router.push(`/campaigns/${campaign.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsGenerating(false);
      }
    },
    [router]
  );

  return {
    isGenerating,
    loadingMessage,
    error,
    setError,
    generateCampaign,
  };
}


