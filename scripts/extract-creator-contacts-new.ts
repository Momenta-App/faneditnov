#!/usr/bin/env tsx

/**
 * Extract contact information from creators_hot bio field
 * NEW VERSION: Focus on exact boundary detection
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config();

/**
 * Extract emails with precise boundary detection
 * Key insight: Emails are copy-pasted intact, never contain spaces/newlines within them
 */
function extractEmails(bio: string | null): string[] {
  if (!bio) return [];
  const results: string[] = [];
  
  // Find all @ symbols - each represents a potential email
  const atSymbolIndices: number[] = [];
  for (let i = 0; i < bio.length; i++) {
    if (bio[i] === '@') {
      atSymbolIndices.push(i);
    }
  }
  
  for (const atIndex of atSymbolIndices) {
    // Find the start of the local part (before @)
    let localStart = atIndex;
    for (let i = atIndex - 1; i >= 0; i--) {
      const char = bio[i];
      if (/[A-Za-z0-9._%+-]/.test(char)) {
        localStart = i;
      } else if (/[\s\n]/.test(char)) {
        // Space or newline - email local part starts after this
        localStart = i + 1;
        break;
      } else {
        // Other character - check if it's a boundary character
        if (/[:,\-]/.test(char)) {
          // Colon, comma, dash might be boundary or part of email
          // If next char is space/newline, it's a boundary
          if (i + 1 < bio.length && /[\s\n]/.test(bio[i + 1])) {
            localStart = i + 1;
            break;
          }
        } else {
          // Other punctuation - likely boundary
          localStart = i + 1;
          break;
        }
      }
    }
    
    // Find the end of the domain (after @)
    let domainEnd = atIndex + 1;
    let foundDot = false;
    let tldStart = -1;
    
    for (let i = atIndex + 1; i < bio.length; i++) {
      const char = bio[i];
      if (/[A-Za-z0-9.-]/.test(char)) {
        domainEnd = i + 1;
        if (char === '.') {
          foundDot = true;
          // Check if this might be the TLD separator
          if (i + 1 < bio.length && /[A-Za-z]/.test(bio[i + 1])) {
            tldStart = i + 1;
          }
        }
      } else if (/[\s\n]/.test(char)) {
        // Space or newline - email ends here
        break;
      } else if (/[,;()]/.test(char)) {
        // Comma, semicolon, parentheses - email ends here
        break;
      } else {
        // Other character - might be part of email if it's valid punctuation
        // But if it's clearly not email-related, stop
        if (!/[._%+-]/.test(char)) {
          break;
        }
        domainEnd = i + 1;
      }
    }
    
    // Validate we have a complete email
    if (foundDot && domainEnd > atIndex + 1 && localStart < atIndex) {
      const localPart = bio.substring(localStart, atIndex);
      const domainPart = bio.substring(atIndex + 1, domainEnd);
      
      // Basic validation
      if (localPart.length > 0 && domainPart.length > 0 && domainPart.includes('.')) {
        const domainParts = domainPart.split('.');
        const tld = domainParts[domainParts.length - 1];
        
        // TLD should be at least 2 characters
        if (tld && tld.length >= 2) {
          const email = bio.substring(localStart, domainEnd);
          
          // Additional validation: reject obvious non-emails
          const emailLower = email.toLowerCase();
          
          // Reject if it's clearly not an email
          if (emailLower.includes('example.com') || 
              emailLower.includes('test@') ||
              emailLower.match(/^\d+@/) ||
              emailLower.includes('whatsapp') ||
              emailLower.includes('instagram.com') ||
              emailLower.includes('tiktok.com') ||
              emailLower.includes('youtube.com')) {
            continue;
          }
          
          // Reject if domain starts with www. (URL, not email)
          if (domainPart.toLowerCase().startsWith('www.')) {
            continue;
          }
          
          // Reject very short local parts (likely false positives)
          if (localPart.length < 2) {
            continue;
          }
          
          // Reject if local part is just common words (likely false positive)
          const commonWords = ['account', 'alt', 'backup', 'main', 'second', '2nd'];
          if (commonWords.includes(localPart.toLowerCase()) && email.length < 20) {
            continue;
          }
          
          results.push(email);
        }
      }
    }
  }
  
  // Remove duplicates and normalize
  const unique = [...new Set(results.map(e => e.trim().toLowerCase()))];
  
  // Filter out partial emails - if a longer email exists with same domain, prefer longer
  const filtered: string[] = [];
  const byDomain = new Map<string, string[]>();
  
  for (const email of unique) {
    const parts = email.split('@');
    if (parts.length === 2) {
      const domain = parts[1];
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push(email);
    }
  }
  
  for (const [domain, emails] of byDomain.entries()) {
    // Sort by length (longest first)
    emails.sort((a, b) => b.length - a.length);
    
    const commonSuffixes = ['business', 'contact', 'collab', 'collaboration', 'work', 'ads', 'promo'];
    
    for (const email of emails) {
      const local = email.split('@')[0];
      let isPartial = false;
      
      // Check if this is a prefix of a longer email
      for (const otherEmail of emails) {
        if (otherEmail !== email && otherEmail.length > email.length) {
          const otherLocal = otherEmail.split('@')[0];
          // Check if other email starts with this email's local part + common suffix
          if (otherLocal.startsWith(local) && 
              commonSuffixes.some(suffix => otherLocal === local + suffix)) {
            isPartial = true;
            break;
          }
        }
      }
      
      if (!isPartial) {
        filtered.push(email);
      }
    }
  }
  
  return filtered;
}

// Rest of the file would continue with extractDiscord, extractWebsites, etc.
// For now, let me just test the email extraction

// Test with some examples
const testBios = [
  "contact: cjladbusiness@gmail.com",
  "cjlad@gmail.com\ncjladbusiness@gmail.com",
  "princeprovolone@gmail.comthankyoufor",
  "social@launch13.commipayhip",
  "Promo/Ads\nArtkevinfx@gmail.com",
  "adsartkevinfx@gmail.com",
];

console.log("Testing email extraction:");
for (const bio of testBios) {
  const emails = extractEmails(bio);
  console.log(`Bio: "${bio}"`);
  console.log(`Emails: ${emails.join(', ')}\n`);
}

