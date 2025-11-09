#!/usr/bin/env tsx

/**
 * Bulk TikTok URL Upload Script
 * 
 * Reads a CSV/TXT file containing TikTok URLs and submits them in bulk to the BrightData API.
 * Requires admin authentication.
 * 
 * Usage:
 *   npx tsx scripts/bulk-upload.ts <csv-file>
 *   
 * Examples:
 *   npx tsx scripts/bulk-upload.ts tiktok-urls.csv
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=pass123 npx tsx scripts/bulk-upload.ts urls.txt
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'readline';
import { resolve } from 'path';

// ============================================================================
// Load Environment Variables
// ============================================================================

// Load .env.local file if it exists
function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local');
  
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Only set if not already in environment
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
        }
      }
    }
  }
}

loadEnvFile();

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Standardize TikTok URL to consistent format
 * Extracted from @/lib/url-utils.ts
 * Note: Shortened URLs (vt.tiktok.com, vm.tiktok.com) are kept as-is
 * since BrightData can handle them directly
 */
function standardizeTikTokUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Keep shortened URLs as-is (BrightData handles them)
    if (urlObj.hostname === 'vt.tiktok.com' || urlObj.hostname === 'vm.tiktok.com') {
      return url;
    }
    
    // Extract username and video ID from path for full URLs
    const pathMatch = urlObj.pathname.match(/@([^/]+)\/video\/(\d+)/);
    
    if (pathMatch) {
      const [, username, videoId] = pathMatch;
      return `https://www.tiktok.com/@${username}/video/${videoId}`;
    }
    
    return url;
  } catch {
    return url;
  }
}

/**
 * Validate if URL is a TikTok video URL
 * Accepts both full URLs and shortened vt.tiktok.com URLs
 */
function isValidTikTokUrl(url: string): boolean {
  // Full format: https://www.tiktok.com/@user/video/123456
  if (/tiktok\.com\/.+\/video\/\d+/.test(url)) {
    return true;
  }
  
  // Shortened format: https://vt.tiktok.com/ZSyYYTJhJ/
  if (/vt\.tiktok\.com\/[A-Za-z0-9]+/.test(url)) {
    return true;
  }
  
  // Mobile format: https://vm.tiktok.com/ZSyYYTJhJ/
  if (/vm\.tiktok\.com\/[A-Za-z0-9]+/.test(url)) {
    return true;
  }
  
  return false;
}

/**
 * Prompt user for input (for interactive password entry)
 */
function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse CSV/TXT file and extract TikTok URLs
 */
function parseUrlsFromFile(filename: string): string[] {
  console.log(`📁 Reading file: ${filename}`);
  
  const content = readFileSync(filename, 'utf-8');
  const lines = content.split('\n');
  
  const urls: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }
    
    // Handle CSV format (take first column if comma-separated)
    const parts = trimmed.split(',');
    const url = parts[0].trim();
    
    // Only include if it looks like a URL
    if (url.startsWith('http')) {
      urls.push(url);
    }
  }
  
  return urls;
}

/**
 * Clean and validate URLs
 */
function cleanAndValidateUrls(urls: string[]): {
  valid: string[];
  invalid: string[];
  duplicates: number;
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  
  for (const url of urls) {
    try {
      // Standardize the URL
      const standardized = standardizeTikTokUrl(url);
      
      // Check if valid TikTok URL
      if (!isValidTikTokUrl(standardized)) {
        invalid.push(url);
        continue;
      }
      
      // Check for duplicates
      if (seen.has(standardized)) {
        duplicates++;
        continue;
      }
      
      seen.add(standardized);
      valid.push(standardized);
    } catch (err) {
      invalid.push(url);
    }
  }
  
  return { valid, invalid, duplicates };
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Authenticate with Supabase and get access token
 */
async function authenticate(): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.');
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Try to get credentials from environment
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  
  // If not in environment, prompt for them
  if (!email) {
    email = await prompt('Admin email: ');
  }
  
  if (!password) {
    password = await prompt('Admin password: ');
  }
  
  console.log('🔐 Authenticating...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  });
  
  if (error || !data.session) {
    throw new Error(`Authentication failed: ${error?.message || 'No session returned'}`);
  }
  
  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  
  if (profile?.role !== 'admin') {
    throw new Error('User is not an admin. Bulk upload requires admin privileges.');
  }
  
  console.log('✅ Authenticated as admin');
  
  return data.session.access_token;
}

// ============================================================================
// API Submission
// ============================================================================

/**
 * Submit URLs to BrightData trigger API
 */
async function submitUrls(urls: string[], accessToken: string): Promise<any> {
  console.log(`\n📤 Submitting ${urls.length} URLs to BrightData...`);
  
  const apiUrl = `${API_BASE_URL}/api/brightdata/trigger`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ urls }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${data.error || data.details || 'Unknown error'}`);
  }
  
  return data;
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('🚀 Bulk TikTok URL Upload Script\n');
  
  // Check command line arguments
  const filename = process.argv[2];
  
  if (!filename) {
    console.error('❌ Error: No file specified');
    console.error('\nUsage: npx tsx scripts/bulk-upload.ts <csv-file>');
    console.error('\nExample:');
    console.error('  npx tsx scripts/bulk-upload.ts tiktok-urls.csv');
    process.exit(1);
  }
  
  try {
    // Step 1: Parse URLs from file
    const rawUrls = parseUrlsFromFile(filename);
    console.log(`📊 Found ${rawUrls.length} URLs in file`);
    
    if (rawUrls.length === 0) {
      console.error('❌ No URLs found in file');
      process.exit(1);
    }
    
    // Step 2: Clean and validate
    const { valid, invalid, duplicates } = cleanAndValidateUrls(rawUrls);
    console.log(`🧹 Validated: ${valid.length} valid, ${invalid.length} invalid, ${duplicates} duplicates`);
    
    if (invalid.length > 0) {
      console.log(`\n⚠️  Invalid URLs (first 5):`);
      invalid.slice(0, 5).forEach(url => console.log(`   - ${url}`));
      if (invalid.length > 5) {
        console.log(`   ... and ${invalid.length - 5} more`);
      }
    }
    
    if (valid.length === 0) {
      console.error('\n❌ No valid TikTok URLs found');
      process.exit(1);
    }
    
    // Save invalid URLs if any
    if (invalid.length > 0) {
      writeFileSync('invalid-urls.txt', invalid.join('\n'));
      console.log(`   Saved invalid URLs to: invalid-urls.txt`);
    }
    
    // Step 3: Authenticate
    const accessToken = await authenticate();
    
    // Step 4: Submit to API
    console.log(`\n📊 Preparing to submit ${valid.length} URLs...`);
    const result = await submitUrls(valid, accessToken);
    
    // Step 5: Show results
    console.log(`✅ Success! Snapshot ID: ${result.snapshot_id || result.snapshotId || 'N/A'}`);
    console.log(`   Status: ${result.status || 'queued'}`);
    
    if (result.mock) {
      console.log(`\n⚠️  Note: Running in MOCK mode (no actual scraping)`);
    }
    
    // Summary
    console.log(`\n📈 Summary:`);
    console.log(`   Total URLs in file: ${rawUrls.length}`);
    console.log(`   Valid URLs: ${valid.length}`);
    console.log(`   Invalid URLs: ${invalid.length}`);
    console.log(`   Duplicates removed: ${duplicates}`);
    console.log(`   Submitted: ${valid.length}`);
    console.log(`   Status: Queued for scraping`);
    
    console.log(`\n🎉 Done! BrightData will scrape these videos and send results to the webhook.`);
    console.log(`   Videos will appear in your app once processing is complete.`);
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

