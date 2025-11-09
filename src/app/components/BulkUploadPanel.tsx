'use client';

import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Badge } from './Badge';
import { standardizeTikTokUrl } from '@/lib/url-utils';
import { supabaseClient } from '@/lib/supabase-client';

interface BulkUploadPanelProps {
  skipValidation: boolean;
}

interface URLStatus {
  url: string;
  status: 'ready' | 'submitting' | 'success' | 'failed';
  message?: string;
}

export function BulkUploadPanel({ skipValidation }: BulkUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<URLStatus[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'parsing' | 'ready' | 'submitting' | 'complete' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isValidTikTokUrl = (url: string): boolean => {
    // Full format or shortened formats
    return /tiktok\.com\/.+\/video\/\d+/.test(url) || 
           /vt\.tiktok\.com\/[A-Za-z0-9]+/.test(url) ||
           /vm\.tiktok\.com\/[A-Za-z0-9]+/.test(url);
  };

  const parseCSVFile = async (file: File) => {
    setSubmissionStatus('parsing');
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const parsedUrls: URLStatus[] = [];
      const seen = new Set<string>();

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines, comments
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
          continue;
        }
        
        // Handle CSV (take first column if comma-separated)
        const parts = trimmed.split(',');
        const url = parts[0].trim();
        
        // Only include if it looks like a URL
        if (url.startsWith('http')) {
          try {
            // Standardize if full URL, keep as-is if shortened
            const standardized = url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com')
              ? url
              : standardizeTikTokUrl(url);
            
            // Check if valid TikTok URL
            if (isValidTikTokUrl(standardized)) {
              // Check for duplicates
              if (!seen.has(standardized)) {
                seen.add(standardized);
                parsedUrls.push({
                  url: standardized,
                  status: 'ready',
                });
              }
            }
          } catch (err) {
            // Invalid URL, skip
            continue;
          }
        }
      }

      if (parsedUrls.length === 0) {
        setError('No valid TikTok URLs found in file');
        setSubmissionStatus('error');
        return;
      }

      setUrls(parsedUrls);
      setSubmissionStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setSubmissionStatus('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSVFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseCSVFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async () => {
    if (urls.length === 0) return;

    setSubmissionStatus('submitting');
    setError(null);

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setError('Not authenticated');
        setSubmissionStatus('error');
        return;
      }

      // Update all URLs to submitting status
      setUrls(prev => prev.map(u => ({ ...u, status: 'submitting' as const })));

      const response = await fetch('/api/brightdata/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          urls: urls.map(u => u.url),
          skip_validation: skipValidation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.details || 'Failed to submit URLs');
        setUrls(prev => prev.map(u => ({
          ...u,
          status: 'failed' as const,
          message: data.error
        })));
        setSubmissionStatus('error');
        return;
      }

      // Mark all as success
      setUrls(prev => prev.map(u => ({
        ...u,
        status: 'success' as const,
        message: 'Queued for scraping'
      })));
      
      setResult(data);
      setSubmissionStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUrls(prev => prev.map(u => ({
        ...u,
        status: 'failed' as const,
        message: 'Submission failed'
      })));
      setSubmissionStatus('error');
    }
  };

  const downloadFailedUrls = () => {
    const failed = urls.filter(u => u.status === 'failed');
    const csv = failed.map(u => `${u.url},${u.message || 'Failed'}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'failed-urls.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setUrls([]);
    setSubmissionStatus('idle');
    setError(null);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner for Bypass Mode */}
      {skipValidation && (
        <div 
          className="p-4 rounded-lg border-2" 
          style={{ 
            background: 'rgba(255, 165, 0, 0.1)',
            borderColor: 'var(--color-warning, #FFA500)',
            color: 'var(--color-text-primary)'
          }}>
          <div className="flex items-start gap-3">
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--color-warning, #FFA500)' }}>
                Quality Control Disabled
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Videos will be accepted without "edit" hashtag validation. Only use for admin-curated content.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Zone */}
      {submissionStatus === 'idle' && (
        <Card padding="lg">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)]'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              
              <div>
                <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Drop CSV file here or click to browse
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Supports .csv and .txt files (one URL per line)
                </p>
                {skipValidation && (
                  <p className="text-sm mt-2" style={{ color: 'var(--color-warning)' }}>
                    ⚡ Hashtag validation will be skipped
                  </p>
                )}
              </div>

              <label 
                htmlFor="file-upload"
                className="inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-all duration-200 focus-ring cursor-pointer text-white hover:opacity-90 active:opacity-80 shadow-md hover:shadow-lg border-2 px-10 py-5 text-sm min-h-[48px] min-w-[140px]"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                }}
              >
                Choose File
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Parsing Status */}
      {submissionStatus === 'parsing' && (
        <Card padding="lg">
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mb-4"></div>
            <p style={{ color: 'var(--color-text-primary)' }}>Parsing CSV file...</p>
          </div>
        </Card>
      )}

      {/* Preview & Submit */}
      {(submissionStatus === 'ready' || submissionStatus === 'submitting' || submissionStatus === 'complete') && (
        <>
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Preview ({urls.length} URLs)
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {file?.name}
                </p>
              </div>
              {submissionStatus === 'complete' && (
                <Button variant="secondary" onClick={reset} size="sm">
                  Upload Another File
                </Button>
              )}
            </div>

            {/* URL Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>#</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>URL</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.slice(0, 50).map((urlStatus, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="p-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {index + 1}
                      </td>
                      <td className="p-3 text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
                        {urlStatus.url.length > 60 ? `${urlStatus.url.substring(0, 60)}...` : urlStatus.url}
                      </td>
                      <td className="p-3">
                        {urlStatus.status === 'ready' && (
                          <Badge variant="default" size="sm">Ready</Badge>
                        )}
                        {urlStatus.status === 'submitting' && (
                          <Badge variant="default" size="sm">Submitting...</Badge>
                        )}
                        {urlStatus.status === 'success' && (
                          <Badge variant="success" size="sm">✓ Success</Badge>
                        )}
                        {urlStatus.status === 'failed' && (
                          <Badge variant="danger" size="sm">✗ Failed</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {urls.length > 50 && (
                    <tr>
                      <td colSpan={3} className="p-3 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        ... and {urls.length - 50} more URLs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Submit Button */}
            {submissionStatus === 'ready' && (
              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSubmit}
                  className="w-full"
                >
                  Submit {urls.length} URL{urls.length > 1 ? 's' : ''} for Processing
                </Button>
              </div>
            )}

            {/* Success Message */}
            {submissionStatus === 'complete' && result && (
              <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--color-success-bg, rgba(0, 255, 0, 0.1))', border: '1px solid var(--color-success, green)' }}>
                <h4 className="font-bold mb-2" style={{ color: 'var(--color-success, green)' }}>
                  ✓ Submission Successful!
                </h4>
                <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Snapshot ID: {result.snapshot_id || result.snapshotId}
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  BrightData will scrape {urls.length} video{urls.length > 1 ? 's' : ''} and send results to the webhook.
                  Videos will appear in your app once processing is complete.
                </p>
              </div>
            )}
          </Card>

          {/* Summary Stats */}
          {submissionStatus === 'complete' && (
            <Card padding="lg">
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--color-background-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {urls.length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Total URLs
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--color-background-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-success, green)' }}>
                    {urls.filter(u => u.status === 'success').length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Submitted
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--color-background-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-danger, red)' }}>
                    {urls.filter(u => u.status === 'failed').length}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Failed
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: 'var(--color-background-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    {skipValidation ? 'Bypassed' : 'Standard'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Validation
                  </div>
                </div>
              </div>

              {urls.some(u => u.status === 'failed') && (
                <div className="mt-4">
                  <Button variant="secondary" onClick={downloadFailedUrls} size="sm">
                    Download Failed URLs
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Error Display */}
      {error && submissionStatus === 'error' && (
        <Card padding="lg">
          <div className="p-4 rounded-lg" style={{ background: 'var(--color-danger-bg, rgba(255, 0, 0, 0.1))', border: '1px solid var(--color-danger, red)' }}>
            <h4 className="font-bold mb-2" style={{ color: 'var(--color-danger, red)' }}>
              ✗ Error
            </h4>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {error}
            </p>
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={reset}>
              Try Again
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

