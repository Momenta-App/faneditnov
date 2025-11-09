'use client';

import React from 'react';
import { Button } from '../Button';
import { Typography } from '../Typography';
import { Stack, Inline } from '../layout';

interface EmptyStateProps {
  illustration: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * EmptyState - Theme-aware empty state component
 * Uses Typography components and spacing tokens
 */
export function EmptyState({
  illustration,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  isLoading = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-[var(--spacing-16)] px-[var(--spacing-4)] ${className}`}>
      <Stack gap={6} align="center">
        {/* Illustration */}
        <div className="max-w-md">{illustration}</div>

        {/* Title */}
        <Typography.H2 className="text-center">{title}</Typography.H2>

        {/* Description */}
        <Typography.Muted className="text-center max-w-md">{description}</Typography.Muted>

        {/* Actions */}
        {(actionText || secondaryActionText) && (
          <Inline gap={3} wrap>
            {actionText && onAction && (
              <Button
                variant="primary"
                onClick={onAction}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : actionText}
              </Button>
            )}
            {secondaryActionText && onSecondaryAction && (
              <Button
                variant="secondary"
                onClick={onSecondaryAction}
                disabled={isLoading}
              >
                {secondaryActionText}
              </Button>
            )}
          </Inline>
        )}
      </Stack>
    </div>
  );
}

