'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CreatorCard } from '../../components/CreatorCard';
import { VideoCard } from '../../components/VideoCard';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { ContactCreatorModal } from '../../components/ContactCreatorModal';
import { LoginRequiredModal } from '../../components/LoginRequiredModal';
import { useVideos, useCreators } from '../../hooks/useData';
import { VideoCardSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseClient } from '@/lib/supabase-client';

export default function CreatorPage() {
  const params = useParams();
  const router = useRouter();
  const creatorId = params.creatorid as string;
  const { user, profile } = useAuth();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [hasContacted, setHasContacted] = useState(false);
  const [isCheckingContact, setIsCheckingContact] = useState(false);
  
  const { data: creators, loading: creatorsLoading } = useCreators('', 'views', 'all', 100);
  const { data: allVideos } = useVideos('', 'views', 'all', 100, 0);
  
  const creator = creators.find((c) => c.id === creatorId || c.username === creatorId);
  const creatorVideos = allVideos.filter((v) => v.creator?.username === creator?.username);
  
  // Check if user has contacted this creator
  useEffect(() => {
    const checkContactStatus = async () => {
      if (!user || !creator) return;
      
      setIsCheckingContact(true);
      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        
        if (!accessToken) {
          setIsCheckingContact(false);
          return;
        }

        const response = await fetch(`/api/creator/${creatorId}/contacted`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHasContacted(data.contacted || false);
        }
      } catch (error) {
        console.error('Error checking contact status:', error);
      } finally {
        setIsCheckingContact(false);
      }
    };

    checkContactStatus();
  }, [user, creatorId, creator]);

  const handleContactClick = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    setIsContactModalOpen(true);
  };

  const handleContactSuccess = () => {
    setHasContacted(true);
    setIsContactModalOpen(false);
  };
  
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (creatorsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Creator Not Found</h2>
          <Button onClick={() => router.push('/creators')}>
            Back to Creators
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Creator Profile Header */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="container-page pt-8 md:pt-12 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Profile Section - Horizontal Layout */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Profile Picture - Smaller */}
              <div className="relative shrink-0">
                <img
                  src={creator.avatar}
                  alt={creator.displayName}
                  className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 shadow-lg"
                  style={{ 
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface)'
                  }}
                />
                {creator.verified && (
                  <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1.5 shadow-lg">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Profile Info - To the Right */}
              <div className="flex-1 min-w-0">
                {/* Name and Username */}
                <div className="mb-3">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                    {creator.displayName}
                  </h1>
                  <p className="text-base md:text-lg mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    @{creator.username}
                  </p>
                  {hasContacted ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled
                        className="opacity-100"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Contacted
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleContactClick}
                      disabled={isCheckingContact}
                    >
                      {isCheckingContact ? 'Checking...' : 'Contact Creator'}
                    </Button>
                  )}
                </div>

                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8 mt-4">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber(creator.followers)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Followers
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber(creator.videos)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Videos
                    </div>
                  </div>

                  <div>
                    <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber((creator as any).likes || 0)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Likes
                    </div>
                  </div>

                  <div>
                    <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber((creator as any).views || 0)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Views
                    </div>
                  </div>

                  <div>
                    <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber(creator.impact || 0)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Impact Score
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        </div>
      </div>

      {/* Creator's Videos Section */}
      <div className="container-page py-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {creator.displayName}&apos;s Videos
          </h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{creatorVideos.length} videos</p>
        </div>

        {creatorVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {creatorVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>No videos found from this creator</p>
          </div>
        )}
      </div>

      {/* Contact Creator Modal */}
      {creator && user && (
        <ContactCreatorModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          creator={creator}
          onSuccess={handleContactSuccess}
        />
      )}

      {/* Login Required Modal */}
      <LoginRequiredModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        message="You must login to contact creators"
      />
    </div>
  );
}

