'use client';

import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * When true, removes max-width constraint for full-width layouts
   * Use for full-bleed sections that still need centered content
   */
  fullWidth?: boolean;
}

/**
 * Container - Standardized centered container with responsive gutters
 * - Never lets content touch viewport edges
 * - Max-width: 1440px on desktop
 * - Responsive padding with safe-area support
 * - Framework-agnostic with optional Tailwind support
 */
export function Container({ children, className = '', fullWidth = false }: ContainerProps) {
  return (
    <div
      className={`
        w-full
        mx-auto
        container-base
        ${fullWidth ? '' : 'max-w-[1440px]'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

