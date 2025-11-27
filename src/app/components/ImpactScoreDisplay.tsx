'use client';

import React, { useState } from 'react';

interface ImpactScoreDisplayProps {
  score: number;
  className?: string;
  showTooltip?: boolean;
}

/**
 * ImpactScoreDisplay - Formatted impact score with optional tooltip
 */
export function ImpactScoreDisplay({
  score,
  className = '',
  showTooltip = true,
}: ImpactScoreDisplayProps) {
  const [showTooltipState, setShowTooltipState] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className="font-semibold text-[var(--color-text-primary)] cursor-help"
        onMouseEnter={() => setShowTooltipState(true)}
        onMouseLeave={() => setShowTooltipState(false)}
      >
        {Number(score).toFixed(2)}
      </div>
      {showTooltip && showTooltipState && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg text-sm">
          <p className="text-[var(--color-text-primary)] font-medium mb-1">
            Impact Score
          </p>
          <p className="text-[var(--color-text-muted)] text-xs">
            Impact is a single score that blends views, likes, comments and other private engagement
            signals, rewarding sustained performance instead of one-off spikes.
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mt-2 font-mono">
            Formula: 100 × comments + 0.001 × likes + views ÷ 100,000 + weighted private engagement
          </p>
        </div>
      )}
    </div>
  );
}

