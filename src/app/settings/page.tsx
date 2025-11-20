'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useCampaigns } from '../hooks/useData';
import { Card } from '../components/Card';
import { Page, PageSection, Stack } from '../components/layout';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  // Show nothing while loading or redirecting
  if (isLoading || !user) {
    return null;
  }

  return (
    <Page>
      {/* Header */}
      <PageSection variant="header">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">Settings</h1>
          <p className="text-[var(--color-text-muted)]">
            View your account information and role
          </p>
        </div>
      </PageSection>

      {/* Main Content */}
      <PageSection variant="content">
        <div className="max-w-3xl mx-auto">
          <ProfileSection />
          <SavedCampaignsSection />
        </div>
      </PageSection>
    </Page>
  );
}

function SavedCampaignsSection() {
  const router = useRouter();
  const { data: campaigns, loading } = useCampaigns();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
            Saved Campaigns
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Your generated campaigns
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign: any) => {
              // Extract name from AI payload if available
              const aiPayload = campaign.ai_payload;
              const displayName = aiPayload
                ? `${aiPayload.sport} - ${aiPayload.league}`
                : campaign.name;

              return (
                <div
                  key={campaign.id}
                  className="p-4 rounded-lg border flex items-center justify-between"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div>
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
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
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No saved campaigns yet. Create one from the Campaign page.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProfileSection() {
  const { user, profile } = useAuth();

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
              Account Information
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your account details
            </p>
          </div>

          <div className="space-y-5">
            {/* Email */}
            <div className="pb-5 border-b border-[var(--color-border)]">
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[var(--color-text-primary)] font-medium">
                  {profile.email}
                </span>
                {profile.email_verified ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs font-medium rounded-full border border-[var(--color-success)]/20">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] text-xs font-medium rounded-full border border-[var(--color-border)]">
                    Unverified
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      </Card>

      {/* Account Role - Simplified for simple auth */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
              Account Role
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your current role: {profile.role}
            </p>
          </div>
          <div className={`p-5 rounded-[var(--radius-lg)] border-2 bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-sm)]`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
                {profile.role.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-[var(--color-primary)]">
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </span>
                  <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                    Current
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {profile.role === 'admin' ? 'Full system access and administration' :
                   profile.role === 'brand' ? 'Tools and features for brands' :
                   profile.role === 'creator' ? 'Enhanced features for content creators' :
                   'Standard account with basic features'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
