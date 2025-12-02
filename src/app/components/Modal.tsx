'use client';

import React, { useEffect, useRef } from 'react';

interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

/**
 * Modal - Base modal component with backdrop, focus trap, and ESC key support
 * Note: VideoModal.tsx is protected and should not use this base component
 * 
 * @example
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit">
 *   <p>Modal content</p>
 * </Modal>
 */
export function Modal({ 
  children, 
  isOpen, 
  onClose, 
  title,
  className = '',
  maxWidth = 'lg'
}: ModalProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const scrollYRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      scrollYRef.current = window.scrollY;
      
      // Save current focus
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Prevent body scroll while maintaining scroll position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = '100%';
      
      // Focus first focusable element in modal
      const firstFocusable = modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    } else {
      // Restore scroll position
      const scrollY = scrollYRef.current;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
      
      // Restore focus without scrolling
      if (previousActiveElement.current) {
        previousActiveElement.current.focus({ preventScroll: true });
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-backdrop)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[var(--color-background)]/80 backdrop-blur-sm"
        aria-hidden="true"
      />
      
      {/* Modal Content */}
      <div
        ref={modalRef}
        className={`
          relative 
          z-[var(--z-modal)]
          bg-[var(--color-surface)]
          rounded-[var(--radius-lg)]
          shadow-xl
          ${maxWidthClasses[maxWidth]}
          w-full
          max-h-[90vh]
          overflow-y-auto
          ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="flex items-center justify-between p-[var(--spacing-6)] border-b border-[var(--color-border)]">
            <h2 id="modal-title" className="text-xl font-bold text-[var(--color-text-primary)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-[var(--spacing-2)] rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 focus-ring transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        <div className={title ? 'p-[var(--spacing-6)]' : 'p-[var(--spacing-6)]'}>
          {children}
        </div>
      </div>
    </div>
  );
}

