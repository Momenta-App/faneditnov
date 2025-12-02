#!/usr/bin/env tsx

/**
 * Compare original email extraction with reviewed version
 * to identify patterns of errors
 */

import * as fs from 'fs';
import * as path from 'path';

interface EmailEntry {
  creator_id: string;
  username: string;
  display_name: string;
  contact_value: string;
  bio: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(filePath: string): EmailEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const entries: EmailEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      const entry: any = {};
      headers.forEach((header, idx) => {
        entry[header] = values[idx] || '';
      });
      entries.push(entry as EmailEntry);
    }
  }
  
  return entries;
}

function main() {
  const originalPath = path.join(process.cwd(), 'creator_emails.csv');
  const reviewedPath = path.join(process.cwd(), 'creator_email_reviewed.csv');

  const original = parseCSV(originalPath);
  const reviewed = parseCSV(reviewedPath);

  console.log(`Original entries: ${original.length}`);
  console.log(`Reviewed entries: ${reviewed.length}\n`);

  // Group by creator_id
  const originalByCreator = new Map<string, EmailEntry[]>();
  const reviewedByCreator = new Map<string, EmailEntry[]>();

  for (const entry of original) {
    const id = entry.creator_id;
    if (!originalByCreator.has(id)) {
      originalByCreator.set(id, []);
    }
    originalByCreator.get(id)!.push(entry);
  }

  for (const entry of reviewed) {
    const id = entry.creator_id;
    if (!reviewedByCreator.has(id)) {
      reviewedByCreator.set(id, []);
    }
    reviewedByCreator.get(id)!.push(entry);
  }

  const issues: Array<{
    creator_id: string;
    username: string;
    issue: string;
    original: string[];
    reviewed: string[];
    bio: string;
  }> = [];

  // Check all creators
  const allCreatorIds = new Set([
    ...originalByCreator.keys(),
    ...reviewedByCreator.keys(),
  ]);

  for (const creatorId of allCreatorIds) {
    const orig = originalByCreator.get(creatorId) || [];
    const rev = reviewedByCreator.get(creatorId) || [];

    const origEmails = orig.map(e => e.contact_value.toLowerCase()).sort();
    const revEmails = rev.map(e => e.contact_value.toLowerCase()).sort();

    const origSet = new Set(origEmails);
    const revSet = new Set(revEmails);

    // Find differences
    const extraInOriginal = origEmails.filter(e => !revSet.has(e));
    const missingInOriginal = revEmails.filter(e => !origSet.has(e));

    if (extraInOriginal.length > 0 || missingInOriginal.length > 0) {
      const bio = (orig[0] || rev[0])?.bio || '';
      const username = (orig[0] || rev[0])?.username || '';

      let issue = '';
      if (extraInOriginal.length > 0 && missingInOriginal.length > 0) {
        issue = `Wrong emails extracted (extra: ${extraInOriginal.join(', ')}, missing: ${missingInOriginal.join(', ')})`;
      } else if (extraInOriginal.length > 0) {
        issue = `Extra emails extracted: ${extraInOriginal.join(', ')}`;
      } else {
        issue = `Missing emails: ${missingInOriginal.join(', ')}`;
      }

      issues.push({
        creator_id: creatorId,
        username,
        issue,
        original: origEmails,
        reviewed: revEmails,
        bio,
      });
    }
  }

  console.log(`Found ${issues.length} creators with issues\n`);

  // Categorize issues
  const categories = {
    extraTextBefore: [] as typeof issues,
    extraTextAfter: [] as typeof issues,
    missingEmails: [] as typeof issues,
    wrongEmails: [] as typeof issues,
    concatenated: [] as typeof issues,
  };

  for (const issue of issues) {
    const orig = issue.original;
    const rev = issue.reviewed;

    // Check for extra text before email
    for (const origEmail of orig) {
      if (!rev.includes(origEmail)) {
        // Check if any reviewed email is contained in original
        const found = rev.find(r => origEmail.includes(r) && origEmail.length > r.length + 3);
        if (found) {
          const prefix = origEmail.substring(0, origEmail.indexOf(found));
          if (prefix.length > 0 && prefix.length < 20) {
            categories.extraTextBefore.push(issue);
            break;
          }
        }
      }
    }

    // Check for extra text after email
    for (const origEmail of orig) {
      if (!rev.includes(origEmail)) {
        const found = rev.find(r => r.includes(origEmail) && r.length > origEmail.length + 3);
        if (found) {
          categories.extraTextAfter.push(issue);
          break;
        }
      }
    }

    // Check for concatenated emails (from line breaks)
    const bioLower = issue.bio.toLowerCase();
    for (const origEmail of orig) {
      if (!rev.includes(origEmail)) {
        // Check if email contains parts that shouldn't be together
        const parts = origEmail.split('@');
        if (parts.length === 2) {
          const local = parts[0];
          // Check if local part contains common words that shouldn't be in email
          const commonWords = ['contact', 'business', 'promo', 'promotion', 'collab', 'work', 'ads', 'mail'];
          for (const word of commonWords) {
            if (local.includes(word) && local.length > word.length + 5) {
              // Might be concatenated
              const wordIndex = local.toLowerCase().indexOf(word);
              if (wordIndex > 0 && wordIndex < local.length - word.length) {
                categories.concatenated.push(issue);
                break;
              }
            }
          }
        }
      }
    }

    // Check for missing emails
    if (rev.length > orig.length) {
      categories.missingEmails.push(issue);
    }

    // Check for completely wrong emails
    if (orig.length > 0 && rev.length > 0 && 
        !orig.some(o => rev.includes(o)) && 
        !rev.some(r => orig.includes(r))) {
      categories.wrongEmails.push(issue);
    }
  }

  // Print categorized issues
  console.log('=== ISSUE CATEGORIES ===\n');
  console.log(`Extra text before email: ${categories.extraTextBefore.length}`);
  console.log(`Extra text after email: ${categories.extraTextAfter.length}`);
  console.log(`Concatenated emails: ${categories.concatenated.length}`);
  console.log(`Missing emails: ${categories.missingEmails.length}`);
  console.log(`Wrong emails: ${categories.wrongEmails.length}\n`);

  // Show examples
  console.log('\n=== EXAMPLES ===\n');

  if (categories.extraTextBefore.length > 0) {
    console.log('EXTRA TEXT BEFORE EMAIL:');
    categories.extraTextBefore.slice(0, 5).forEach((issue, idx) => {
      console.log(`\n${idx + 1}. @${issue.username}`);
      console.log(`   Original: ${issue.original.join(', ')}`);
      console.log(`   Reviewed: ${issue.reviewed.join(', ')}`);
      console.log(`   Bio: ${issue.bio.substring(0, 150)}...`);
    });
    console.log('\n');
  }

  if (categories.extraTextAfter.length > 0) {
    console.log('EXTRA TEXT AFTER EMAIL:');
    categories.extraTextAfter.slice(0, 5).forEach((issue, idx) => {
      console.log(`\n${idx + 1}. @${issue.username}`);
      console.log(`   Original: ${issue.original.join(', ')}`);
      console.log(`   Reviewed: ${issue.reviewed.join(', ')}`);
      console.log(`   Bio: ${issue.bio.substring(0, 150)}...`);
    });
    console.log('\n');
  }

  if (categories.concatenated.length > 0) {
    console.log('CONCATENATED EMAILS:');
    categories.concatenated.slice(0, 5).forEach((issue, idx) => {
      console.log(`\n${idx + 1}. @${issue.username}`);
      console.log(`   Original: ${issue.original.join(', ')}`);
      console.log(`   Reviewed: ${issue.reviewed.join(', ')}`);
      console.log(`   Bio: ${issue.bio.substring(0, 150)}...`);
    });
    console.log('\n');
  }

  // Write detailed report
  const reportPath = path.join(process.cwd(), 'email_extraction_analysis.txt');
  const reportLines: string[] = [];
  
  reportLines.push('EMAIL EXTRACTION ANALYSIS REPORT');
  reportLines.push('='.repeat(50));
  reportLines.push(`\nTotal creators with issues: ${issues.length}`);
  reportLines.push(`\nCategories:`);
  reportLines.push(`- Extra text before email: ${categories.extraTextBefore.length}`);
  reportLines.push(`- Extra text after email: ${categories.extraTextAfter.length}`);
  reportLines.push(`- Concatenated emails: ${categories.concatenated.length}`);
  reportLines.push(`- Missing emails: ${categories.missingEmails.length}`);
  reportLines.push(`- Wrong emails: ${categories.wrongEmails.length}`);

  reportLines.push('\n\n=== ALL ISSUES ===\n');
  issues.forEach((issue, idx) => {
    reportLines.push(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
    reportLines.push(`   Issue: ${issue.issue}`);
    reportLines.push(`   Original: ${issue.original.join(', ')}`);
    reportLines.push(`   Reviewed: ${issue.reviewed.join(', ')}`);
    reportLines.push(`   Bio: ${issue.bio}`);
    reportLines.push('');
  });

  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`\n✅ Detailed report written to: ${reportPath}`);
}

main();

