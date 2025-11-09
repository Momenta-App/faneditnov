'use client';

import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { supabaseClient } from '@/lib/supabase-client';
import type { Creator } from '../types/data';

interface ContactCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: Creator;
  onSuccess?: () => void;
}

interface FormData {
  email: string;
  name: string;
  company: string;
  subject: string;
  message: string;
}

interface FormErrors {
  email?: string;
  name?: string;
  company?: string;
  subject?: string;
  message?: string;
}

export function ContactCreatorModal({ isOpen, onClose, creator, onSuccess }: ContactCreatorModalProps) {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    name: '',
    company: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

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

      const response = await fetch('/api/creator/contact', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          creatorId: creator.id,
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

      setSubmitStatus('success');
      // Reset form after successful submission
      setFormData({
        email: '',
        name: '',
        company: '',
        subject: '',
        message: '',
      });

      // Show success message for 2 seconds, then update button and close modal
      setTimeout(() => {
        // Call onSuccess callback to update button to "Contacted"
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Contact Creator">
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
            Your message has been sent. We'll get back to you soon.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your Email"
            type="email"
            placeholder="your.email@example.com"
            value={formData.email}
            onChange={handleChange('email')}
            error={errors.email}
            required
          />

          <Input
            label="Your Name"
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={handleChange('name')}
            error={errors.name}
            required
          />

          <Input
            label="Company (Optional)"
            type="text"
            placeholder="Your Company"
            value={formData.company}
            onChange={handleChange('company')}
            error={errors.company}
          />

          <Input
            label="Subject"
            type="text"
            placeholder="What is this regarding?"
            value={formData.subject}
            onChange={handleChange('subject')}
            error={errors.subject}
            required
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
              disabled={isSubmitting}
            >
              Send Message
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

