'use client';

import React from 'react';
import Link from 'next/link';

interface CreatorLinkProps {
  creator?: {
    id: string;
    displayName?: string;
    display_name?: string;
    username?: string;
  };
  creatorId?: string;
  displayName?: string;
  username?: string;
  children?: React.ReactNode;
  className?: string;
  truncate?: boolean;
  maxLength?: number;
  noLink?: boolean; // If true, render as span instead of link (useful when parent is already a link)
}

/**
 * CreatorLink - Wraps creator names in clickable links that route to creator profile pages
 * 
 * @example
 * <CreatorLink creator={creator}>{creator.displayName}</CreatorLink>
 * <CreatorLink creatorId="123" displayName="John Doe">John Doe</CreatorLink>
 */
export function CreatorLink({
  creator,
  creatorId,
  displayName,
  username,
  children,
  className = '',
  truncate = false,
  maxLength = 30,
  noLink = false,
}: CreatorLinkProps) {
  // Determine the creator ID
  const id = creator?.id || creatorId;
  
  // Determine the display name from various sources
  const name = 
    children?.toString() || 
    creator?.displayName || 
    creator?.display_name || 
    creator?.username || 
    displayName || 
    username || 
    'Unknown Creator';

  // Truncate name if needed
  const truncatedName = truncate && name.length > maxLength 
    ? `${name.slice(0, maxLength)}...` 
    : name;

  // If noLink is true, render as span (useful when parent is already a link)
  if (noLink || !id) {
    return (
      <span className={className} title={truncate && name.length > maxLength ? name : undefined}>
        {truncatedName}
      </span>
    );
  }

  return (
    <Link
      href={`/creator/${id}`}
      className={`transition-colors focus-ring text-[var(--color-text-muted)] hover:text-[var(--color-primary)] ${className}`}
      title={truncate && name.length > maxLength ? name : undefined}
      aria-label={`View ${name}'s profile`}
    >
      {truncatedName}
    </Link>
  );
}

