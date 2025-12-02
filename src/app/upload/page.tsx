'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '../components/Tabs';
import { BulkUploadPanel } from '../components/BulkUploadPanel';
import { standardizeUrl, detectPlatform } from '@/lib/url-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { CampaignTabs } from '../components/CampaignTabs';
import { isAdmin } from '@/lib/role-utils';

export default function UploadPage() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [quotaInfo, setQuotaInfo] = useState<{ limit: number; remaining: number } | null>(null);

  const fetchQuotaInfo = async () => {
    if (!profile || !user) return;
    
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/auth/quota', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setQuotaInfo({
        limit: data.limit === Infinity ? Infinity : data.limit,
        remaining: data.remaining,
      });
    } catch (err) {
      console.error('Error fetching quota:', err);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchQuotaInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const userIsAdmin = isAdmin(profile?.role);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Login Required Modal Overlay - Below Header */}
      {!user && (
        <div 
          className="fixed left-0 right-0 bottom-0 z-40 flex items-center justify-center"
          style={{ 
            top: 'var(--header-height, 80px)',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div 
            className="max-w-[500px] mx-4 p-10 rounded-3xl text-center animate-fadeIn"
            style={{ 
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
              color: 'white',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" 
              style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-3">Login Required</h2>
            <p className="mb-8 text-lg opacity-90">
              Create a free account or log in to start submitting videos
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/auth/signup')}
                className="px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105"
                style={{ 
                  background: 'white',
                  color: 'var(--color-primary)',
                }}
              >
                Create Account
              </button>
              <button
                onClick={() => router.push('/auth/login')}
                className="px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '2px solid white',
                  color: 'white',
                }}
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - Compact */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-background) 100%)' }}>
        <div className="container-base max-w-[1100px] mx-auto py-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" 
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              {userIsAdmin ? 'Upload Center' : 'Submit Your Video'}
            </h1>
            <p className="text-base md:text-lg" 
              style={{ color: 'var(--color-text-muted)' }}>
              {userIsAdmin 
                ? 'Upload videos with advanced options including validation bypass and bulk upload'
                : 'Share your video edit with the community'}
            </p>
          </div>
        </div>
      </div>

      {/* Campaign / Upload tabs */}
      <div className="container-base max-w-[1100px] mx-auto mt-6 flex justify-center">
        <CampaignTabs active="upload" />
      </div>

      {/* Main Content */}
      <div className="container-base max-w-[1100px] mx-auto py-6">
        
        {/* Quota Banner - Only for logged in users */}
        {user && quotaInfo && (
          <div className="mb-6 p-4 rounded-xl border" 
            style={{ 
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)'
            }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" 
                  style={{ background: quotaInfo.remaining > 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} 
                    stroke={quotaInfo.remaining > 0 ? 'var(--color-success)' : 'var(--color-danger)'} 
                    className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {quotaInfo.limit === Infinity ? 'Unlimited Uploads' : `${quotaInfo.remaining} of ${quotaInfo.limit} uploads remaining today`}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {quotaInfo.limit === Infinity ? 'Admin access' : 'Resets daily at midnight UTC'}
                  </p>
                </div>
              </div>
              {quotaInfo.limit !== Infinity && (
                <div className="text-right hidden sm:block">
                  <div className="text-2xl font-bold" 
                    style={{ color: quotaInfo.remaining > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {quotaInfo.remaining}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin: Full tabbed interface with all features */}
        {/* Standard users: Simple single upload form */}
        {user ? (
          userIsAdmin ? (
            <Tabs className="space-y-6">
              <TabList>
                <Tab isActive={activeTab === 0} onClick={() => setActiveTab(0)}>
                  Single (Validated)
                </Tab>
                <Tab isActive={activeTab === 1} onClick={() => setActiveTab(1)}>
                  Single (Bypass) ⚡
                </Tab>
                <Tab isActive={activeTab === 2} onClick={() => setActiveTab(2)}>
                  Bulk (Validated)
                </Tab>
                <Tab isActive={activeTab === 3} onClick={() => setActiveTab(3)}>
                  Bulk (Bypass) ⚡
                </Tab>
              </TabList>

              <TabPanels>
                {/* Tab 0: Single Upload (Validated) */}
                <TabPanel className={activeTab === 0 ? 'block' : 'hidden'}>
                  <SingleUploadForm skipValidation={false} />
                </TabPanel>

                {/* Tab 1: Single Upload (Bypass) */}
                <TabPanel className={activeTab === 1 ? 'block' : 'hidden'}>
                  <SingleUploadForm skipValidation={true} />
                </TabPanel>

                {/* Tab 2: Bulk Upload (Validated) */}
                <TabPanel className={activeTab === 2 ? 'block' : 'hidden'}>
                  <BulkUploadPanel skipValidation={false} />
                </TabPanel>

                {/* Tab 3: Bulk Upload (Bypass) */}
                <TabPanel className={activeTab === 3 ? 'block' : 'hidden'}>
                  <BulkUploadPanel skipValidation={true} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          ) : (
            <StandardUserUploadForm />
          )
        ) : (
          <SingleUploadForm skipValidation={false} />
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// Single Upload Form Component (extracted for reuse)
function SingleUploadForm({ skipValidation }: { skipValidation: boolean }) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'completed' | 'failed'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [mp4Error, setMp4Error] = useState<string | null>(null);
  const mp4InputRef = useRef<HTMLInputElement | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Auto-standardize URLs for supported platforms
    const platform = detectPlatform(value);
    if (platform !== 'unknown') {
      const standardized = standardizeUrl(value);
      setUrl(standardized);
    } else {
      setUrl(value);
    }
  };

  const handleMp4Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMp4File(null);
      setMp4Error(null);
      return;
    }

    if (file.type && file.type !== 'video/mp4') {
      setMp4Error('Only MP4 files are supported right now.');
      e.target.value = '';
      setMp4File(null);
      return;
    }

    setMp4Error(null);
    setMp4File(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🎬 Upload form submitted');

    if (!user || !profile) {
      console.log('❌ No user or profile, redirecting to login');
      router.push('/auth/login');
      return;
    }

    console.log('✅ User authenticated:', user.id);
    setStatus('pending');
    setError(null);
    setMp4Error(null);
    setResult(null);

    try {
      const standardizedUrl = standardizeUrl(url.trim());
      console.log('📝 Standardized URL:', standardizedUrl);
      
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      console.log('🔑 Access token:', accessToken ? 'Present' : 'Missing');
      
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const formPayload = new FormData();
      formPayload.append('video_url', standardizedUrl);
      formPayload.append('skip_validation', skipValidation ? 'true' : 'false');
      if (mp4File) {
        formPayload.append('mp4_file', mp4File);
      }
      
      console.log('🚀 Sending request to /api/brightdata/trigger');
      const response = await fetch('/api/brightdata/trigger', {
        method: 'POST',
        headers,
        body: formPayload,
      });
      console.log('📥 Response received:', response.status);

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          setError('Please log in to submit videos');
        } else if (response.status === 429) {
          setError(
            `Daily limit reached. You can upload ${data.details?.limit || 'N/A'} videos per day. Resets at midnight UTC.`
          );
        } else {
          // Log the full error response for debugging
          console.error('❌ API Error Response:', {
            error: data.error,
            details: data.details,
            errors: data.errors,
            code: data.code,
            fullResponse: data
          });
          // Show the most specific error message available
          const errorMessage = data.errors && data.errors.length > 0 
            ? data.errors[0] 
            : data.details || data.error || 'Failed to submit video. Please try again.';
          setError(errorMessage);
        }
        setStatus('failed');
        return;
      }

      setResult(data);
      setStatus('completed');
      setUrl('');
      setMp4File(null);
      if (mp4InputRef.current) {
        mp4InputRef.current.value = '';
      }
      console.log('✅ Upload completed successfully');
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('failed');
    }
  };

  return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - Form (3 columns) */}
          <div className="lg:col-span-3">
        {/* Warning Banner for Bypass Mode */}
        {skipValidation && (
          <div 
            className="mb-6 p-4 rounded-lg border-2" 
            style={{ 
              background: 'rgba(255, 165, 0, 0.1)',
              borderColor: 'var(--color-warning, #FFA500)',
              color: 'var(--color-text-primary)'
            }}>
            <div className="flex items-start gap-3">
              <span style={{ fontSize: '1.5rem' }}>⚡</span>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--color-warning, #FFA500)' }}>
                  Quality Control Disabled
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  This video will be accepted without "edit" hashtag validation.
                </p>
              </div>
            </div>
          </div>
        )}

            <Card padding="lg">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Submit Video URL
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="url" className="block text-sm font-semibold mb-2" 
                    style={{ color: 'var(--color-text-primary)' }}>
                    Video URL
                  </label>
                  <input
                    id="url"
                    type="url"
                    value={url}
                    onChange={handleUrlChange}
                    placeholder="TikTok: https://www.tiktok.com/@user/video/1234567890, Instagram: https://www.instagram.com/p/ABC123, or YouTube Shorts: https://www.youtube.com/shorts/XYZ789"
                    className="w-full px-4 py-3 border-2 rounded-xl focus-ring text-sm"
                    style={{ 
                      background: 'var(--color-background)', 
                      borderColor: 'var(--color-border)', 
                      color: 'var(--color-text-primary)',
                      transition: 'all 0.2s ease'
                    }}
                    required
                    disabled={status === 'pending' || !user}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Paste the full URL of your TikTok video, Instagram post/reel, or YouTube Short
                  </p>
                </div>

                <div>
                  <label htmlFor="mp4-upload" className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}>
                    Attach Raw MP4 (optional)
                  </label>
                  <input
                    id="mp4-upload"
                    type="file"
                    ref={mp4InputRef}
                    accept="video/mp4"
                    onChange={handleMp4Change}
                    disabled={status === 'pending' || !user}
                    className="w-full px-4 py-2 border-2 rounded-xl focus-ring text-sm"
                    style={{
                      background: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                      transition: 'all 0.2s ease'
                    }}
                  />
                  <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Uploading the raw file lets us feature your edit later. You must own and verify the social account
                    for this video before the MP4 can be accepted.
                  </p>
                  {mp4Error && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>
                      {mp4Error}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  isLoading={status === 'pending'} 
                  className="w-full"
                  size="md"
              disabled={!user}
                >
                  {!user ? 'Please Log In First' : status === 'pending' ? 'Submitting...' : 'Submit Video'}
                </Button>

                {/* Success Message */}
                {status === 'completed' && result && (
                  <div className="p-4 rounded-xl border-2" 
                    style={{ 
                      background: 'rgba(52, 199, 89, 0.1)',
                      borderColor: 'var(--color-success)',
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-success)" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-success)' }}>
                          Video Submitted Successfully!
                        </h4>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {skipValidation 
                        ? 'Your video is being processed and will appear on the site shortly.'
                        : 'Your video is being processed. If it contains a valid #edit hashtag, it will appear on the site shortly.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {status === 'failed' && error && (
                  <div className="p-4 rounded-xl border-2" 
                    style={{ 
                      background: 'rgba(255, 59, 48, 0.1)', 
                      borderColor: 'var(--color-danger)'
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-danger)" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-danger)' }}>
                          Submission Failed
                        </h4>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </Card>
          </div>

          {/* Right Column - Requirements (2 columns) */}
          <div className="lg:col-span-2">
            <Card padding="lg">
              <div className="space-y-5">
                {/* TikTok Only */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" 
                      style={{ background: 'rgba(0, 122, 255, 0.1)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-info)" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Supported Platforms
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        We accept TikTok videos, Instagram posts/reels, and YouTube Shorts. Regular YouTube videos are not supported.
                      </p>
                    </div>
                  </div>
                </div>

            {!skipValidation && (
              <>
                <div style={{ height: '1px', background: 'var(--color-border)' }} />

                {/* Hashtag Requirement */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" 
                      style={{ background: 'rgba(255, 149, 0, 0.1)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-warning)" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Must Have #edit Hashtag
                      </h3>
                      <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        The word "edit" <strong>must be in a hashtag</strong>. Just having "edit" in the description does not count.
                      </p>
                    </div>
                  </div>

                  {/* Examples */}
                  <div className="space-y-2 ml-10">
                    <div className="text-xs">
                      <div className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        ✅ Valid Examples:
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface)' }}>
                          #edit
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface)' }}>
                          #edits
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface)' }}>
                          #movieedit
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface)' }}>
                          #sportsedit
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-surface)' }}>
                          #animeedit
                        </span>
                      </div>
                    </div>

                    <div className="text-xs">
                      <div className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        ❌ Invalid Example:
                      </div>
                      <div style={{ color: 'var(--color-text-muted)' }}>
                        <div className="mb-1">
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255, 59, 48, 0.1)', color: 'var(--color-danger)' }}>
                            "Cool edit of my scene"
                          </span>
                        </div>
                        <p className="text-xs italic">
                          Must be in a hashtag
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {skipValidation && (
              <>
                <div style={{ height: '1px', background: 'var(--color-border)' }} />

                {/* Bypass Mode Notice */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" 
                      style={{ background: 'rgba(255, 165, 0, 0.1)' }}>
                      <span style={{ fontSize: '1rem' }}>⚡</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-warning, #FFA500)' }}>
                        Validation Bypassed
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Hashtag validation is disabled. The video will be accepted regardless of hashtags.
                      </p>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Standard User Upload Form - Simplified, cleaner design
function StandardUserUploadForm() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'completed' | 'failed'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [mp4Error, setMp4Error] = useState<string | null>(null);
  const mp4InputRef = useRef<HTMLInputElement | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Auto-standardize URLs for supported platforms
    const platform = detectPlatform(value);
    if (platform !== 'unknown') {
      const standardized = standardizeUrl(value);
      setUrl(standardized);
    } else {
      setUrl(value);
    }
  };

  const handleMp4Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMp4File(null);
      setMp4Error(null);
      return;
    }

    if (file.type && file.type !== 'video/mp4') {
      setMp4Error('Only MP4 files are supported right now.');
      e.target.value = '';
      setMp4File(null);
      return;
    }

    setMp4Error(null);
    setMp4File(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !profile) {
      router.push('/auth/login');
      return;
    }

    setStatus('pending');
    setError(null);
    setMp4Error(null);
    setResult(null);

    try {
      const standardizedUrl = standardizeUrl(url.trim());
      
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const formPayload = new FormData();
      formPayload.append('video_url', standardizedUrl);
      formPayload.append('skip_validation', 'false'); // Always validated for standard users
      if (mp4File) {
        formPayload.append('mp4_file', mp4File);
      }
      
      const response = await fetch('/api/brightdata/trigger', {
        method: 'POST',
        headers,
        body: formPayload,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          setError('Please log in to submit videos');
        } else if (response.status === 429) {
          setError(
            `Daily limit reached. You can upload ${data.details?.limit || 'N/A'} videos per day. Resets at midnight UTC.`
          );
        } else {
          const errorMessage = data.errors && data.errors.length > 0 
            ? data.errors[0] 
            : data.details || data.error || 'Failed to submit video. Please try again.';
          setError(errorMessage);
        }
        setStatus('failed');
        return;
      }

      setResult(data);
      setStatus('completed');
      setUrl('');
      setMp4File(null);
      if (mp4InputRef.current) {
        mp4InputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card padding="lg" className="animate-fadeIn">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Share Your Video Edit
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Submit your video to be featured on the platform
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="standard-url" className="block text-sm font-semibold mb-2" 
              style={{ color: 'var(--color-text-primary)' }}>
              Video URL
            </label>
            <input
              id="standard-url"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="Paste your TikTok, Instagram, or YouTube Shorts URL here"
              className="w-full px-4 py-3 border-2 rounded-xl focus-ring text-sm"
              style={{ 
                background: 'var(--color-background)', 
                borderColor: 'var(--color-border)', 
                color: 'var(--color-text-primary)',
                transition: 'all 0.2s ease'
              }}
              required
              disabled={status === 'pending' || !user}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Supported: TikTok videos, Instagram posts/reels, and YouTube Shorts
            </p>
          </div>

          <div>
            <label htmlFor="standard-mp4-upload" className="block text-sm font-semibold mb-2"
              style={{ color: 'var(--color-text-primary)' }}>
              Attach Raw MP4 (optional)
            </label>
            <input
              id="standard-mp4-upload"
              type="file"
              ref={mp4InputRef}
              accept="video/mp4"
              onChange={handleMp4Change}
              disabled={status === 'pending' || !user}
              className="w-full px-4 py-2 border-2 rounded-xl focus-ring text-sm"
              style={{
                background: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
                transition: 'all 0.2s ease'
              }}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Uploading the raw file helps us feature your edit. You must own and verify the social account for this video.
            </p>
            {mp4Error && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>
                {mp4Error}
              </p>
            )}
          </div>

          {/* Requirements Info Box */}
          <div className="p-4 rounded-xl border" 
            style={{ 
              background: 'rgba(0, 122, 255, 0.05)',
              borderColor: 'rgba(0, 122, 255, 0.2)'
            }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" 
                style={{ background: 'rgba(0, 122, 255, 0.1)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-primary)" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Requirements
                </h3>
                <ul className="space-y-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Your video must include <strong>#edit</strong> (or similar hashtag like #edits, #movieedit, etc.)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>The word "edit" must be in a hashtag, not just in the description</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Video will be reviewed before appearing on the platform</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            isLoading={status === 'pending'} 
            className="w-full"
            size="lg"
            disabled={!user}
          >
            {!user ? 'Please Log In First' : status === 'pending' ? 'Submitting...' : 'Submit Video'}
          </Button>

          {/* Success Message */}
          {status === 'completed' && result && (
            <div className="p-4 rounded-xl border-2" 
              style={{ 
                background: 'rgba(52, 199, 89, 0.1)',
                borderColor: 'var(--color-success)',
              }}>
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-success)" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-success)' }}>
                    Video Submitted Successfully!
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Your video is being processed. If it contains a valid #edit hashtag, it will appear on the site shortly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {status === 'failed' && error && (
            <div className="p-4 rounded-xl border-2" 
              style={{ 
                background: 'rgba(255, 59, 48, 0.1)', 
                borderColor: 'var(--color-danger)'
              }}>
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-danger)" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-danger)' }}>
                    Submission Failed
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
