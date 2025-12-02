#!/usr/bin/env tsx

/**
 * Detailed comparison of extracted vs reviewed emails
 */

import * as fs from 'fs';
import * as path from 'path';

interface EmailRow {
  creator_id: string;
  username: string;
  contact_value: string;
  bio: string;
}

function parseCSV(filePath: string): EmailRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const rows: EmailRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
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
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    if (values.length >= 4 && values[3]) {
      let creatorId = values[0];
      // Handle scientific notation
      if (creatorId.includes('E+')) {
        const [base, exp] = creatorId.split('E+');
        const numBase = parseFloat(base);
        const numExp = parseInt(exp);
        creatorId = (numBase * Math.pow(10, numExp)).toFixed(0);
      }
      
      rows.push({
        creator_id: creatorId.replace(/[^0-9]/g, ''), // Extract just digits
        username: values[1] || '',
        contact_value: values[3] || '',
        bio: values.slice(4).join(',')
      });
    }
  }
  
  return rows;
}

function main() {
  const original = parseCSV('creator_emails.csv');
  const reviewed = parseCSV('creator_email_reviewed.csv');
  
  console.log(`Original: ${original.length} rows`);
  console.log(`Reviewed: ${reviewed.length} rows\n`);
  
  // Group by creator_id
  const originalByCreator = new Map<string, Set<string>>();
  const reviewedByCreator = new Map<string, Set<string>>();
  
  for (const row of original) {
    if (!originalByCreator.has(row.creator_id)) {
      originalByCreator.set(row.creator_id, new Set());
    }
    const email = row.contact_value.toLowerCase().trim();
    if (email && email.includes('@')) {
      originalByCreator.get(row.creator_id)!.add(email);
    }
  }
  
  for (const row of reviewed) {
    if (!reviewedByCreator.has(row.creator_id)) {
      reviewedByCreator.set(row.creator_id, new Set());
    }
    const email = row.contact_value.toLowerCase().trim();
    if (email && email.includes('@')) {
      reviewedByCreator.get(row.creator_id)!.add(email);
    }
  }
  
  // Find actual differences
  const allIds = new Set([...originalByCreator.keys(), ...reviewedByCreator.keys()]);
  const issues: Array<{id: string, username: string, original: string[], reviewed: string[], bio: string}> = [];
  
  for (const id of allIds) {
    const origEmails = Array.from(originalByCreator.get(id) || []);
    const revEmails = Array.from(reviewedByCreator.get(id) || []);
    
    if (origEmails.length === 0 && revEmails.length === 0) continue;
    
    const origSet = new Set(origEmails);
    const revSet = new Set(revEmails);
    
    const missing = revEmails.filter(e => !origSet.has(e));
    const extra = origEmails.filter(e => !revSet.has(e));
    
    if (missing.length > 0 || extra.length > 0) {
      const origRow = original.find(r => r.creator_id === id) || reviewed.find(r => r.creator_id === id);
      issues.push({
        id,
        username: origRow?.username || '',
        original: origEmails,
        reviewed: revEmails,
        bio: origRow?.bio || ''
      });
    }
  }
  
  console.log(`Found ${issues.length} creators with differences\n`);
  
  // Show first 30 issues
  for (let i = 0; i < Math.min(30, issues.length); i++) {
    const issue = issues[i];
    console.log(`${i + 1}. @${issue.username} (${issue.id})`);
    if (issue.original.length > 0) {
      console.log(`   We extracted: ${issue.original.join(', ')}`);
    }
    if (issue.reviewed.length > 0) {
      console.log(`   Should be: ${issue.reviewed.join(', ')}`);
    }
    console.log(`   Bio: ${issue.bio.substring(0, 100)}...\n`);
  }
  
  // Write full report
  const report = issues.map(i => {
    return `Creator: @${i.username} (${i.id})
Extracted: ${i.original.join(', ') || '(none)'}
Should be: ${i.reviewed.join(', ') || '(none)'}
Bio: ${i.bio.substring(0, 200)}
---
`;
  }).join('\n');
  
  fs.writeFileSync('detailed_comparison_report.txt', report);
  console.log(`\n✅ Full report written to: detailed_comparison_report.txt`);
}

main().catch(console.error);

