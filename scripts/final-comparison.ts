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
      const email = fields[3].toLowerCase().trim();
      if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(email)) {
        entries.push({
          creator_id: fields[0],
          username: fields[1],
          email: email,
          bio: fields.slice(4).join(',')
        });
      }
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
    const firstComma = line.indexOf(',');
    
    if (firstComma > 0) {
      const firstField = line.substring(0, firstComma).trim();
      
      if (firstField && (firstField.match(/^\d+$/) || firstField.match(/^\d+\.\d+E\+\d+$/))) {
        if (currentEntry && currentEntry.creator_id) {
          const email = (currentEntry.email || '').toLowerCase().trim();
          if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(email)) {
            entries.push({
              creator_id: normalizeCreatorId(currentEntry.creator_id),
              username: currentEntry.username || '',
              email: email,
              bio: bioLines.join('\n')
            });
          }
        }
        
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
        const bioPart = line.replace(/^,+/, '').trim();
        if (bioPart) {
          bioLines.push(bioPart);
        }
      }
    }
  }
  
  if (currentEntry && currentEntry.creator_id) {
    const email = (currentEntry.email || '').toLowerCase().trim();
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(email)) {
      entries.push({
        creator_id: normalizeCreatorId(currentEntry.creator_id),
        username: currentEntry.username || '',
        email: email,
        bio: bioLines.join('\n')
      });
    }
  }
  
  return entries;
}

function normalizeCreatorId(id: string): string {
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
  
  console.log(`Script extracted: ${scriptEntries.length} valid emails`);
  console.log(`Reviewed CSV has: ${reviewedEntries.length} valid emails\n`);
  
  // Group by username + email (more reliable than creator_id due to scientific notation rounding)
  const scriptSet = new Set(scriptEntries.map(e => `${e.username.toLowerCase()}|${e.email}`));
  const reviewedSet = new Set(reviewedEntries.map(e => `${e.username.toLowerCase()}|${e.email}`));
  
  // Find matches
  const matches = [...scriptSet].filter(e => reviewedSet.has(e));
  const missing = [...reviewedSet].filter(e => !scriptSet.has(e));
  const extra = [...scriptSet].filter(e => !reviewedSet.has(e));
  
  console.log(`Matches: ${matches.length}`);
  console.log(`Missing: ${missing.length}`);
  console.log(`Extra: ${extra.length}\n`);
  
  const accuracy = reviewedEntries.length > 0 
    ? (matches.length / reviewedEntries.length * 100).toFixed(2)
    : '0.00';
  
  console.log(`Accuracy: ${accuracy}% (${matches.length}/${reviewedEntries.length})\n`);
  
  // Show examples of missing and extra
  if (missing.length > 0) {
    console.log('=== MISSING EMAILS (first 10) ===');
    const missingList = missing.slice(0, 10).map(e => {
      const [username, email] = e.split('|');
      const entry = reviewedEntries.find(r => 
        r.username.toLowerCase() === username && r.email === email
      );
      return { username, email, entry };
    });
    
    missingList.forEach((item, idx) => {
      if (item.entry) {
        console.log(`${idx + 1}. @${item.entry.username}`);
        console.log(`   Should extract: ${item.email}`);
        const bioEmails = extractEmailsFromBio(item.entry.bio);
        console.log(`   Emails in bio: ${bioEmails.join(', ') || 'none'}`);
        console.log(`   Bio preview: ${item.entry.bio.substring(0, 150)}`);
        console.log('');
      }
    });
  }
  
  if (extra.length > 0) {
    console.log('\n=== EXTRA EMAILS (first 10) ===');
    const extraList = extra.slice(0, 10).map(e => {
      const [username, email] = e.split('|');
      const entry = scriptEntries.find(s => 
        s.username.toLowerCase() === username && s.email === email
      );
      return { username, email, entry };
    });
    
    extraList.forEach((item, idx) => {
      if (item.entry) {
        console.log(`${idx + 1}. @${item.entry.username}`);
        console.log(`   Script extracted: ${item.email}`);
        const bioEmails = extractEmailsFromBio(item.entry.bio);
        console.log(`   Emails in bio: ${bioEmails.join(', ') || 'none'}`);
        console.log(`   Bio preview: ${item.entry.bio.substring(0, 150)}`);
        console.log('');
      }
    });
  }
  
  console.log(`\n✅ Comparison complete!`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the missing and extra emails above`);
  console.log(`2. Check if missing emails are actually in the bios`);
  console.log(`3. Check if extra emails should be filtered out`);
  console.log(`4. Iterate on the extraction logic if needed`);
}

main();
