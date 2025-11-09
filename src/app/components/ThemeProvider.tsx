'use client';

import { useEffect } from 'react';

/**
 * ThemeProvider - Initializes theme on mount to prevent flash of wrong theme
 * This runs before React hydrates, setting the theme immediately
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Get stored theme preference
    const stored = localStorage.getItem('theme');
    
    if (stored) {
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      // No stored preference, default to dark theme
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  return <>{children}</>;
}
