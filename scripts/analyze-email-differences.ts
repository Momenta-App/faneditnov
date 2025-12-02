#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

interface EmailEntry {
  creator_id: string;
  username: string;
  display_name: string;
  contact_value: string;
  bio: string;
}

function parseCSVProperly(filePath: string): EmailEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: EmailEntry[] = [];
  
  let currentEntry: Partial<EmailEntry> | null = null;
  let bioLines: string[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a new entry (has creator_id)
    const match = line.match(/^([^,]+),([^,]*),([^,]*),([^,]*),(.*)$/);
    if (match && match[1] && match[1].trim() && !match[1].startsWith(',')) {
      // Save previous entry if exists
      if (currentEntry && currentEntry.creator_id) {
        entries.push({
          creator_id: currentEntry.creator_id,
          username: currentEntry.username || '',
          display_name: currentEntry.display_name || '',
          contact_value: currentEntry.contact_value || '',
          bio: bioLines.join('\n')
        });
      }
      
      // Start new entry
      currentEntry = {
        creator_id: match[1].trim(),
        username: match[2].trim(),
        display_name: match[3].trim(),
        contact_value: match[4].trim()
      };
      bioLines = [match[5].trim()];
    } else if (currentEntry) {
      // Continuation of bio (empty fields at start)
      const bioPart = line.replace(/^,+,/, '').trim();
      if (bioPart) {
        bioLines.push(bioPart);
      }
    }
  }
  
  // Save last entry
  if (currentEntry && currentEntry.creator_id) {
    entries.push({
      creator_id: currentEntry.creator_id,
      username: currentEntry.username || '',
      display_name: currentEntry.display_name || '',
      contact_value: currentEntry.contact_value || '',
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

function extractEmailFromBio(bio: string): string[] {
  // Simple email extraction for comparison
  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
  const matches = bio.match(emailRegex) || [];
  return [...new Set(matches.map(e => e.toLowerCase().trim()))];
}

function main() {
  const scriptOutput = parseCSVProperly(path.join(process.cwd(), 'creator_emails.csv'));
  const reviewed = parseCSVProperly(path.join(process.cwd(), 'creator_email_reviewed.csv'));
  
  console.log(`Script output: ${scriptOutput.length} entries`);
  console.log(`Reviewed: ${reviewed.length} entries\n`);
  
  // Normalize creator IDs and group
  const scriptByCreator = new Map<string, EmailEntry[]>();
  const reviewedByCreator = new Map<string, EmailEntry[]>();
  
  for (const entry of scriptOutput) {
    const normalizedId = normalizeCreatorId(entry.creator_id);
    if (!scriptByCreator.has(normalizedId)) {
      scriptByCreator.set(normalizedId, []);
    }
    scriptByCreator.get(normalizedId)!.push(entry);
  }
  
  for (const entry of reviewed) {
    const normalizedId = normalizeCreatorId(entry.creator_id);
    if (!reviewedByCreator.has(normalizedId)) {
      reviewedByCreator.set(normalizedId, []);
    }
    reviewedByCreator.get(normalizedId)!.push(entry);
  }
  
  // Analyze differences
  const issues: Array<{
    creator_id: string;
    username: string;
    issue: string;
    script?: string;
    reviewed?: string;
    bio?: string;
    details?: string;
  }> = [];
  
  // Check all reviewed entries
  for (const [creatorId, reviewedEntries] of reviewedByCreator.entries()) {
    const scriptEntries = scriptByCreator.get(creatorId) || [];
    
    for (const reviewedEntry of reviewedEntries) {
      const reviewedEmail = reviewedEntry.contact_value.toLowerCase().trim();
      const emailsInBio = extractEmailFromBio(reviewedEntry.bio);
      
      // Check if reviewed email is valid
      const isValidEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(reviewedEmail);
      
      if (!isValidEmail && reviewedEmail) {
        issues.push({
          creator_id: creatorId,
          username: reviewedEntry.username,
          issue: 'INVALID_REVIEWED_EMAIL',
          reviewed: reviewedEmail,
          bio: reviewedEntry.bio.substring(0, 200),
          details: `Invalid email format in reviewed CSV. Emails found in bio: ${emailsInBio.join(', ')}`
        });
      }
      
      // Check if script found this email
      const scriptFound = scriptEntries.some(e => 
        e.contact_value.toLowerCase().trim() === reviewedEmail
      );
      
      if (!scriptFound && isValidEmail) {
        // Check if script found any email from this bio
        const scriptEmails = scriptEntries.map(e => e.contact_value.toLowerCase().trim());
        const bioEmails = extractEmailFromBio(reviewedEntry.bio);
        
        issues.push({
          creator_id: creatorId,
          username: reviewedEntry.username,
          issue: 'MISSING',
          reviewed: reviewedEmail,
          bio: reviewedEntry.bio.substring(0, 200),
          details: `Script found: ${scriptEmails.join(', ') || 'none'}. Bio contains: ${bioEmails.join(', ')}`
        });
      }
    }
  }
  
  // Check for extra emails in script
  for (const [creatorId, scriptEntries] of scriptByCreator.entries()) {
    const reviewedEntries = reviewedByCreator.get(creatorId) || [];
    const reviewedEmails = reviewedEntries
      .map(e => e.contact_value.toLowerCase().trim())
      .filter(e => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(e));
    
    for (const scriptEntry of scriptEntries) {
      const scriptEmail = scriptEntry.contact_value.toLowerCase().trim();
      const found = reviewedEmails.find(e => e === scriptEmail);
      
      if (!found) {
        const bioEmails = extractEmailFromBio(scriptEntry.bio);
        issues.push({
          creator_id: creatorId,
          username: scriptEntry.username,
          issue: 'EXTRA',
          script: scriptEmail,
          bio: scriptEntry.bio.substring(0, 200),
          details: `Bio contains: ${bioEmails.join(', ')}`
        });
      }
    }
  }
  
  console.log(`\nFound ${issues.length} issues:\n`);
  
  const missing = issues.filter(i => i.issue === 'MISSING');
  const extra = issues.filter(i => i.issue === 'EXTRA');
  const invalid = issues.filter(i => i.issue === 'INVALID_REVIEWED_EMAIL');
  
  console.log(`Missing: ${missing.length}`);
  console.log(`Extra: ${extra.length}`);
  console.log(`Invalid reviewed emails: ${invalid.length}\n`);
  
  // Show examples
  if (invalid.length > 0) {
    console.log('=== INVALID EMAILS IN REVIEWED CSV (first 10) ===');
    invalid.slice(0, 10).forEach((issue, idx) => {
      console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   Reviewed email: ${issue.reviewed}`);
      console.log(`   ${issue.details}`);
      console.log(`   Bio: ${issue.bio}`);
      console.log('');
    });
  }
  
  if (missing.length > 0) {
    console.log('\n=== MISSING EMAILS (first 10) ===');
    missing.slice(0, 10).forEach((issue, idx) => {
      console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   Reviewed: ${issue.reviewed}`);
      console.log(`   ${issue.details}`);
      console.log(`   Bio: ${issue.bio}`);
      console.log('');
    });
  }
  
  if (extra.length > 0) {
    console.log('\n=== EXTRA EMAILS (first 10) ===');
    extra.slice(0, 10).forEach((issue, idx) => {
      console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   Script: ${issue.script}`);
      console.log(`   ${issue.details}`);
      console.log(`   Bio: ${issue.bio}`);
      console.log('');
    });
  }
  
  // Write detailed report
  const reportPath = path.join(process.cwd(), 'email_analysis_detailed.txt');
  const report = [
    `Email Extraction Analysis Report`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Script Output: ${scriptOutput.length} entries`,
    `Reviewed: ${reviewed.length} entries`,
    ``,
    `Issues Found: ${issues.length}`,
    `- Missing: ${missing.length}`,
    `- Extra: ${extra.length}`,
    `- Invalid reviewed emails: ${invalid.length}`,
    ``,
    `=== INVALID EMAILS IN REVIEWED CSV ===`,
    ...invalid.map((issue, idx) => 
      `${idx + 1}. @${issue.username} (${issue.creator_id})\n   Reviewed: ${issue.reviewed}\n   ${issue.details}\n   Bio: ${issue.bio}`
    ),
    ``,
    `=== MISSING EMAILS ===`,
    ...missing.map((issue, idx) => 
      `${idx + 1}. @${issue.username} (${issue.creator_id})\n   Reviewed: ${issue.reviewed}\n   ${issue.details}\n   Bio: ${issue.bio}`
    ),
    ``,
    `=== EXTRA EMAILS ===`,
    ...extra.map((issue, idx) => 
      `${idx + 1}. @${issue.username} (${issue.creator_id})\n   Script: ${issue.script}\n   ${issue.details}\n   Bio: ${issue.bio}`
    )
  ].join('\n\n');
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Detailed report written to: ${reportPath}`);
}

main();
