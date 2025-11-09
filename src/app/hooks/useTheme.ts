'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Get initial theme from localStorage or system preference
    const stored = localStorage.getItem('theme') as Theme | null;
    
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      // Default to dark theme
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        // Only auto-update if user hasn't set a preference
        const newTheme: Theme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setThemePersistent = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setThemePersistent(newTheme);
  };

  return {
    theme: theme || 'dark', // Default to dark while mounting
    setTheme: setThemePersistent,
    toggleTheme,
    mounted, // Useful for avoiding hydration mismatches
  };
}
