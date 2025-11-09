'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

/**
 * LoginRequiredModal - Shows when user needs to log in to perform an action
 * Matches the design from the upload page
 */
export function LoginRequiredModal({ 
  isOpen, 
  onClose,
  message = 'You must login to contact creators'
}: LoginRequiredModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ 
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="max-w-[500px] w-full mx-4 p-10 rounded-3xl text-center animate-fadeIn"
        style={{ 
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
          color: 'white',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" 
          style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold mb-3">Login Required</h2>
        <p className="mb-8 text-lg opacity-90">
          {message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              onClose();
              router.push('/auth/signup');
            }}
            className="px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105"
            style={{ 
              background: 'white',
              color: 'var(--color-primary)',
            }}
          >
            Create Account
          </button>
          <button
            onClick={() => {
              onClose();
              router.push('/auth/login');
            }}
            className="px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105"
            style={{ 
              background: 'rgba(255, 255, 255, 0.15)',
              border: '2px solid white',
            }}
          >
            Log In
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

