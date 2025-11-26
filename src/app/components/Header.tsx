'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { Button } from './Button';
import { isAdmin as isAdminRole } from '@/lib/role-utils';

export function Header() {
  const pathname = usePathname();
  const { user, profile, signOut, isLoading } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };

  const baseNavItems = [
    { name: 'Edits', href: '/edits' },
    { name: 'Creators', href: '/creators' },
    { name: 'Hashtags', href: '/hashtags' },
    { name: 'Sounds', href: '/sounds' },
    { name: 'Communities', href: '/communities' },
    { name: 'Contests', href: '/contests' },
    { name: 'Upload', href: '/upload' },
  ];

  // Only show Campaign link for admin users
  const campaignItem = { name: 'Campaign', href: '/campaign' };
  const navItems = !isLoading && isAdminRole(profile?.role)
    ? [...baseNavItems, campaignItem]
    : baseNavItems;

  const adminNavItems =
    !isLoading && isAdminRole(profile?.role)
      ? [{ name: 'Admin', href: '/admin/contests' }]
      : [];

  return (
    <header 
      className="bar sticky top-0 z-[var(--z-header)] backdrop-blur-md border-b border-[var(--color-border)]"
      style={{ '--bar-bg': 'var(--color-surface)' } as React.CSSProperties}
    >
      <nav className="container-base max-w-[1440px] mx-auto" aria-label="Main">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 focus-ring rounded-lg p-2 -ml-2 transition-all hover:scale-105">
              <span className="text-xl font-bold text-[var(--color-text-primary)]">
                Fan Activation
              </span>
            </Link>
          </div>

          {/* Desktop Navigation + Controls */}
          <div className="hidden lg:flex lg:items-center lg:gap-3 grow justify-end">
            <div className="flex items-center gap-3">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold transition-all focus-ring min-h-[44px] ${
                    isActive(item.href)
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="relative z-10">{item.name}</span>
                  {isActive(item.href) && (
                    <span className="absolute inset-0 bg-[var(--color-primary)]/10 rounded-lg"></span>
                  )}
                </Link>
              ))}
              {adminNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold transition-all focus-ring min-h-[44px] ${
                    isActive(item.href)
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="relative z-10">{item.name}</span>
                  {isActive(item.href) && (
                    <span className="absolute inset-0 bg-[var(--color-primary)]/10 rounded-lg"></span>
                  )}
                </Link>
              ))}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 focus-ring transition-colors"
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                  type="button"
                >
                  {theme === 'dark' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              )}
              {user && profile ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-border)]/30 transition-all"
                  >
                    <img 
                      src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || profile.email)}&background=2563eb&color=fff`}
                      alt={profile.display_name || profile.email}
                      className="w-8 h-8 rounded-full ring-1 ring-[var(--color-border)]"
                    />
                    <span className="text-sm text-[var(--color-text-primary)] hidden xl:inline font-medium">
                      {profile.display_name || profile.email.split('@')[0]}
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={signOut}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth/login">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button 
                      variant="secondary" 
                      size="sm"
                    >
                      Sign Up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 focus-ring transition-all"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-[var(--color-border)] mt-2">
            <div className="flex flex-col space-y-2 pt-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`relative inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                    isActive(item.href)
                      ? 'text-[var(--color-primary)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="relative z-10 flex items-center">
                    {isActive(item.href) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mr-2"></span>
                    )}
                    {item.name}
                  </span>
                  {isActive(item.href) && (
                    <span className="absolute inset-0 bg-[var(--color-primary)]/10 rounded-lg"></span>
                  )}
                </Link>
              ))}
              {adminNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`relative inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                    isActive(item.href)
                      ? 'text-[var(--color-primary)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="relative z-10 flex items-center">
                    {isActive(item.href) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mr-2"></span>
                    )}
                    {item.name}
                  </span>
                  {isActive(item.href) && (
                    <span className="absolute inset-0 bg-[var(--color-primary)]/10 rounded-lg"></span>
                  )}
                </Link>
              ))}
              {user && profile ? (
                <div className="px-3 py-3 border-t border-[var(--color-border)] mt-1">
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 mb-2 p-2 rounded-lg hover:bg-[var(--color-border)]/30 transition-all"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <img 
                      src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || profile.email)}&background=2563eb&color=fff`}
                      alt={profile.display_name || profile.email}
                      className="w-8 h-8 rounded-full ring-1 ring-[var(--color-border)]" 
                    />
                    <span className="text-sm text-[var(--color-text-primary)] font-medium">
                      {profile.display_name || profile.email.split('@')[0]}
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="text-gray-300 w-full"
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 px-3 pt-2">
                  {/* Theme Toggle in Mobile Menu */}
                  {mounted && (
                    <button
                      onClick={() => {
                        toggleTheme();
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 focus-ring transition-colors"
                      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                      type="button"
                    >
                      {theme === 'dark' ? (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span>Light Mode</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                          </svg>
                          <span>Dark Mode</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

