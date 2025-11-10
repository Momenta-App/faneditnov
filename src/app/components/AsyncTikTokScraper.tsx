'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { motion } from 'framer-motion';

export function AsyncTikTokScraper() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/brightdata/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate scraping');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter TikTok, Instagram post/reel, or YouTube Shorts URL (regular YouTube videos not accepted)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#120F23]"
          disabled={loading}
          required
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!url || loading}
          className="w-full"
        >
          {loading ? 'Initiating...' : 'Scrape & Save'}
        </Button>
      </form>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600"
        >
          {error}
        </motion.div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600"
        >
          <p className="font-semibold mb-2">Success!</p>
          <p>Snapshot ID: {result.snapshot_id}</p>
          {result.video_id && <p>Video ID: {result.video_id}</p>}
          <p>Status: {result.status}</p>
        </motion.div>
      )}
    </div>
  );
}

