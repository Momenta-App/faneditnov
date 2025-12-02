#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

interface EmailEntry {
  creator_id: string;
  username: string;
  email: string;
  bio: string;
}

function parseScriptCSV(filePath: string): EmailEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: EmailEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV with proper quote handling
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);
    
    if (fields.length >= 5) {
      entries.push({
        creator_id: fields[0],
        username: fields[1],
        email: fields[3].toLowerCase().trim(),
        bio: fields.slice(4).join(',')
      });
    }
  }
  
  return entries;
}

function parseReviewedCSV(filePath: string): EmailEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: EmailEntry[] = [];
  
  let currentEntry: Partial<EmailEntry> | null = null;
  let bioLines: string[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a new entry (has creator_id in first field)
    const firstComma = line.indexOf(',');
    if (firstComma > 0) {
      const firstField = line.substring(0, firstComma).trim();
      
      // Check if first field looks like a creator ID (number or scientific notation)
      if (firstField && (firstField.match(/^\d+$/) || firstField.match(/^\d+\.\d+E\+\d+$/))) {
        // Save previous entry if exists
        if (currentEntry && currentEntry.creator_id) {
          entries.push({
            creator_id: normalizeCreatorId(currentEntry.creator_id),
            username: currentEntry.username || '',
            email: (currentEntry.email || '').toLowerCase().trim(),
            bio: bioLines.join('\n')
          });
        }
        
        // Parse new entry
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current);
        
        if (fields.length >= 4) {
          currentEntry = {
            creator_id: fields[0].trim(),
            username: fields[1].trim(),
            email: fields[3].trim()
          };
          bioLines = fields.length > 4 ? [fields[4].trim()] : [];
        } else {
          currentEntry = null;
          bioLines = [];
        }
      } else if (currentEntry) {
        // Continuation of bio (empty fields at start)
        const bioPart = line.replace(/^,+/, '').trim();
        if (bioPart) {
          bioLines.push(bioPart);
        }
      }
    }
  }
  
  // Save last entry
  if (currentEntry && currentEntry.creator_id) {
    entries.push({
      creator_id: normalizeCreatorId(currentEntry.creator_id),
      username: currentEntry.username || '',
      email: (currentEntry.email || '').toLowerCase().trim(),
      bio: bioLines.join('\n')
    });
  }
  
  return entries;
}

function normalizeCreatorId(id: string): string {
  // Convert scientific notation to regular number
  if (id.includes('E+')) {
    const num = parseFloat(id);
    return Math.round(num).toString();
  }
  return id;
}

function extractEmailsFromBio(bio: string): string[] {
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
  const matches = bio.match(emailRegex) || [];
  return [...new Set(matches.map(e => e.toLowerCase().trim()))];
}

function main() {
  const scriptEntries = parseScriptCSV(path.join(process.cwd(), 'creator_emails.csv'));
  const reviewedEntries = parseReviewedCSV(path.join(process.cwd(), 'creator_email_reviewed.csv'));
  
  console.log(`Script extracted: ${scriptEntries.length} emails`);
  console.log(`Reviewed CSV has: ${reviewedEntries.length} entries\n`);
  
  // Group by creator_id
  const scriptByCreator = new Map<string, EmailEntry[]>();
  const reviewedByCreator = new Map<string, EmailEntry[]>();
  
  for (const entry of scriptEntries) {
    const normalizedId = normalizeCreatorId(entry.creator_id);
    if (!scriptByCreator.has(normalizedId)) {
      scriptByCreator.set(normalizedId, []);
    }
    scriptByCreator.get(normalizedId)!.push(entry);
  }
  
  for (const entry of reviewedEntries) {
    const normalizedId = normalizeCreatorId(entry.creator_id);
    if (!reviewedByCreator.has(normalizedId)) {
      reviewedByCreator.set(normalizedId, []);
    }
    reviewedByCreator.get(normalizedId)!.push(entry);
  }
  
  // Find issues
  const issues: Array<{
    creator_id: string;
    username: string;
    issue: string;
    script?: string;
    reviewed?: string;
    bio?: string;
  }> = [];
  
  // Check reviewed entries
  for (const [creatorId, reviewedList] of reviewedByCreator.entries()) {
    const scriptList = scriptByCreator.get(creatorId) || [];
    const scriptEmails = new Set(scriptList.map(e => e.email));
    
    for (const reviewed of reviewedList) {
      const reviewedEmail = reviewed.email;
      const isValidEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(reviewedEmail);
      
      if (!isValidEmail && reviewedEmail) {
        // Invalid email in reviewed CSV - check what's actually in the bio
        const bioEmails = extractEmailsFromBio(reviewed.bio);
        if (bioEmails.length > 0) {
          issues.push({
            creator_id: creatorId,
            username: reviewed.username,
            issue: 'INVALID_REVIEWED',
            reviewed: reviewedEmail,
            bio: reviewed.bio.substring(0, 200),
            script: bioEmails.join(', ')
          });
        }
      } else if (isValidEmail && !scriptEmails.has(reviewedEmail)) {
        // Script missed this email
        const bioEmails = extractEmailsFromBio(reviewed.bio);
        issues.push({
          creator_id: creatorId,
          username: reviewed.username,
          issue: 'MISSING',
          reviewed: reviewedEmail,
          bio: reviewed.bio.substring(0, 200),
          script: scriptList.map(e => e.email).join(', ') || 'none'
        });
      }
    }
  }
  
  // Check for extra emails in script
  for (const [creatorId, scriptList] of scriptByCreator.entries()) {
    const reviewedList = reviewedByCreator.get(creatorId) || [];
    const reviewedEmails = new Set(
      reviewedList
        .map(e => e.email)
        .filter(e => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(e))
    );
    
    for (const script of scriptList) {
      if (!reviewedEmails.has(script.email)) {
        const bioEmails = extractEmailsFromBio(script.bio);
        issues.push({
          creator_id: creatorId,
          username: script.username,
          issue: 'EXTRA',
          script: script.email,
          bio: script.bio.substring(0, 200)
        });
      }
    }
  }
  
  const missing = issues.filter(i => i.issue === 'MISSING');
  const extra = issues.filter(i => i.issue === 'EXTRA');
  const invalid = issues.filter(i => i.issue === 'INVALID_REVIEWED');
  
  console.log(`\nIssues found: ${issues.length}`);
  console.log(`- Missing: ${missing.length}`);
  console.log(`- Extra: ${extra.length}`);
  console.log(`- Invalid reviewed: ${invalid.length}\n`);
  
  // Calculate accuracy
  const totalReviewed = reviewedEntries.filter(e => 
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(e.email)
  ).length;
  const correct = totalReviewed - missing.length;
  const accuracy = totalReviewed > 0 ? (correct / totalReviewed * 100).toFixed(2) : '0.00';
  
  console.log(`Accuracy: ${accuracy}% (${correct}/${totalReviewed} correct)\n`);
  
  // Show examples
  if (missing.length > 0) {
    console.log('=== MISSING EMAILS (first 5) ===');
    missing.slice(0, 5).forEach((issue, idx) => {
      console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   Should extract: ${issue.reviewed}`);
      console.log(`   Script found: ${issue.script}`);
      console.log(`   Bio: ${issue.bio}`);
      console.log('');
    });
  }
  
  if (extra.length > 0) {
    console.log('\n=== EXTRA EMAILS (first 5) ===');
    extra.slice(0, 5).forEach((issue, idx) => {
      console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   Script extracted: ${issue.script}`);
      console.log(`   Bio: ${issue.bio}`);
      console.log('');
    });
  }
  
  if (invalid.length > 0) {
    console.log('\n=== INVALID EMAILS IN REVIEWED CSV (first 5) ===');
    invalid.slice(0, 5).forEach((issue, idx) => {
      console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   Reviewed has: ${issue.reviewed}`);
      console.log(`   Bio contains: ${issue.script}`);
      console.log(`   Bio: ${issue.bio}`);
      console.log('');
    });
  }
}

main();

