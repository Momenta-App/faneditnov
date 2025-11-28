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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
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
            setSelectedCategoryIds([categoryParam]);
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
  const forceSingleCategory = contest?.force_single_category ?? false;
  const allowMultipleCategories = !forceSingleCategory;

  const handleCategoryToggle = (categoryId: string) => {
    if (forceSingleCategory) {
      // Single selection mode
      setSelectedCategoryIds(selectedCategoryIds.includes(categoryId) ? [] : [categoryId]);
    } else {
      // Multiple selection mode
      setSelectedCategoryIds((prev) =>
        prev.includes(categoryId)
          ? prev.filter((id) => id !== categoryId)
          : [...prev, categoryId]
      );
    }
  };

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

    // Validate category selection: only required if no general categories exist
    // If general categories exist, category selection is optional
    if (hasSpecificCategories && !hasGeneralCategories && selectedCategoryIds.length === 0) {
      setError('Please select at least one category for your submission');
      return;
    }

    // Validate single category if force_single_category is enabled
    if (contest?.force_single_category && selectedCategoryIds.length > 1) {
      setError('You can only select one category for this contest');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('video_url', videoUrl);
      formData.append('mp4_file', mp4File);
      // Append all selected category IDs
      selectedCategoryIds.forEach((categoryId) => {
        formData.append('category_ids', categoryId);
      });

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

                {/* Category Selection */}
                {(hasSpecificCategories || hasGeneralCategories) && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Select Categories {!hasGeneralCategories && hasSpecificCategories ? '*' : ''}
                    </label>
                    <div className="space-y-2">
                      {/* General Categories - Always selected, unselectable */}
                      {hasGeneralCategories && (
                        <div className="space-y-2 mb-4">
                          {generalCategories
                            .sort((a: any, b: any) => a.display_order - b.display_order)
                            .map((category: any) => {
                              const rankingLabels: Record<string, string> = {
                                manual: 'Manual Judging',
                                views: 'Most Views',
                                likes: 'Most Likes',
                                comments: 'Most Comments',
                              };
                              const showRanking =
                                category.ranking_method &&
                                category.ranking_method !== 'manual' &&
                                category.ranking_method !== 'shares';
                              return (
                                <label
                                  key={category.id}
                                  className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 cursor-not-allowed opacity-75"
                                >
                                  <input
                                    type="checkbox"
                                    checked={true}
                                    disabled={true}
                                    className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] disabled:opacity-50"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                      {category.name}
                                    </span>
                                    {showRanking && (
                                      <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                                        (Ranked by: {rankingLabels[category.ranking_method] || category.ranking_method})
                                      </span>
                                    )}
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                      Automatically included
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      )}

                      {/* Specific Categories - User selectable */}
                      {hasSpecificCategories && (
                        <div className="space-y-2">
                          {specificCategories
                            .sort((a: any, b: any) => a.display_order - b.display_order)
                            .map((category: any) => {
                              const isSelected = selectedCategoryIds.includes(category.id);
                              return (
                                <label
                                  key={category.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
                                  }`}
                                >
                                  <input
                                    type={forceSingleCategory ? 'radio' : 'checkbox'}
                                    name={forceSingleCategory ? 'category-selection' : undefined}
                                    checked={isSelected}
                                    onChange={() => handleCategoryToggle(category.id)}
                                    className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                      {category.name}
                                    </span>
                                    {category.description && (
                                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                        {category.description}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                      {hasGeneralCategories && hasSpecificCategories
                        ? 'General categories are automatically included. Select additional categories above.'
                        : hasGeneralCategories
                          ? 'Your submission will automatically be entered in all general categories.'
                          : 'Choose which category you are submitting to'}
                    </p>
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

