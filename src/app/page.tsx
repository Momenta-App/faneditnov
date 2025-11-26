'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from './components/Badge';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Typography } from './components/Typography';
import { VideoCard } from './components/VideoCard';
import { CreatorCard } from './components/CreatorCard';
import { Stack, Grid, Cluster } from './components/layout';
import { useVideos } from './hooks/useData';
import { useAuth } from './contexts/AuthContext';
import { isAdmin } from '@/lib/role-utils';

interface HomepageData {
  stats: {
    videos: { count: number; formatted: string; label: string };
    views: { count: number; formatted: string; label: string };
    creators: { count: number; formatted: string; label: string };
  };
  topVideos: any[];
  topCreators: any[];
}

export default function Home() {
  const { profile, isLoading: authLoading } = useAuth();
  const [homepageData, setHomepageData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week'>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  
  // Check if user is admin
  const userIsAdmin = !authLoading && profile && isAdmin(profile.role);

  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        const timeRangeParam = timeRange === 'all' ? 'all' : timeRange === 'month' ? '1y' : '1w';
        const response = await fetch(`/api/homepage?timeRange=${timeRangeParam}`);
        const result = await response.json();
        if (result.success) {
          setHomepageData(result.data);
        }
      } catch (error) {
        console.error('Error fetching homepage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepageData();
  }, [timeRange]);

  const stats = homepageData?.stats || {
    videos: { count: 0, formatted: '0+', label: 'Clips' },
    views: { count: 0, formatted: '0+', label: 'Global Views' },
    creators: { count: 0, formatted: '0+', label: 'Talented Creators' },
  };

  const topVideos = homepageData?.topVideos || [];
  const topCreators = homepageData?.topCreators || [];

  return (
    <div style={{ background: 'var(--color-background)' }}>
      {/* Hero Section */}
      <section className="py-16 md:py-24">
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={8} align="center">
            {/* Badge */}
            <Badge variant="primary" size="lg">
              ✨ Where creativity meets recognition
            </Badge>

            {/* Headline */}
            <div className="text-center max-w-4xl">
              <Typography.H1 className="mb-6">
                The Best Fan Edits, Ranked by Fans
              </Typography.H1>
              <Typography.Text className="text-lg md:text-xl max-w-2xl mx-auto text-[var(--color-text-muted)]">
                Discover, vote, and share the most incredible fan edits from creators worldwide. 
                Join a community where talent rises to the top.
              </Typography.Text>
            </div>

            {/* CTAs */}
            <Cluster gap={4} justify="center">
              <Link href="/edits">
                <Button size="lg">Explore Top Edits</Button>
              </Link>
              <Link href="/communities">
                <Button variant="secondary" size="lg">Join Community</Button>
              </Link>
            </Cluster>

            {/* Stats Bar */}
            <Grid cols={{ mobile: 1, tablet: 3, desktop: 3 }} gap={{ mobile: 4, desktop: 6 }} className="w-full max-w-4xl mt-8">
              <Card padding="lg" className="text-center">
                <Typography.H2 className="mb-2 text-[var(--color-primary)]">
                  {stats.videos.formatted}
                </Typography.H2>
                <Typography.Muted>{stats.videos.label}</Typography.Muted>
              </Card>
              <Card padding="lg" className="text-center">
                <Typography.H2 className="mb-2 text-[var(--color-primary)]">
                  {stats.views.formatted}
                </Typography.H2>
                <Typography.Muted>{stats.views.label}</Typography.Muted>
              </Card>
              <Card padding="lg" className="text-center">
                <Typography.H2 className="mb-2 text-[var(--color-primary)]">
                  {stats.creators.formatted}
                </Typography.H2>
                <Typography.Muted>{stats.creators.label}</Typography.Muted>
              </Card>
            </Grid>
          </Stack>
        </div>
      </section>

      {/* Featured Content Section */}
      <section className="py-16" style={{ background: 'var(--color-surface)' }}>
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={6}>
            <div className="text-center">
              <Typography.H2 className="mb-4">Featured Content</Typography.H2>
              <Typography.Muted>Discover trending edits from our community</Typography.Muted>
            </div>

            {/* Time-based Tabs */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setTimeRange('week')}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  timeRange === 'week'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                🔥 This Week
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  timeRange === 'month'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                📈 This Month
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  timeRange === 'all'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                ⏰ All Time
              </button>
            </div>

            {/* Video Grid */}
            {loading ? (
              <div className="text-center py-12">
                <Typography.Muted>Loading featured content...</Typography.Muted>
              </div>
            ) : topVideos.length > 0 ? (
              <Grid cols={{ mobile: 1, tablet: 2, desktop: 4 }} gap={{ mobile: 4, desktop: 6 }}>
                {topVideos.slice(0, 8).map((video, index) => (
                  <VideoCard key={video.id || index} video={video} rank={index + 1} />
                ))}
              </Grid>
            ) : (
              <div className="text-center py-12">
                <Typography.Muted>No featured content available at this time.</Typography.Muted>
              </div>
            )}
          </Stack>
        </div>
      </section>

      {/* Rankings / Hall of Fame Section */}
      <section className="py-16">
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={6}>
            <div className="text-center">
              <Typography.H2 className="mb-4">Hall of Fame</Typography.H2>
              <Typography.Muted>The top-ranked edits of all time</Typography.Muted>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Typography.Muted>Loading rankings...</Typography.Muted>
              </div>
            ) : topVideos.length > 0 ? (
              <Grid cols={{ mobile: 1, desktop: 2 }} gap={{ mobile: 4, desktop: 6 }}>
                {topVideos.slice(0, 5).map((video, index) => {
                  const rank = index + 1;
                  const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                  
                  return (
                    <Card key={video.id || index} padding="md" className={rank <= 3 ? 'ring-2 ring-[var(--color-warning)]' : ''}>
                      <div className="flex items-start gap-4">
                        <div className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                          {rankIcon}
                        </div>
                        <div className="flex-1">
                          <VideoCard video={video} rank={rank} ranked={true} />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </Grid>
            ) : (
              <div className="text-center py-12">
                <Typography.Muted>No rankings available at this time.</Typography.Muted>
              </div>
            )}

            <div className="text-center">
              <Link href="/edits">
                <Button variant="secondary">View Complete Rankings</Button>
              </Link>
            </div>
          </Stack>
        </div>
      </section>

      {/* Explainer Section */}
      <section className="py-16" style={{ background: 'var(--color-surface)' }}>
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={8}>
            <div className="text-center max-w-3xl mx-auto">
              <Typography.H2 className="mb-6">What Are Fan Edits?</Typography.H2>
              <Typography.Text className="mb-4">
                Fan edits are creative video remixes, trailers, and compilations created by passionate fans. 
                They transform original content into something entirely new, showcasing creativity, skill, and love for the source material.
              </Typography.Text>
              <Typography.Text>
                Our platform ranks these edits based on community engagement, views, and impact, 
                giving talented creators the recognition they deserve.
              </Typography.Text>
            </div>

            {/* 4-Step Process Cards */}
            <Grid cols={{ mobile: 1, tablet: 2, desktop: 4 }} gap={{ mobile: 4, desktop: 6 }}>
              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, var(--color-info), var(--color-primary))' }}>
                <div className="text-4xl mb-4">▶️</div>
                <Typography.H3 className="mb-2 text-white">Discover Amazing Edits</Typography.H3>
                <Typography.Text className="text-white/90">
                  Browse through thousands of creative fan edits from talented creators worldwide.
                </Typography.Text>
              </Card>
              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
                <div className="text-4xl mb-4">❤️</div>
                <Typography.H3 className="mb-2 text-white">Vote for Your Favorites</Typography.H3>
                <Typography.Text className="text-white/90">
                  Show your support by voting for edits that inspire and entertain you.
                </Typography.Text>
              </Card>
              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, var(--color-success), #14b8a6)' }}>
                <div className="text-4xl mb-4">📤</div>
                <Typography.H3 className="mb-2 text-white">Share & Get Discovered</Typography.H3>
                <Typography.Text className="text-white/90">
                  Share your favorite edits and help creators gain the recognition they deserve.
                </Typography.Text>
              </Card>
              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, var(--color-warning), #f59e0b)' }}>
                <div className="text-4xl mb-4">🏆</div>
                <Typography.H3 className="mb-2 text-white">Climb the Rankings</Typography.H3>
                <Typography.Text className="text-white/90">
                  Watch as your favorite edits rise through the ranks based on community engagement.
                </Typography.Text>
              </Card>
            </Grid>

            {/* Popular Edit Types */}
            <div className="mt-8">
              <Typography.H3 className="mb-6 text-center">Popular Edit Types</Typography.H3>
              <Grid cols={{ mobile: 1, desktop: 3 }} gap={{ mobile: 4, desktop: 6 }}>
                <Card padding="md">
                  <Typography.H4 className="mb-2">🎬 Alternative Movie Trailers</Typography.H4>
                  <Typography.Muted>
                    Creative reimaginations of movie trailers with new music, pacing, and narrative focus.
                  </Typography.Muted>
                </Card>
                <Card padding="md">
                  <Typography.H4 className="mb-2">⚽ Sports Highlight Reels</Typography.H4>
                  <Typography.Muted>
                    Epic compilations of sports moments set to music, capturing the intensity and emotion of the game.
                  </Typography.Muted>
                </Card>
                <Card padding="md">
                  <Typography.H4 className="mb-2">🎵 Music Video Remixes</Typography.H4>
                  <Typography.Muted>
                    Fan-made music videos combining visuals from movies, shows, or games with popular songs.
                  </Typography.Muted>
                </Card>
              </Grid>
            </div>

            {/* Bottom CTAs */}
            <Cluster gap={4} justify="center" className="mt-8">
              <Link href="/upload">
                <Button size="lg">Submit Your First Edit</Button>
              </Link>
              <Link href="/communities">
                <Button variant="secondary" size="lg">Browse Community</Button>
              </Link>
            </Cluster>
          </Stack>
        </div>
      </section>

      {/* Creator Spotlight Section */}
      <section className="py-16">
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={8}>
            <div className="text-center">
              <Typography.H2 className="mb-4">Meet Our Top Creators</Typography.H2>
              <Typography.Muted>Talented creators making amazing content</Typography.Muted>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Typography.Muted>Loading creators...</Typography.Muted>
              </div>
            ) : topCreators.length > 0 ? (
              <>
                <Grid cols={{ mobile: 1, tablet: 2, desktop: 3 }} gap={{ mobile: 4, desktop: 6 }}>
                  {topCreators.slice(0, 3).map((creator, index) => {
                    const badges = ['🏆 Creator of the Week', '🔥 Trending Creator', '⭐ Rising Star'];
                    return (
                      <Card key={creator.id || index} padding="lg">
                        <Stack gap={4}>
                          <Badge variant="primary">{badges[index] || 'Featured Creator'}</Badge>
                          <CreatorCard creator={creator} variant="list" />
                          <Link href={`/creator/${creator.id}`}>
                            <Button variant="secondary" className="w-full">View Profile</Button>
                          </Link>
                        </Stack>
                      </Card>
                    );
                  })}
                </Grid>

                {/* Creator Community Stats */}
                <Grid cols={{ mobile: 2, desktop: 4 }} gap={{ mobile: 4, desktop: 6 }} className="mt-8">
                  <Card padding="md" className="text-center">
                    <div className="text-2xl mb-2">👥</div>
                    <Typography.H3>{stats.creators.formatted}</Typography.H3>
                    <Typography.Muted>Active Creators</Typography.Muted>
                  </Card>
                  <Card padding="md" className="text-center">
                    <div className="text-2xl mb-2">🏆</div>
                    <Typography.H3>850+</Typography.H3>
                    <Typography.Muted>Award Winners</Typography.Muted>
                  </Card>
                  <Card padding="md" className="text-center">
                    <div className="text-2xl mb-2">📈</div>
                    <Typography.H3>+32%</Typography.H3>
                    <Typography.Muted>Growth This Month</Typography.Muted>
                  </Card>
                  <Card padding="md" className="text-center">
                    <div className="text-2xl mb-2">⭐</div>
                    <Typography.H3>4.8</Typography.H3>
                    <Typography.Muted>Avg. Rating</Typography.Muted>
                  </Card>
                </Grid>

                <Cluster gap={4} justify="center">
                  <Link href="/creators">
                    <Button variant="secondary">Browse All Creators</Button>
                  </Link>
                </Cluster>
              </>
            ) : (
              <div className="text-center py-12">
                <Typography.Muted>No creators available at this time.</Typography.Muted>
              </div>
            )}
          </Stack>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-16" style={{ background: 'var(--color-surface)' }}>
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={8}>
            <div className="text-center">
              <Typography.H2 className="mb-4">What Our Community Says</Typography.H2>
              <Typography.Muted>Join thousands of creators and fans</Typography.Muted>
            </div>

            {/* Community Stats */}
            <Grid cols={{ mobile: 2, desktop: 4 }} gap={{ mobile: 4, desktop: 6 }}>
              <Card padding="md" className="text-center">
                <Typography.H3>25K+</Typography.H3>
                <Typography.Muted>Community Members</Typography.Muted>
              </Card>
              <Card padding="md" className="text-center">
                <Typography.H3>150K+</Typography.H3>
                <Typography.Muted>Comments Posted</Typography.Muted>
              </Card>
              <Card padding="md" className="text-center">
                <Typography.H3>2.8M+</Typography.H3>
                <Typography.Muted>Votes Cast</Typography.Muted>
              </Card>
              <Card padding="md" className="text-center">
                <Typography.H3>45K+</Typography.H3>
                <Typography.Muted>Edits Shared</Typography.Muted>
              </Card>
            </Grid>

            {/* Community Features */}
            <div className="mt-8">
              <Typography.H3 className="mb-6 text-center">Community Features</Typography.H3>
              <Grid cols={{ mobile: 2, desktop: 3 }} gap={{ mobile: 4, desktop: 6 }}>
                {[
                  { icon: '🤝', title: 'Supportive Environment', desc: 'A welcoming community for all creators' },
                  { icon: '🎯', title: 'Fair Recognition System', desc: 'Transparent ranking based on engagement' },
                  { icon: '🌟', title: 'Growth Opportunities', desc: 'Get discovered and grow your audience' },
                  { icon: '📚', title: 'Learning Resources', desc: 'Tips and tutorials from top creators' },
                  { icon: '🏆', title: 'Regular Contests', desc: 'Compete and win prizes' },
                  { icon: '💬', title: 'Active Discussion', desc: 'Engage with creators and fans' },
                ].map((feature, index) => (
                  <Card key={index} padding="md">
                    <div className="text-3xl mb-2">{feature.icon}</div>
                    <Typography.H4 className="mb-2">{feature.title}</Typography.H4>
                    <Typography.Muted>{feature.desc}</Typography.Muted>
                  </Card>
                ))}
              </Grid>
            </div>

            <Cluster gap={4} justify="center" className="mt-8">
              <Link href="/communities">
                <Button size="lg">Join Community</Button>
              </Link>
              <Link href="/edits">
                <Button variant="secondary" size="lg">Browse Edits</Button>
              </Link>
            </Cluster>
          </Stack>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container-base max-w-[1440px] mx-auto px-4">
          <Stack gap={8} align="center">
            <div className="text-center max-w-3xl">
              <Badge variant="primary" size="lg" className="mb-4">
                Ready to get started?
              </Badge>
              <Typography.H1 className="mb-6">Your Creative Journey Starts Here</Typography.H1>
              <Typography.Text className="text-lg text-[var(--color-text-muted)]">
                Whether you're a creator, fan, or brand, there's a place for you in our community.
              </Typography.Text>
            </div>

            {/* Audience-Specific Cards */}
            <Grid cols={{ mobile: 1, desktop: 3 }} gap={{ mobile: 4, desktop: 6 }} className="w-full max-w-5xl">
              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, var(--color-warning), #f59e0b)' }}>
                <div className="text-4xl mb-4">📤</div>
                <Typography.H3 className="mb-4 text-white">For Creators</Typography.H3>
                <Stack gap={3} align="start" className="text-left mb-6">
                  <Typography.Text className="text-white/90">• Upload your best edits</Typography.Text>
                  <Typography.Text className="text-white/90">• Get discovered by fans</Typography.Text>
                  <Typography.Text className="text-white/90">• Climb the rankings</Typography.Text>
                  <Typography.Text className="text-white/90">• Build your audience</Typography.Text>
                </Stack>
                <Link href="/upload">
                  <Button variant="secondary" className="w-full bg-white text-gray-900 hover:bg-gray-100">
                    Start Creating
                  </Button>
                </Link>
              </Card>

              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, var(--color-info), var(--color-primary))' }}>
                <div className="text-4xl mb-4">👥</div>
                <Typography.H3 className="mb-4 text-white">For Fans</Typography.H3>
                <Stack gap={3} align="start" className="text-left mb-6">
                  <Typography.Text className="text-white/90">• Discover amazing edits</Typography.Text>
                  <Typography.Text className="text-white/90">• Vote for favorites</Typography.Text>
                  <Typography.Text className="text-white/90">• Share with friends</Typography.Text>
                  <Typography.Text className="text-white/90">• Join discussions</Typography.Text>
                </Stack>
                <Link href="/edits">
                  <Button variant="secondary" className="w-full bg-white text-gray-900 hover:bg-gray-100">
                    Explore Community
                  </Button>
                </Link>
              </Card>

              <Card padding="lg" className="text-center" style={{ background: 'linear-gradient(135deg, var(--color-success), #14b8a6)' }}>
                <div className="text-4xl mb-4">🎯</div>
                <Typography.H3 className="mb-4 text-white">For Brands</Typography.H3>
                <Stack gap={3} align="start" className="text-left mb-6">
                  <Typography.Text className="text-white/90">• Find top creators</Typography.Text>
                  <Typography.Text className="text-white/90">• Launch campaigns</Typography.Text>
                  <Typography.Text className="text-white/90">• Track performance</Typography.Text>
                  <Typography.Text className="text-white/90">• Measure impact</Typography.Text>
                </Stack>
                {userIsAdmin ? (
                  <Link href="/campaign">
                    <Button variant="secondary" className="w-full bg-white text-gray-900 hover:bg-gray-100">
                      Partner With Us
                    </Button>
                  </Link>
                ) : (
                  <Button variant="secondary" className="w-full bg-white text-gray-900 hover:bg-gray-100" disabled>
                    Partner With Us
                  </Button>
                )}
              </Card>
            </Grid>

            {/* Bottom Stats Bar */}
            <div className="w-full max-w-4xl mt-8">
              <Card padding="md">
                <Grid cols={{ mobile: 2, desktop: 4 }} gap={{ mobile: 4, desktop: 6 }}>
                  <div className="text-center">
                    <Typography.H4>{stats.videos.formatted}</Typography.H4>
                    <Typography.Muted>Active Edits</Typography.Muted>
                  </div>
                  <div className="text-center">
                    <Typography.H4>25K+</Typography.H4>
                    <Typography.Muted>Community Members</Typography.Muted>
                  </div>
                  <div className="text-center">
                    <Typography.H4>{stats.views.formatted}</Typography.H4>
                    <Typography.Muted>Total Views</Typography.Muted>
                  </div>
                  <div className="text-center">
                    <Typography.H4>2.5K+</Typography.H4>
                    <Typography.Muted>Brand Partnerships</Typography.Muted>
                  </div>
                </Grid>
              </Card>
            </div>
          </Stack>
        </div>
      </section>
    </div>
  );
}
