'use client';

import React, { useState } from 'react';
import { useCampaignGenerator } from './hooks/useCampaignGenerator';

export default function Home() {
  const [searchInput, setSearchInput] = useState('');
  const { isGenerating, loadingMessage, error, setError, generateCampaign } = useCampaignGenerator();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchInput.trim() || isGenerating) {
      return;
    }
    generateCampaign(searchInput.trim());
  };

  return (
    <div className="presentation-home">
      <style jsx>{`
        .presentation-home {
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at top, #0b1220, #010104 65%);
          color: #f5f5f5;
          position: relative;
          overflow: hidden;
        }

        .aurora {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .aurora span {
          position: absolute;
          width: 40vw;
          height: 40vw;
          background: radial-gradient(circle, rgba(0, 255, 204, 0.25), transparent 60%);
          filter: blur(50px);
          animation: float 18s ease-in-out infinite;
        }

        .aurora span:nth-child(1) {
          top: -10%;
          left: -10%;
        }

        .aurora span:nth-child(2) {
          top: 10%;
          right: -15%;
          animation-delay: 3s;
          background: radial-gradient(circle, rgba(0, 122, 255, 0.3), transparent 60%);
        }

        .aurora span:nth-child(3) {
          bottom: -15%;
          left: 15%;
          animation-delay: 6s;
          background: radial-gradient(circle, rgba(255, 102, 204, 0.2), transparent 60%);
        }

        @keyframes float {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(5%, -5%, 0) scale(1.1);
          }
        }

        .grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 80px 80px;
          opacity: 0.6;
          mix-blend-mode: screen;
        }

        .hero {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8rem 1.5rem 5rem;
          min-height: 100vh;
        }

        .hero-card {
          max-width: 820px;
          width: 100%;
          text-align: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.85);
          padding: 0.9rem 1.5rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          margin-bottom: 2rem;
        }

        .badge-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #00ffe0, #0070f3);
          box-shadow: 0 0 12px rgba(0, 255, 224, 0.8);
        }

        h1 {
          font-size: clamp(3rem, 8vw, 5.8rem);
          font-weight: 800;
          margin-bottom: 1.25rem;
          line-height: 1.05;
          color: transparent;
          background: linear-gradient(120deg, #ffffff 0%, #9fbaff 45%, #00ffe0 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        p.hero-copy {
          font-size: clamp(1.1rem, 2vw, 1.45rem);
          color: rgba(255, 255, 255, 0.75);
          margin-bottom: 3rem;
          line-height: 1.6;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          align-items: stretch;
        }

        .input-wrap {
          width: 100%;
          background: rgba(3, 7, 18, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 999px;
          padding: 0.5rem;
          display: flex;
          gap: 0.25rem;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(20px);
        }

        input {
          flex: 1;
          border: none;
          background: transparent;
          color: #fff;
          font-size: 1rem;
          padding: 1.25rem 1.5rem;
          outline: none;
        }

        input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        button {
          border: none;
          border-radius: 999px;
          padding: 1.1rem 2.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(120deg, #00ffe0, #0070f3);
          color: #020611;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        button:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 40px rgba(0, 112, 243, 0.45);
        }

        .supporting-copy {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          margin-top: 2rem;
          flex-wrap: wrap;
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.95rem;
        }

        .supporting-copy span {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }

        .supporting-copy span::before {
          content: '';
          width: 0.35rem;
          height: 0.35rem;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.35);
        }

        .loading-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(1, 1, 5, 0.85);
          backdrop-filter: blur(8px);
          z-index: 50;
          color: #fff;
          text-align: center;
        }

        .loading-card {
          padding: 2rem 2.5rem;
          border-radius: 24px;
          background: rgba(3, 7, 18, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
          width: min(420px, calc(100% - 2rem));
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          border: 3px solid rgba(255, 255, 255, 0.15);
          border-top-color: #00ffe0;
          margin: 0 auto 1.25rem;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-banner {
          margin-top: 1.5rem;
          padding: 1rem 1.5rem;
          border-radius: 16px;
          border: 1px solid rgba(255, 94, 94, 0.4);
          background: rgba(255, 94, 94, 0.08);
          color: #ffc7c7;
        }

        @media (max-width: 640px) {
          .hero {
            padding-top: 5rem;
          }

          .input-wrap {
            flex-direction: column;
            border-radius: 32px;
            padding: 0.75rem;
          }

          input {
            padding: 1rem;
          }

          button {
            width: 100%;
          }

          .supporting-copy {
            flex-direction: column;
            gap: 0.75rem;
            align-items: flex-start;
          }

          .supporting-copy span::before {
            display: none;
          }
        }
      `}</style>

      <div className="aurora">
        <span />
        <span />
        <span />
      </div>
      <div className="grid" />

      <section className="hero">
        <div className="hero-card">
          <div className="badge">
            <span className="badge-dot" />
            Instant campaign intelligence
          </div>
          <h1>Create campaigns like magic.</h1>
          <p className="hero-copy">
            Type any fandom, region, or franchise. We conjure the perfect SportClips campaign, find the
            right creators, and guide you straight to the live playbook.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="input-wrap">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => {
                  if (error) {
                    setError(null);
                  }
                  setSearchInput(event.target.value);
                }}
                placeholder="e.g. Canada hockey fans, Marvel superfans, NBA x Mexico City"
                disabled={isGenerating}
                aria-label="Describe your campaign"
                required
              />
              <button type="submit" disabled={!searchInput.trim() || isGenerating}>
                {isGenerating ? 'Summoning...' : 'Generate'}
              </button>
            </div>
            {error && <div className="error-banner">{error}</div>}
          </form>

          <div className="supporting-copy">
            <span>AI-crafted strategy</span>
            <span>Instant demographic insights</span>
            <span>Direct link to campaign room</span>
          </div>
        </div>
      </section>

      {isGenerating && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-card">
            <div className="loading-spinner" />
            <p>{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}


