'use client';

import React from 'react';
import { Button } from './Button';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  };
  className?: string;
  noPaddingBottom?: boolean;
}

/**
 * PageHeader - Premium page header with gradient accents
 * Features refined typography, elegant spacing, and premium visual effects
 */
export function PageHeader({
  title,
  description,
  action,
  className = '',
  noPaddingBottom = false,
}: PageHeaderProps) {
  const paddingClass = noPaddingBottom ? 'pt-16 md:pt-20' : 'py-16 md:py-20';
  
  return (
    <div 
      className={`premium-header-container ${className}`}
      style={{ 
        '--bar-bg': 'var(--color-surface)',
        position: 'relative',
        overflow: 'hidden'
      } as React.CSSProperties}
    >
      {/* Premium gradient background */}
      <div 
        className="premium-gradient-bg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background) 100%)',
          opacity: 0.7,
          zIndex: 0
        }}
      />
      
      {/* Subtle accent gradient overlay */}
      <div 
        className="premium-accent-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, var(--color-primary) 50%, transparent 100%)',
          opacity: 0.3
        }}
      />

      <div className={`container-base max-w-[1440px] mx-auto ${paddingClass}`} style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          {/* Title and Description */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="inline-flex items-center gap-3 mb-2">
              {/* Decorative accent line */}
              <div 
                style={{
                  width: '4px',
                  height: '40px',
                  background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-light))',
                  borderRadius: '2px',
                  boxShadow: '0 0 20px var(--color-primary)'
                }}
              />
              <h1 
                className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight premium-title"
                style={{ 
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.1'
                }}
              >
                {title}
              </h1>
            </div>
            {description && (
              <p 
                className="text-xl md:text-2xl max-w-3xl leading-relaxed premium-description"
                style={{ 
                  color: 'var(--color-text-muted)',
                  fontWeight: 400,
                  letterSpacing: '-0.01em'
                }}
              >
                {description}
              </p>
            )}
          </div>

          {/* Action Button */}
          {action && (
            <div className="shrink-0 lg:pt-2">
              <Button 
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                className="w-full lg:w-auto premium-cta-button shadow-lg hover:shadow-xl transition-all duration-300"
                style={{
                  padding: '14px 32px',
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  backgroundColor: '#1E90FF',
                  color: 'white'
                }}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
