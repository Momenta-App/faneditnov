'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

/**
 * Button - Theme-aware button component with token-based styling
 * 
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="ghost" size="sm">Cancel</Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Variants using theme tokens with explicit blue colors for visibility
  const variantClasses = {
    primary: 'text-white hover:opacity-90 active:opacity-80 shadow-md hover:shadow-lg border-2',
    secondary: 'bg-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-hover)] active:bg-[var(--color-border-hover)]',
    ghost: 'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 active:bg-[var(--color-border)]',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90 active:bg-[var(--color-danger)]/80',
  };
  
  // Sizes with generous padding on all sides - text should never touch edges
  // Smaller text with significantly more vertical and horizontal padding (using direct px values)
  const sizeClasses = {
    xs: 'px-5 py-2 text-[11px] min-h-[44px] min-w-[80px]', // 20px horizontal, 8px vertical, min 80px wide
    sm: 'px-6 py-3 text-xs min-h-[44px] min-w-[100px]', // 24px horizontal, 12px vertical, min 100px wide
    md: 'px-8 py-4 text-xs min-h-[44px] min-w-[120px]', // 32px horizontal, 16px vertical, min 120px wide
    lg: 'px-10 py-5 text-sm min-h-[48px] min-w-[140px]', // 40px horizontal, 20px vertical, min 140px wide
  };

  // Get inline styles for primary variant to ensure blue is visible
  const getStyles = () => {
    const baseStyles = variant === 'primary' 
      ? {
          backgroundColor: 'var(--color-primary)',
          borderColor: 'var(--color-primary)',
        }
      : {};
    
    // Merge with any styles passed through props
    return { ...baseStyles, ...props.style };
  };

  const { style, ...otherProps } = props;

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      style={getStyles()}
      disabled={disabled || isLoading}
      {...otherProps}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}

