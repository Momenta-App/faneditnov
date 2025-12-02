#!/usr/bin/env tsx

/**
 * Extract contact information from creators_hot bio field
 * Creates separate CSV files for emails, Discord, websites, Instagram, and DM me mentions
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config(); // Also try .env

// Email regex patterns - comprehensive and supports ALL email types
// These patterns work for: gmail.com, yahoo.com, custom domains, .co, .io, .ae, .aep, etc.
// No domain-specific filtering - accepts any valid email domain
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
// Pattern for emails with prefixes like "email:", "contact:", etc.
// Supports all email domains - no restrictions
const EMAIL_WITH_PREFIX = /(?:email|contact|reach|dm|message|business|collab|collaboration|promo|promotion|work|hire|inquire|inquiry|inquires)[\s:]*[at\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi;
// Pattern for emails after emojis or special characters (expanded emoji set)
// Works for all email types - gmail, custom domains, etc.
const EMAIL_AFTER_EMOJI = /[💌📧✉️📮📩💬📞🔗📨📬📭📪📫📯📰📱📲💳💼💻💾💿📀📁📂📃📄📅📆📇📈📉📊📋📌📍📎📏📐📑📒📓📔📕📖📗📘📙📚📛📜📝📞📟📠📡📢📣📤📥📦📧📨📩📪📫📬📭📮📯📰📱📲📳📴📵📶📷📸📹📺📻📼📽📾📿🔀🔁🔂🔃🔄🔅🔆🔇🔈🔉🔊🔋🔌🔍🔎🔏🔐🔑🔒🔓🔔🔕🔖🔗🔘🔙🔚🔛🔜🔝🔞🔟🔠🔡🔢🔣🔤🔥💯💰💵💶💷💸💹💺💻💼💽💾💿📀📁📂📃📄📅📆📇📈📉📊📋📌📍📎📏📐📑📒📓📔📕📖📗📘📙📚📛📜📝📞📟📠📡📢📣📤📥📦📧📨📩📪📫📬📭📮📯📰📱📲📳📴📵📶📷📸📹📺📻📼📽📾📿🔀🔁🔂🔃🔄🔅🔆🔇🔈🔉🔊🔋🔌🔍🔎🔏🔐🔑🔒🔓🔔🔕🔖🔗🔘🔙🔚🔛🔜🔝🔞🔟🔠🔡🔢🔣🔤🔥💯💰💵💶💷💸💹💺💻💼💽💾💿📀📁📂📃📄📅📆📇📈📉📊📋📌📍📎📏📐📑📒📓📔📕📖📗📘📙📚📛📜📝📞📟📠📡📢📣📤📥📦📧📨📩📪📫📬📭📮📯📰📱📲📳📴📵📶📷📸📹📺📻📼📽📾📿]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi;
// More flexible email pattern without strict word boundaries
// Accepts ANY valid email domain - gmail, yahoo, custom domains, etc.
const EMAIL_FLEXIBLE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
// Pattern for obfuscated emails: name[at]domain[dot]com or name at domain dot com
const EMAIL_OBFUSCATED = /([A-Za-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@|at)\s*([A-Za-z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.|dot)\s*([A-Za-z]{2,})/gi;
// Pattern for emails in parentheses or brackets
const EMAIL_IN_BRACKETS = /[\(\[\{]([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})[\)\]\}]/g;
// Pattern for emails with Unicode characters that might be used to obfuscate
const EMAIL_UNICODE = /[A-Za-z0-9._%+\u200B-\u200D\uFEFF-]+@[A-Za-z0-9.\u200B-\u200D\uFEFF-]+\.[A-Z|a-z]{2,}/g;

// Discord patterns
const DISCORD_PATTERNS = [
  /discord\.gg\/[\w-]+/gi,
  /discord\.com\/invite\/[\w-]+/gi,
  /discord:\s*[\w\s#]+/gi,
  /@[\w\s]+#\d{4}/g, // Discord username#1234 format
  /discord\s+username[:\s]+[\w\s#]+/gi,
];

// Website URL patterns
const WEBSITE_PATTERNS = [
  /https?:\/\/[^\s]+/g,
  /www\.[^\s]+/g,
  /[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}[^\s]*/g, // Domain pattern
];

// Instagram patterns
const INSTAGRAM_PATTERNS = [
  /instagram\.com\/([\w.]+)/gi,
  /@([\w.]+)/g, // @username (but need to filter out Discord format)
  /ig:\s*([\w.]+)/gi,
  /insta:\s*([\w.]+)/gi,
];

// DM me patterns
const DM_ME_PATTERNS = [
  /dm\s+me/gi,
  /direct\s+message\s+me/gi,
  /contact\s+me/gi,
  /reach\s+out/gi,
  /hit\s+me\s+up/gi,
  /message\s+me/gi,
];

interface CreatorContact {
  creator_id: string;
  username: string;
  display_name: string | null;
  contact_value: string;
  bio: string | null;
}

function extractEmails(bio: string | null): string[] {
  if (!bio) return [];
  const results: string[] = [];
  
  // CRITICAL INSIGHT: Emails are copy-pasted intact by humans
  // They NEVER contain spaces or newlines within the email itself
  // We need to find exact boundaries - where the email starts and ends
  
  // Find all @ symbols - each represents a potential email
  const atSymbolIndices: number[] = [];
  for (let i = 0; i < bio.length; i++) {
    if (bio[i] === '@') {
      atSymbolIndices.push(i);
    }
  }
  
  for (const atIndex of atSymbolIndices) {
    // Find the start of the local part (before @)
    // Look backwards until we hit a boundary
    let localStart = atIndex;
    for (let i = atIndex - 1; i >= 0; i--) {
      const char = bio[i];
      if (/[A-Za-z0-9._%+-]/.test(char)) {
        // Valid email character - continue expanding backwards
        localStart = i;
      } else {
        // Hit a boundary character - email starts after this
        // Boundary characters: space, newline, or any punctuation except email-valid chars
        localStart = i + 1;
        break;
      }
    }
    
    // Find the end of the domain (after @)
    // Look forwards until we hit a boundary
    let domainEnd = atIndex + 1;
    let foundDot = false;
    let lastDotIndex = -1;
    
    for (let i = atIndex + 1; i < bio.length; i++) {
      const char = bio[i];
      if (/[A-Za-z0-9.-]/.test(char)) {
        // Valid domain character - continue expanding forwards
        domainEnd = i + 1;
        if (char === '.') {
          foundDot = true;
          lastDotIndex = i;
        }
      } else {
        // Hit a boundary character - email ends here
        // Boundary characters: space, newline, or any punctuation except email-valid chars
        // Emails NEVER have spaces/newlines, so stop immediately
        break;
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
          const emailLower = email.toLowerCase();
          
          // Reject obvious non-emails
          if (emailLower.includes('example.com') || 
              emailLower.includes('test@') ||
              emailLower.match(/^\d+@/) ||
              emailLower.includes('whatsapp') ||
              emailLower.includes('instagram.com') ||
              emailLower.includes('tiktok.com') ||
              emailLower.includes('youtube.com') ||
              emailLower.includes('twitter.com') ||
              emailLower.includes('facebook.com')) {
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
          
          // Reject if local part starts or ends with invalid characters
          if (localPart.startsWith('.') || localPart.endsWith('.') ||
              localPart.startsWith('-') || localPart.endsWith('-') ||
              localPart.startsWith('+') || localPart.endsWith('+')) {
            continue;
          }
          
          // Reject if domain has invalid patterns
          if (domainPart.startsWith('.') || domainPart.endsWith('.') ||
              domainPart.startsWith('-') || domainPart.endsWith('-') ||
              domainPart.includes('..')) {
            continue;
          }
          
          // Reject if TLD is too short or invalid (must be at least 2 chars and valid)
          const domainParts = domainPart.split('.');
          const tld = domainParts[domainParts.length - 1];
          if (!tld || tld.length < 2 || !/^[A-Za-z]{2,}$/.test(tld)) {
            continue;
          }
          
          // Reject if domain part before TLD is empty or invalid
          if (domainParts.length < 2 || !domainParts[domainParts.length - 2]) {
            continue;
          }
          
          // Reject common invalid TLDs that are likely not real emails
          const invalidTlds = ['aep', 'rizing', 'vfx', 'ae', 'edits', 'edit', 'film', 'films', 'media'];
          if (invalidTlds.includes(tld.toLowerCase())) {
            continue;
          }
          
          // Reject if local part is just common words (likely false positive)
          const commonWords = ['account', 'alt', 'backup', 'main', 'second', '2nd', 'contact', 'business'];
          if (commonWords.includes(localPart.toLowerCase()) && email.length < 25) {
            continue;
          }
          
          // Additional validation: domain should look like a real domain
          // Reject if domain is too short or looks like a username/account reference
          const domainWithoutTld = domainParts.slice(0, -1).join('.');
          if (domainWithoutTld.length < 2) {
            continue;
          }
          
          results.push(email);
        }
      }
    }
  }
  
  // Remove duplicates and normalize to lowercase
  let unique = [...new Set(results.map(e => e.trim().toLowerCase()))];
  
  return unique;
}

function extractDiscord(bio: string | null): string[] {
  if (!bio) return [];
  const results: string[] = [];
  
  for (const pattern of DISCORD_PATTERNS) {
    const matches = bio.match(pattern);
    if (matches) {
      results.push(...matches.map(m => m.trim()));
    }
  }
  
  // Filter out false positives (like email addresses)
  return [...new Set(results)].filter(item => !item.includes('@') || item.includes('#'));
}

function extractWebsites(bio: string | null): string[] {
  if (!bio) return [];
  const results: string[] = [];
  
  for (const pattern of WEBSITE_PATTERNS) {
    const matches = bio.match(pattern);
    if (matches) {
      results.push(...matches.map(m => m.trim()));
    }
  }
  
  // Filter out social media URLs (we handle those separately)
  const filtered = results.filter(url => {
    const lower = url.toLowerCase();
    return !lower.includes('instagram.com') && 
           !lower.includes('discord.gg') && 
           !lower.includes('discord.com') &&
           !lower.includes('tiktok.com') &&
           !lower.includes('youtube.com') &&
           !lower.includes('twitter.com') &&
           !lower.includes('x.com');
  });
  
  // Clean up URLs (add https:// if missing)
  return [...new Set(filtered)].map(url => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  });
}

function extractInstagram(bio: string | null): string[] {
  if (!bio) return [];
  const results: string[] = [];
  
  for (const pattern of INSTAGRAM_PATTERNS) {
    const matches = bio.match(pattern);
    if (matches) {
      // Extract username from matches
      for (const match of matches) {
        if (match.includes('instagram.com/')) {
          const username = match.match(/instagram\.com\/([\w.]+)/i)?.[1];
          if (username) results.push(username);
        } else if (match.startsWith('@')) {
          // Check if it's not a Discord format (has #)
          if (!match.includes('#')) {
            results.push(match.substring(1)); // Remove @
          }
        } else {
          // For ig: or insta: patterns
          const username = match.match(/:\s*([\w.]+)/i)?.[1];
          if (username) results.push(username);
        }
      }
    }
  }
  
  return [...new Set(results)];
}

function hasDMMe(bio: string | null): boolean {
  if (!bio) return false;
  const lowerBio = bio.toLowerCase();
  return DM_ME_PATTERNS.some(pattern => pattern.test(lowerBio));
}

function writeCSV(filename: string, data: CreatorContact[]) {
  const csvPath = path.join(process.cwd(), filename);
  
  if (data.length === 0) {
    console.log(`⚠️  No data for ${filename}, creating empty file`);
    fs.writeFileSync(csvPath, 'creator_id,username,display_name,contact_value,bio\n');
    return;
  }
  
  // CSV header
  const header = 'creator_id,username,display_name,contact_value,bio\n';
  
  // CSV rows
  const rows = data.map(item => {
    const escapeCSV = (str: string | null) => {
      if (!str) return '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = str.replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`;
      }
      return escaped;
    };
    
    return [
      escapeCSV(item.creator_id),
      escapeCSV(item.username),
      escapeCSV(item.display_name),
      escapeCSV(item.contact_value),
      escapeCSV(item.bio)
    ].join(',');
  });
  
  fs.writeFileSync(csvPath, header + rows.join('\n'));
  console.log(`✅ Created ${filename} with ${data.length} entries`);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔌 Connecting to database...');
  
  // Fetch all creators with bios
  let allCreators: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('creators_hot')
      .select('creator_id, username, display_name, bio')
      .not('bio', 'is', null)
      .neq('bio', '')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching creators:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allCreators = allCreators.concat(data);
      console.log(`📊 Fetched ${allCreators.length} creators...`);
      
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  console.log(`\n📋 Processing ${allCreators.length} creators...\n`);

  // Extract contact information
  const emails: CreatorContact[] = [];
  const discord: CreatorContact[] = [];
  const websites: CreatorContact[] = [];
  const instagram: CreatorContact[] = [];
  const dmMe: CreatorContact[] = [];
  
  // Debug: Track bios that might have emails but weren't caught
  const potentialMissedEmails: Array<{creator_id: string, username: string, bio: string}> = [];

  for (const creator of allCreators) {
    const bio = creator.bio;
    
    // Extract emails
    const emailMatches = extractEmails(bio);
    
    // Debug: Check for potential missed emails
    if (emailMatches.length === 0) {
      // Look for common email indicators without actual email
      const lowerBio = bio.toLowerCase();
      if (lowerBio.includes('email') || lowerBio.includes('contact') || 
          lowerBio.includes('@') || lowerBio.includes('💌') || 
          lowerBio.includes('📧') || lowerBio.includes('✉️')) {
        // Check if there's an @ symbol but no valid email found
        const hasAtSymbol = bio.includes('@');
        const hasValidEmail = EMAIL_FLEXIBLE.test(bio);
        if (hasAtSymbol && !hasValidEmail) {
          potentialMissedEmails.push({
            creator_id: creator.creator_id,
            username: creator.username,
            bio: bio.substring(0, 200) // First 200 chars for debugging
          });
        }
      }
    }
    
    for (const email of emailMatches) {
      emails.push({
        creator_id: creator.creator_id,
        username: creator.username,
        display_name: creator.display_name,
        contact_value: email,
        bio: bio
      });
    }

    // Extract Discord
    const discordMatches = extractDiscord(bio);
    for (const discordValue of discordMatches) {
      discord.push({
        creator_id: creator.creator_id,
        username: creator.username,
        display_name: creator.display_name,
        contact_value: discordValue,
        bio: bio
      });
    }

    // Extract websites
    const websiteMatches = extractWebsites(bio);
    for (const website of websiteMatches) {
      websites.push({
        creator_id: creator.creator_id,
        username: creator.username,
        display_name: creator.display_name,
        contact_value: website,
        bio: bio
      });
    }

    // Extract Instagram
    const instagramMatches = extractInstagram(bio);
    for (const insta of instagramMatches) {
      instagram.push({
        creator_id: creator.creator_id,
        username: creator.username,
        display_name: creator.display_name,
        contact_value: insta,
        bio: bio
      });
    }

    // Check for DM me
    if (hasDMMe(bio)) {
      dmMe.push({
        creator_id: creator.creator_id,
        username: creator.username,
        display_name: creator.display_name,
        contact_value: 'DM me',
        bio: bio
      });
    }
  }

  // Write CSV files
  console.log('\n📝 Writing CSV files...\n');
  writeCSV('creator_emails.csv', emails);
  writeCSV('creator_discord.csv', discord);
  writeCSV('creator_websites.csv', websites);
  writeCSV('creator_instagram.csv', instagram);
  writeCSV('creator_dm_me.csv', dmMe);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Emails: ${emails.length}`);
  console.log(`   Discord: ${discord.length}`);
  console.log(`   Websites: ${websites.length}`);
  console.log(`   Instagram: ${instagram.length}`);
  console.log(`   DM Me: ${dmMe.length}`);
  
  // Debug output
  if (potentialMissedEmails.length > 0) {
    console.log(`\n⚠️  Found ${potentialMissedEmails.length} bios that might have emails but weren't extracted:`);
    console.log('   Sample bios (first 5):');
    potentialMissedEmails.slice(0, 5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. @${item.username}: "${item.bio}"`);
    });
    console.log(`   (See potential_missed_emails.txt for full list)`);
    
    // Write potential missed emails to a file for review
    const debugPath = path.join(process.cwd(), 'potential_missed_emails.txt');
    const debugContent = potentialMissedEmails.map(item => 
      `Creator: @${item.username} (${item.creator_id})\nBio: ${item.bio}\n---\n`
    ).join('\n');
    fs.writeFileSync(debugPath, debugContent);
  }
  
  console.log('\n✅ Extraction complete!');
}

main().catch(console.error);

