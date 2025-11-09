'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoadingDemos() {
  const router = useRouter();
  const [selectedDemo, setSelectedDemo] = useState<number | null>(null);

  // Demo 1: Simple Line Loading Bar
  const LineLoader = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }, []);

    return (
      <div style={{
        width: '100%',
        maxWidth: '400px',
        margin: '2rem auto'
      }}>
        <div style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00ffff, #00ffff)',
            borderRadius: '2px',
            transition: 'width 0.1s linear',
            boxShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
          }}></div>
        </div>
      </div>
    );
  };

  // Demo 2: Animated Text
  const AnimatedTextLoader = () => {
    const [dots, setDots] = useState('');

    useEffect(() => {
      const interval = setInterval(() => {
        setDots((prev) => {
          if (prev === '...') return '';
          return prev + '.';
        });
      }, 500);
      return () => clearInterval(interval);
    }, []);

    return (
      <div style={{
        textAlign: 'center',
        margin: '2rem auto',
        fontSize: '1.5rem',
        fontWeight: '500',
        color: '#ffffff'
      }}>
        <style jsx>{`
          .animated-text {
            display: inline-block;
            animation: fade-pulse 2s ease-in-out infinite;
          }

          @keyframes fade-pulse {
            0%, 100% {
              opacity: 0.6;
            }
            50% {
              opacity: 1;
            }
          }
        `}</style>
        <span className="animated-text">Loading{dots}</span>
      </div>
    );
  };

  // Demo 3: Glimmering Bold Text (iPhone Pro style)
  const GlimmerTextLoader = () => {
    return (
      <div style={{
        textAlign: 'center',
        margin: '2rem auto',
        padding: '3rem 0'
      }}>
        <style jsx>{`
          .glimmer-text {
            font-size: 3rem;
            font-weight: 900;
            background: linear-gradient(
              110deg,
              #f0f0f0 0%,
              #ffffff 25%,
              #f0f0f0 50%,
              #ffffff 75%,
              #f0f0f0 100%
            );
            background-size: 200% 100%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shimmer 3s ease-in-out infinite;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }

          .glimmer-container {
            position: relative;
            display: inline-block;
          }

          .glimmer-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.4),
              transparent
            );
            animation: sweep 2s ease-in-out infinite;
          }

          @keyframes sweep {
            0% {
              left: -100%;
            }
            100% {
              left: 100%;
            }
          }
        `}</style>
        <div className="glimmer-container">
          <div className="glimmer-text">Fan Edit</div>
        </div>
      </div>
    );
  };

  // Demo 4: Animated Typography (letters fade in)
  const TypographyLoader = () => {
    const text = 'FAN EDIT';
    return (
      <div style={{
        textAlign: 'center',
        margin: '2rem auto',
        fontSize: '2.5rem',
        fontWeight: '700',
        letterSpacing: '0.2em',
        color: '#ffffff'
      }}>
        <style jsx>{`
          .typo-letter {
            display: inline-block;
            opacity: 0;
            animation: fade-in-typo 0.8s ease-out forwards;
          }

          @keyframes fade-in-typo {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
        {text.split('').map((letter, index) => (
          <span
            key={index}
            className="typo-letter"
            style={{
              animationDelay: `${index * 0.1}s`,
              color: letter === ' ' ? 'transparent' : '#00ffff'
            }}
          >
            {letter}
          </span>
        ))}
      </div>
    );
  };

  // Demo 5: Minimalist dots
  const MinimalDotsLoader = () => {
    return (
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'center',
        margin: '2rem auto'
      }}>
        <style jsx>{`
          .minimal-dot {
            width: 10px;
            height: 10px;
            background: #00ffff;
            border-radius: 50%;
            opacity: 0.3;
            animation: minimal-bounce 1.4s ease-in-out infinite;
          }

          .minimal-dot:nth-child(1) {
            animation-delay: 0s;
          }

          .minimal-dot:nth-child(2) {
            animation-delay: 0.2s;
          }

          .minimal-dot:nth-child(3) {
            animation-delay: 0.4s;
          }

          @keyframes minimal-bounce {
            0%, 80%, 100% {
              transform: scale(0.8);
              opacity: 0.3;
            }
            40% {
              transform: scale(1.2);
              opacity: 1;
            }
          }
        `}</style>
        <div className="minimal-dot"></div>
        <div className="minimal-dot"></div>
        <div className="minimal-dot"></div>
      </div>
    );
  };

  const demos = [
    {
      id: 1,
      name: 'Simple Line Loading Bar',
      component: <LineLoader />,
      description: 'Clean progress bar animation'
    },
    {
      id: 2,
      name: 'Animated Text with Dots',
      component: <AnimatedTextLoader />,
      description: 'Text that pulses with animated dots'
    },
    {
      id: 3,
      name: 'Glimmering Bold Text (iPhone Pro Style)',
      component: <GlimmerTextLoader />,
      description: 'Silver shimmer effect on bold text'
    },
    {
      id: 4,
      name: 'Typography Animation',
      component: <TypographyLoader />,
      description: 'Letters fade in sequentially'
    },
    {
      id: 5,
      name: 'Minimal Dots',
      component: <MinimalDotsLoader />,
      description: 'Simple bouncing dots'
    }
  ];

  return (
    <div style={{
      background: '#000000',
      minHeight: '100vh',
      color: '#ffffff',
      padding: '2rem'
    }}>
      <style jsx>{`
        .header {
          text-align: center;
          margin-bottom: 4rem;
          padding-top: 2rem;
        }

        .header h1 {
          font-size: 2.5rem;
          font-weight: 900;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #fff, #00ffff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header p {
          color: rgba(255, 255, 255, 0.6);
          font-size: 1.125rem;
        }

        .back-button {
          position: fixed;
          top: 2rem;
          left: 2rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(0, 255, 255, 0.5);
        }

        .demos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 3rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .demo-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2.5rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          min-height: 300px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .demo-card:hover {
          border-color: rgba(0, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-5px);
        }

        .demo-name {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #ffffff;
          text-align: center;
        }

        .demo-description {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 2rem;
          text-align: center;
        }

        .demo-content {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .demos-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .demo-card {
            padding: 2rem;
          }

          .back-button {
            position: relative;
            top: auto;
            left: auto;
            margin-bottom: 2rem;
          }
        }
      `}</style>

      <button className="back-button" onClick={() => router.push('/')}>
        ← Back to Home
      </button>

      <div className="header">
        <h1>Loading Animation Options</h1>
        <p>Choose your preferred loading animation style</p>
      </div>

      <div className="demos-grid">
        {demos.map((demo) => (
          <div key={demo.id} className="demo-card">
            <div className="demo-name">{demo.name}</div>
            <div className="demo-description">{demo.description}</div>
            <div className="demo-content">
              {demo.component}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

