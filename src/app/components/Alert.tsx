'use client';

import React from 'react';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  onClose?: () => void;
}

/**
 * Alert - Theme-aware alert component for error/success messages
 * 
 * @example
 * <Alert variant="success">Success message</Alert>
 * <Alert variant="danger">Error occurred</Alert>
 */
export function Alert({ 
  children, 
  variant = 'info',
  className = '',
  onClose
}: AlertProps) {
  const variantClasses = {
    success: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20',
    warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20',
    danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20',
    info: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/20',
  };

  return (
    <div
      className={`
        relative
        p-[var(--spacing-4)]
        rounded-[var(--radius-md)]
        border-[var(--border-width)]
        ${variantClasses[variant]}
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-start gap-[var(--spacing-3)]">
        <div className="flex-1">
          {children}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-[var(--spacing-1)] rounded-[var(--radius-sm)] hover:bg-current/20 focus-ring transition-colors"
            aria-label="Close alert"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

