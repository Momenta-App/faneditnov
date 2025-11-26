'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';
import { Card } from '../../../components/Card';
import { Page, PageSection } from '../../../components/layout';
import { Button } from '../../../components/Button';
import { detectPlatform, isValidUrl } from '@/lib/url-utils';

export default function SubmitContestPage({ params }: { params: { id: string } }) {
  const { user, profile, isLoading, session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contestId, setContestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [checkingAccounts, setCheckingAccounts] = useState(false);
  const [contest, setContest] = useState<any>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loadingContest, setLoadingContest] = useState(true);

  useEffect(() => {
    setContestId(params.id);
  }, [params]);

  const sessionToken = session?.access_token ?? null;

  useEffect(() => {
    if (!isLoading && !user && contestId) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/contests/${contestId}/submit`)}`);
    }
  }, [user, isLoading, router, contestId]);

  useEffect(() => {
    if (user && contestId) {
      fetchContest();
    }
  }, [user, contestId, searchParams]);

  useEffect(() => {
    if (user && contestId && sessionToken) {
      fetchConnectedAccounts();
    }
  }, [user, contestId, sessionToken]);

  const fetchContest = async () => {
    try {
      setLoadingContest(true);
      const headers: HeadersInit = sessionToken 
        ? { Authorization: `Bearer ${sessionToken}` }
        : {};
      const response = await fetch(`/api/contests/${contestId}`, {
        headers,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setContest(data.data);
        
        // Check for category parameter in URL first
        const categoryParam = searchParams.get('category');
        if (categoryParam) {
          // Validate that the category exists and is not general
          const specificCategories = data.data.contest_categories?.filter((cat: any) => cat.is_general === false) || [];
          const categoryExists = specificCategories.some((cat: any) => cat.id === categoryParam);
          if (categoryExists) {
            setSelectedCategoryId(categoryParam);
          }
        } else {
          // If no URL parameter, use default logic
          // If specific (non-general) categories exist and force_single_category is true, select first category by default
          const specificCategories = data.data.contest_categories?.filter((cat: any) => cat.is_general === false) || [];
          if (specificCategories.length > 0) {
            if (data.data.force_single_category && specificCategories.length === 1) {
              setSelectedCategoryId(specificCategories[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching contest:', err);
    } finally {
      setLoadingContest(false);
    }
  };

  const fetchConnectedAccounts = async () => {
    try {
      setCheckingAccounts(true);
      if (!sessionToken) {
        return;
      }
      const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
      const response = await fetch('/api/settings/connected-accounts', {
        headers,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setConnectedAccounts(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching connected accounts:', err);
    } finally {
      setCheckingAccounts(false);
    }
  };

  const specificCategories =
    contest?.contest_categories?.filter((cat: any) => cat.is_general === false) ?? [];
  const generalCategories =
    contest?.contest_categories?.filter((cat: any) => cat.is_general === true) ?? [];
  const hasSpecificCategories = specificCategories.length > 0;
  const hasGeneralCategories = generalCategories.length > 0;

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    setUrlError(null);

    if (url && !isValidUrl(url)) {
      setUrlError('Invalid URL. Must be TikTok, Instagram, or YouTube Shorts');
    } else if (url) {
      const platform = detectPlatform(url);
      if (platform === 'unknown') {
        setUrlError('Unsupported platform');
      }
    }
  };

  const getVerifiedAccountForPlatform = (platform: string) => {
    return connectedAccounts.find(
      (acc) => acc.platform === platform && acc.verification_status === 'VERIFIED'
    );
  };

  const hasVerifiedAccount = (platform: string) => {
    return !!getVerifiedAccountForPlatform(platform);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'video/mp4' && !file.name.endsWith('.mp4')) {
        setError('File must be an MP4 video');
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        // 500MB limit
        setError('File size must be less than 500MB');
        return;
      }
      setMp4File(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUrlError(null);

    if (!videoUrl || !isValidUrl(videoUrl)) {
      setUrlError('Please enter a valid video URL');
      return;
    }

    if (!mp4File) {
      setError('Please select an MP4 file to upload');
      return;
    }

    if (!sessionToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    // Validate category selection if categories exist
    if (hasSpecificCategories && !selectedCategoryId) {
      setError('Please select a category for your submission');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('video_url', videoUrl);
      formData.append('mp4_file', mp4File);
      if (selectedCategoryId) {
        formData.append('category_id', selectedCategoryId);
      }

      const headers: HeadersInit = sessionToken 
        ? { Authorization: `Bearer ${sessionToken}` }
        : {};
      const response = await fetch(`/api/contests/${contestId}/submissions`, {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit');
      }

      setSuccess(true);
      // Redirect to settings contests tab after 2 seconds
      setTimeout(() => {
        router.push('/settings?tab=contests');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  if (success) {
    return (
      <Page>
        <PageSection variant="content">
          <div className="max-w-2xl mx-auto">
            <Card>
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-16 w-16 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Submission Successful!
                </h2>
                <p className="text-[var(--color-text-muted)] mb-4">
                  Your edit has been submitted and is being processed.
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Redirecting to your submissions...
                </p>
              </div>
            </Card>
          </div>
        </PageSection>
      </Page>
    );
  }

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href={`/contests/${contest?.slug || contestId}`}>
              <Button variant="ghost" size="sm">
                ← Back to Contest
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            Submit Your Edit
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Upload your fan edit to compete in this contest
          </p>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit}>
            <Card>
              <div className="space-y-6">
                {error && (
                  <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg">
                    <p className="text-red-500">{error}</p>
                  </div>
                )}

                {/* Category Selection - Only show specific (non-general) categories */}
                {hasSpecificCategories && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Select Category *
                    </label>
                    <select
                      required
                      value={selectedCategoryId || ''}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">-- Select a category --</option>
                      {specificCategories
                        .sort((a: any, b: any) => a.display_order - b.display_order)
                        .map((category: any) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Choose which category you're submitting to
                    </p>
                  </div>
                )}

                {/* General Categories Info */}
                {hasGeneralCategories && (
                  <div className="p-4 border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 rounded-lg">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      {hasSpecificCategories
                        ? 'Your submission will also be automatically entered in:'
                        : 'This contest only has general categories. Your submission will automatically be entered in:'}
                    </p>
                    <ul className="space-y-2">
                      {generalCategories
                        .sort((a: any, b: any) => a.display_order - b.display_order)
                        .map((category: any) => {
                          const rankingLabels: Record<string, string> = {
                            manual: 'Manual Judging',
                            views: 'Most Views',
                            likes: 'Most Likes',
                            comments: 'Most Comments',
                            shares: 'Most Shares',
                          };
                          return (
                            <li key={category.id} className="flex items-center gap-2 text-sm">
                              <span className="text-[var(--color-text-primary)] font-medium">
                                {category.name}
                              </span>
                              {category.ranking_method !== 'manual' && (
                                <span className="text-xs text-[var(--color-text-muted)]">
                                  (Ranked by: {rankingLabels[category.ranking_method] || category.ranking_method})
                                </span>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Social Video URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={videoUrl}
                    onChange={handleUrlChange}
                    placeholder="https://www.tiktok.com/@user/video/1234567890"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  {urlError && (
                    <p className="mt-1 text-sm text-red-500">{urlError}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Supported platforms: TikTok, Instagram Reels, YouTube Shorts
                  </p>
                  {videoUrl && !urlError && (
                    (() => {
                      const platform = detectPlatform(videoUrl);
                      if (platform !== 'unknown') {
                        const verified = hasVerifiedAccount(platform);
                        if (!verified) {
                          return (
                            <div className="mt-2 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                              <p className="text-sm text-yellow-700 mb-2">
                                💡 Connect and verify your {platform} account to ensure your submission is eligible for prizes.
                              </p>
                              <Link href="/settings?tab=0" className="text-sm text-[var(--color-primary)] hover:underline font-medium">
                                Connect Account →
                              </Link>
                            </div>
                          );
                        } else {
                          const account = getVerifiedAccountForPlatform(platform);
                          return (
                            <div className="mt-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                              <p className="text-sm text-green-700">
                                ✓ Verified {platform} account: {account?.username || account?.profile_url}
                              </p>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    MP4 File Upload *
                  </label>
                  <input
                    type="file"
                    required
                    accept="video/mp4,.mp4"
                    onChange={handleFileChange}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  {mp4File && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      Selected: {mp4File.name} ({(mp4File.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Maximum file size: 500MB. You can connect and verify the matching social account after uploading—
                  ownership is finalized once verification succeeds.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={loading}
                    disabled={!videoUrl || !mp4File || !!urlError}
                  >
                    Submit Edit
                  </Button>
                  <Link href={`/contests/${contest?.slug || contestId}`}>
                    <Button type="button" variant="ghost" size="lg">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </form>
        </div>
      </PageSection>
    </Page>
  );
}

