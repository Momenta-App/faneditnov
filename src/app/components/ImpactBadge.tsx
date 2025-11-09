import React from 'react';

interface ImpactBadgeProps {
  impact: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ImpactBadge({ impact, size = 'md', showLabel = true }: ImpactBadgeProps) {
  const formatImpact = (num: number): string => {
    if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return Math.round(num).toString();
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}
      title="Impact Score: Comments are weighted most, other metrics are small tiebreakers"
    >
      <svg className={iconSize[size]} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
      {showLabel && <span className="opacity-90">Impact</span>}
      <span className="font-bold">{formatImpact(impact)}</span>
    </span>
  );
}

