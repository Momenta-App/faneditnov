'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { supabaseClient } from '@/lib/supabase-client';

interface ContactBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  email: string;
  name: string;
  company: string;
  subject: string;
  message: string;
  honeypot?: string; // Add honeypot field
}

const MIN_FORM_TIME_MS = 3000; // Minimum 3 seconds to fill form

interface FormErrors {
  email?: string;
  name?: string;
  company?: string;
  subject?: string;
  message?: string;
  honeypot?: string;
}

const COOKIE_NAME = 'brand_contact_submitted';
const COOKIE_EXPIRY_DAYS = 365; // Store for 1 year (as long as browser can hold it)

// Helper functions to set and get cookies
const setCookie = (name: string, value: string, days: number) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export function ContactBrandModal({ isOpen, onClose, onSuccess }: ContactBrandModalProps) {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    name: '',
    company: '',
    subject: '',
    message: '',
    honeypot: '', // Initialize honeypot
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasAlreadySubmitted, setHasAlreadySubmitted] = useState(false);
  const formStartTimeRef = useRef<number | null>(null); // Track form start time

  // Check if user has already submitted when modal opens
  useEffect(() => {
    if (isOpen) {
      const cookie = getCookie(COOKIE_NAME);
      setHasAlreadySubmitted(!!cookie);
      // Record when form was opened
      formStartTimeRef.current = Date.now();
    } else {
      // Reset on close
      formStartTimeRef.current = null;
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Company validation
    if (!formData.company.trim()) {
      newErrors.company = 'Company is required';
    }

    // Subject validation
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    // Message validation
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // Calculate time taken to fill form
      const timeTaken = formStartTimeRef.current 
        ? Date.now() - formStartTimeRef.current 
        : 0;

      // Get session token for authentication
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Include Authorization header if user is logged in
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/brand/contact', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          formTime: timeTaken, // Send time taken
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Provide more specific error messages
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to send message';
        throw new Error(errorMsg);
      }

      // Set cookie to record that user has submitted
      setCookie(COOKIE_NAME, Date.now().toString(), COOKIE_EXPIRY_DAYS);
      setHasAlreadySubmitted(true);

      setSubmitStatus('success');
      // Reset form after successful submission
      setFormData({
        email: '',
        name: '',
        company: '',
        subject: '',
        message: '',
        honeypot: '', // Reset honeypot
      });

      // Show success message for 2 seconds, then close modal
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
        setSubmitStatus('idle');
      }, 2000);
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSubmitStatus('idle');
      setErrorMessage('');
      setErrors({});
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Contact Us">
      {submitStatus === 'success' ? (
        <div className="text-center py-8">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Message Sent Successfully!
          </h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your message has been sent. We&apos;ll get back to you soon.
          </p>
        </div>
      ) : hasAlreadySubmitted ? (
        <div className="text-center py-8">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Already Submitted
          </h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            You have already submitted a contact form. We&apos;ll review your message and get back to you soon.
          </p>
          <div className="mt-6">
            <Button
              type="button"
              variant="primary"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot field - hidden from users but visible to bots */}
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={formData.honeypot || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, honeypot: e.target.value }))}
              aria-hidden="true"
            />
          </div>

          <Input
            label="Your Email"
            type="email"
            placeholder="your.email@example.com"
            value={formData.email}
            onChange={handleChange('email')}
            error={errors.email}
            required
            disabled={hasAlreadySubmitted}
          />

          <Input
            label="Your Name"
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange('name')}
            error={errors.name}
            required
            disabled={hasAlreadySubmitted}
          />

          <Input
            label="Company"
            type="text"
            placeholder="Your Company"
            value={formData.company}
            onChange={handleChange('company')}
            error={errors.company}
            required
            disabled={hasAlreadySubmitted}
          />

          <Input
            label="Subject"
            type="text"
            placeholder="What is this regarding?"
            value={formData.subject}
            onChange={handleChange('subject')}
            error={errors.subject}
            required
            disabled={hasAlreadySubmitted}
          />

          <div className="w-full">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--spacing-2)]">
              Message
            </label>
            <textarea
              rows={5}
              placeholder="Your message..."
              value={formData.message}
              onChange={handleChange('message')}
              disabled={hasAlreadySubmitted}
              className={`
                w-full 
                px-[var(--spacing-4)] 
                py-[var(--spacing-2)] 
                border-[var(--border-width)]
                rounded-[var(--radius-md)]
                bg-[var(--color-surface)]
                text-[var(--color-text-primary)]
                transition-colors
                focus-ring
                placeholder:text-[var(--color-text-muted)]
                resize-none
                ${hasAlreadySubmitted ? 'opacity-50 cursor-not-allowed' : ''}
                ${errors.message ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
                ${!errors.message ? 'focus:border-[var(--color-primary)]' : ''}
              `}
              required
            />
            {errors.message && (
              <p className="mt-[var(--spacing-1)] text-sm text-[var(--color-danger)]" role="alert">
                {errors.message}
              </p>
            )}
          </div>

          {submitStatus === 'error' && errorMessage && (
            <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger)/10' }}>
              <p className="text-sm text-[var(--color-danger)]">{errorMessage}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting || hasAlreadySubmitted}
            >
              Send Message
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

