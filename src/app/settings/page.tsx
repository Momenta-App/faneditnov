'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Page, PageSection, Stack } from '../components/layout';

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
        </div>
      </PageSection>
    </Page>
  );
}

function ProfileSection() {
  const { profile, user } = useAuth();
  const [showCreatorInfo, setShowCreatorInfo] = useState(false);
  const [showBrandInfo, setShowBrandInfo] = useState(false);

  // Map role to display name (frontend only)
  const getRoleDisplayName = (role: string) => {
    if (role === 'standard') return 'Fan';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (!profile || !user) {
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

            {/* Display Name */}
            {profile.display_name && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">
                  Display Name
                </label>
                <div className="text-[var(--color-text-primary)] font-medium">
                  {profile.display_name}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Account Role */}
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
              Account Role
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your current role and available roles
            </p>
          </div>

          <div className="space-y-3">
            {/* Fan Role */}
            <div className={`relative p-5 rounded-[var(--radius-lg)] border-2 transition-all ${
              profile.role === 'standard'
                ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                : 'bg-[var(--color-surface)] border-[var(--color-border)]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    profile.role === 'standard'
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                  }`}>
                    F
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-semibold ${
                        profile.role === 'standard'
                          ? 'text-[var(--color-primary)]'
                          : 'text-[var(--color-text-primary)]'
                      }`}>
                        Fan
                      </span>
                      {profile.role === 'standard' && (
                        <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Standard account with basic features
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Creator Role */}
            <div className="relative">
              <div className={`relative p-5 rounded-[var(--radius-lg)] border-2 transition-all ${
                profile.role === 'creator'
                  ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      profile.role === 'creator'
                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                    }`}>
                      C
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-semibold ${
                          profile.role === 'creator'
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-text-primary)]'
                        }`}>
                          Creator
                        </span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowCreatorInfo(!showCreatorInfo)}
                            onBlur={() => setTimeout(() => setShowCreatorInfo(false), 200)}
                            className="p-1 rounded-full hover:bg-[var(--color-surface)] transition-colors focus-ring"
                            aria-label="Creator role information"
                          >
                            <svg className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {showCreatorInfo && (
                            <div className="absolute right-0 bottom-full mb-2 z-20 w-80 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)]">
                              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                Want to become a Creator? Reach out to us to get Creator privileges.
                              </p>
                            </div>
                          )}
                        </div>
                        {profile.role === 'creator' && (
                          <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Enhanced features for content creators
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Role */}
            <div className="relative">
              <div className={`relative p-5 rounded-[var(--radius-lg)] border-2 transition-all ${
                profile.role === 'brand'
                  ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      profile.role === 'brand'
                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                    }`}>
                      B
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-semibold ${
                          profile.role === 'brand'
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-text-primary)]'
                        }`}>
                          Brand
                        </span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowBrandInfo(!showBrandInfo)}
                            onBlur={() => setTimeout(() => setShowBrandInfo(false), 200)}
                            className="p-1 rounded-full hover:bg-[var(--color-surface)] transition-colors focus-ring"
                            aria-label="Brand role information"
                          >
                            <svg className="w-4 h-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.829V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {showBrandInfo && (
                            <div className="absolute right-0 bottom-full mb-2 z-20 w-80 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)]">
                              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                Want to gain Brand privileges? Reach out to us to get Brand privileges.
                              </p>
                            </div>
                          )}
                        </div>
                        {profile.role === 'brand' && (
                          <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Tools and features for brands
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Role - Only visible to admin users */}
            {profile.role === 'admin' && (
              <div className={`relative p-5 rounded-[var(--radius-lg)] border-2 bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-sm)]`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
                      A
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-[var(--color-primary)]">
                          Admin
                        </span>
                        <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                          Current
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Full system access and administration
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
