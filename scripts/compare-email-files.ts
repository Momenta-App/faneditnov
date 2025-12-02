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

function parseCSV(filePath: string): EmailEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: EmailEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (handles quoted fields)
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
        display_name: fields[2],
        contact_value: fields[3],
        bio: fields.slice(4).join(',') // Bio might contain commas
      });
    }
  }
  
  return entries;
}

function main() {
  const scriptOutput = parseCSV(path.join(process.cwd(), 'creator_emails.csv'));
  const reviewed = parseCSV(path.join(process.cwd(), 'creator_email_reviewed.csv'));
  
  console.log(`Script output: ${scriptOutput.length} entries`);
  console.log(`Reviewed: ${reviewed.length} entries\n`);
  
  // Group by creator_id
  const scriptByCreator = new Map<string, EmailEntry[]>();
  const reviewedByCreator = new Map<string, EmailEntry[]>();
  
  for (const entry of scriptOutput) {
    if (!scriptByCreator.has(entry.creator_id)) {
      scriptByCreator.set(entry.creator_id, []);
    }
    scriptByCreator.get(entry.creator_id)!.push(entry);
  }
  
  for (const entry of reviewed) {
    if (!reviewedByCreator.has(entry.creator_id)) {
      reviewedByCreator.set(entry.creator_id, []);
    }
    reviewedByCreator.get(entry.creator_id)!.push(entry);
  }
  
  // Find differences
  const issues: Array<{
    creator_id: string;
    username: string;
    issue: string;
    script?: string;
    reviewed?: string;
    bio?: string;
  }> = [];
  
  // Check all reviewed entries
  for (const [creatorId, reviewedEntries] of reviewedByCreator.entries()) {
    const scriptEntries = scriptByCreator.get(creatorId) || [];
    const reviewedEmails = reviewedEntries.map(e => e.contact_value.toLowerCase().trim());
    const scriptEmails = scriptEntries.map(e => e.contact_value.toLowerCase().trim());
    
    for (const reviewedEntry of reviewedEntries) {
      const reviewedEmail = reviewedEntry.contact_value.toLowerCase().trim();
      const scriptEmail = scriptEntries.find(e => 
        e.contact_value.toLowerCase().trim() === reviewedEmail
      );
      
      if (!scriptEmail) {
        // Missing email
        issues.push({
          creator_id: creatorId,
          username: reviewedEntry.username,
          issue: 'MISSING',
          reviewed: reviewedEmail,
          bio: reviewedEntry.bio.substring(0, 150)
        });
      } else if (scriptEmail.contact_value !== reviewedEntry.contact_value) {
        // Different (case or whitespace)
        issues.push({
          creator_id: creatorId,
          username: reviewedEntry.username,
          issue: 'DIFFERENT',
          script: scriptEmail.contact_value,
          reviewed: reviewedEntry.contact_value,
          bio: reviewedEntry.bio.substring(0, 150)
        });
      }
    }
  }
  
  // Check for extra emails in script output
  for (const [creatorId, scriptEntries] of scriptByCreator.entries()) {
    const reviewedEntries = reviewedByCreator.get(creatorId) || [];
    const reviewedEmails = reviewedEntries.map(e => e.contact_value.toLowerCase().trim());
    
    for (const scriptEntry of scriptEntries) {
      const scriptEmail = scriptEntry.contact_value.toLowerCase().trim();
      const found = reviewedEmails.find(e => e === scriptEmail);
      
      if (!found) {
        issues.push({
          creator_id: creatorId,
          username: scriptEntry.username,
          issue: 'EXTRA',
          script: scriptEmail,
          bio: scriptEntry.bio.substring(0, 150)
        });
      }
    }
  }
  
  console.log(`\nFound ${issues.length} issues:\n`);
  
  const missing = issues.filter(i => i.issue === 'MISSING');
  const extra = issues.filter(i => i.issue === 'EXTRA');
  const different = issues.filter(i => i.issue === 'DIFFERENT');
  
  console.log(`Missing: ${missing.length}`);
  console.log(`Extra: ${extra.length}`);
  console.log(`Different: ${different.length}\n`);
  
  // Show examples
  console.log('=== MISSING EMAILS (first 10) ===');
  missing.slice(0, 10).forEach((issue, idx) => {
    console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
    console.log(`   Reviewed: ${issue.reviewed}`);
    console.log(`   Bio: ${issue.bio}`);
    console.log('');
  });
  
  console.log('\n=== EXTRA EMAILS (first 10) ===');
  extra.slice(0, 10).forEach((issue, idx) => {
    console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
    console.log(`   Script: ${issue.script}`);
    console.log(`   Bio: ${issue.bio}`);
    console.log('');
  });
  
  console.log('\n=== DIFFERENT EMAILS (first 10) ===');
  different.slice(0, 10).forEach((issue, idx) => {
    console.log(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
    console.log(`   Script: ${issue.script}`);
    console.log(`   Reviewed: ${issue.reviewed}`);
    console.log(`   Bio: ${issue.bio}`);
    console.log('');
  });
  
  // Write detailed report
  const reportPath = path.join(process.cwd(), 'email_comparison_report.txt');
  const report = [
    `Email Extraction Comparison Report`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Script Output: ${scriptOutput.length} entries`,
    `Reviewed: ${reviewed.length} entries`,
    ``,
    `Issues Found: ${issues.length}`,
    `- Missing: ${missing.length}`,
    `- Extra: ${extra.length}`,
    `- Different: ${different.length}`,
    ``,
    `=== MISSING EMAILS ===`,
    ...missing.map((issue, idx) => 
      `${idx + 1}. @${issue.username} (${issue.creator_id})\n   Reviewed: ${issue.reviewed}\n   Bio: ${issue.bio}`
    ),
    ``,
    `=== EXTRA EMAILS ===`,
    ...extra.map((issue, idx) => 
      `${idx + 1}. @${issue.username} (${issue.creator_id})\n   Script: ${issue.script}\n   Bio: ${issue.bio}`
    ),
    ``,
    `=== DIFFERENT EMAILS ===`,
    ...different.map((issue, idx) => 
      `${idx + 1}. @${issue.username} (${issue.creator_id})\n   Script: ${issue.script}\n   Reviewed: ${issue.reviewed}\n   Bio: ${issue.bio}`
    )
  ].join('\n\n');
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n✅ Detailed report written to: ${reportPath}`);
}

main();
