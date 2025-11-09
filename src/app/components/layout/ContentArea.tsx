'use client';

import React from 'react';
import { Page } from './Page';

interface ContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ContentArea - Standard content area with Page container padding and max-width
 * Replaces ad hoc container-page usage
 */
export function ContentArea({ children, className = '' }: ContentAreaProps) {
  return (
    <Page className={className}>
      {children}
    </Page>
  );
}

