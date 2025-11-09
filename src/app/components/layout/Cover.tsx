'use client';

import React from 'react';

interface CoverProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: 'screen' | 'auto' | string;
  center?: boolean;
}

/**
 * Cover - Full viewport hero sections with centered content
 * Mobile: Padding from tokens, responsive min-height
 */
export function Cover({
  children,
  className = '',
  minHeight = 'screen',
  center = true,
}: CoverProps) {
  const heightClass = minHeight === 'screen' 
    ? 'min-h-screen' 
    : minHeight === 'auto' 
    ? 'min-h-0' 
    : minHeight;

  return (
    <div
      className={`
        ${heightClass}
        ${center ? 'flex items-center justify-center' : ''}
        px-[var(--spacing-4)] sm:px-[var(--spacing-6)] lg:px-[var(--spacing-8)]
        ${className}
      `}
    >
      {center ? (
        <div className="w-full max-w-7xl mx-auto">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

