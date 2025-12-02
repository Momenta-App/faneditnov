#!/usr/bin/env tsx

/**
 * Compare new extraction results with reviewed version
 */

import * as fs from 'fs';
import * as path from 'path';

function normalizeId(id: string): string {
  if (!id) return '';
  if (id.includes('E+') || id.includes('e+')) {
    try {
      // For scientific notation, try to preserve as much precision as possible
      // But note: scientific notation loses precision for very large numbers
      // So we'll use username for matching instead when IDs don't match
      const num = parseFloat(id);
      // Round to nearest integer, but this may lose precision
      return String(Math.round(num));
    } catch {
      return id.trim();
    }
  }
  return id.trim();
}

// Helper to create a match key from username and email
function createMatchKey(username: string, email: string): string {
  return `${username.toLowerCase()}|${email.toLowerCase()}`;
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
        i++;
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

interface Entry {
  creator_id: string;
  username: string;
  email: string;
  bio: string;
}

function parseCSV(filePath: string): Entry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const entries: Entry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      const creator_id = values[headers.indexOf('creator_id')] || '';
      const username = values[headers.indexOf('username')] || '';
      const contact_value = values[headers.indexOf('contact_value')] || '';
      const bio = values[headers.indexOf('bio')] || '';
      
      if (!creator_id && !username && !contact_value) continue;
      
      entries.push({
        creator_id: normalizeId(creator_id),
        username: username.trim(),
        email: contact_value.trim().toLowerCase(),
        bio: bio.trim(),
      });
    }
  }
  
  return entries;
}

function main() {
  const newResults = parseCSV(path.join(process.cwd(), 'creator_emails.csv'));
  const reviewed = parseCSV(path.join(process.cwd(), 'creator_email_reviewed.csv'));

  console.log(`New results: ${newResults.length} entries`);
  console.log(`Reviewed: ${reviewed.length} entries\n`);

  // Group by creator_id AND by username+email (for matching when IDs don't match due to scientific notation)
  const newByCreator = new Map<string, Entry[]>();
  const newByKey = new Map<string, Entry[]>(); // username|email -> entries
  const revByCreator = new Map<string, Entry[]>();
  const revByKey = new Map<string, Entry[]>(); // username|email -> entries

  for (const entry of newResults) {
    if (!entry.email) continue;
    if (entry.creator_id) {
      if (!newByCreator.has(entry.creator_id)) {
        newByCreator.set(entry.creator_id, []);
      }
      newByCreator.get(entry.creator_id)!.push(entry);
    }
    const key = createMatchKey(entry.username, entry.email);
    if (!newByKey.has(key)) {
      newByKey.set(key, []);
    }
    newByKey.get(key)!.push(entry);
  }

  // For reviewed file: entries with creator_id contain emails
  // Entries without creator_id but WITH email are CORRECT emails (corrections)
  // Entries without creator_id and WITHOUT email are just bio continuations (ignore)
  // We need to track the "current" creator_id as we process rows
  let currentCreatorId = '';
  let currentUsername = '';
  for (const entry of reviewed) {
    if (entry.creator_id) {
      currentCreatorId = entry.creator_id;
      currentUsername = entry.username;
      if (entry.email) {
        if (!revByCreator.has(currentCreatorId)) {
          revByCreator.set(currentCreatorId, []);
        }
        // This is an extracted email - might be correct or wrong
        revByCreator.get(currentCreatorId)!.push(entry);
        // Also add to key map
        const key = createMatchKey(entry.username, entry.email);
        if (!revByKey.has(key)) {
          revByKey.set(key, []);
        }
        revByKey.get(key)!.push(entry);
      }
    } else if (currentCreatorId && entry.email) {
      // This is a correction row - the CORRECT email (no creator_id but has email)
      if (!revByCreator.has(currentCreatorId)) {
        revByCreator.set(currentCreatorId, []);
      }
      // This is the correct email
      revByCreator.get(currentCreatorId)!.push(entry);
      // Also add to key map with current username
      const key = createMatchKey(currentUsername, entry.email);
      if (!revByKey.has(key)) {
        revByKey.set(key, []);
      }
      revByKey.get(key)!.push({...entry, username: currentUsername, creator_id: currentCreatorId});
    }
    // If no creator_id and no email, it's just a bio continuation - ignore
  }
  
  // For each creator, if there are correction rows (no creator_id), use those as the correct emails
  // Otherwise, use the emails from rows with creator_id (but filter out invalid patterns)
  const correctEmailsByCreator = new Map<string, string[]>();
  for (const [id, entries] of revByCreator.entries()) {
    // Separate entries with creator_id vs without
    const withId = entries.filter(e => e.creator_id === id);
    const withoutId = entries.filter(e => !e.creator_id);
    
    if (withoutId.length > 0) {
      // Use correction emails (without creator_id) as the correct ones
      const correctEmails = [...new Set(withoutId.map(e => e.email).filter(e => e))];
      // Filter out invalid patterns just in case
      const validEmails = correctEmails.filter(e => 
        !e.includes('.@') && !e.includes('..') && !e.endsWith('.') && !e.match(/@\./)
      );
      if (validEmails.length > 0) {
        correctEmailsByCreator.set(id, validEmails);
      }
    } else if (withId.length > 0) {
      // Use emails from rows with creator_id, but filter out invalid patterns
      const emails = [...new Set(withId.map(e => e.email).filter(e => e))];
      const validEmails = emails.filter(e => 
        !e.includes('.@') && !e.includes('..') && !e.endsWith('.') && !e.match(/@\./)
      );
      if (validEmails.length > 0) {
        correctEmailsByCreator.set(id, validEmails);
      }
    }
  }

  // Match entries by ID first, then by username+email for those that don't match
  const allIds = new Set([...newByCreator.keys(), ...revByCreator.keys()]);
  const matchedByKey = new Set<string>();
  
  const issues: Array<{
    creator_id: string;
    username: string;
    newEmails: string[];
    reviewedEmails: string[];
    bio: string;
    issue: string;
  }> = [];

  // First, try matching by ID
  for (const id of allIds) {
    const newEntries = newByCreator.get(id) || [];
    const newEmails = [...new Set(newEntries.map(e => e.email).filter(e => e))].sort();
    const revEmails = correctEmailsByCreator.get(id) || [];
    
    if (newEntries.length > 0 && revEmails.length > 0) {
      // Mark as matched
      for (const entry of newEntries) {
        const key = createMatchKey(entry.username, entry.email);
        matchedByKey.add(key);
      }
    }

    const newSet = new Set(newEmails);
    const revSet = new Set(revEmails);

    const extraInNew = newEmails.filter(e => !revSet.has(e));
    const missingInNew = revEmails.filter(e => !newSet.has(e));

    if (extraInNew.length > 0 || missingInNew.length > 0) {
      const revEntries = revByCreator.get(id) || [];
      const bio = (newEntries[0] || revEntries[0])?.bio || '';
      const username = (newEntries[0] || revEntries[0])?.username || '';

      let issue = '';
      if (extraInNew.length > 0 && missingInNew.length > 0) {
        issue = `Both extra and missing: extra=${extraInNew.join(', ')}, missing=${missingInNew.join(', ')}`;
      } else if (extraInNew.length > 0) {
        issue = `Extra: ${extraInNew.join(', ')}`;
      } else {
        issue = `Missing: ${missingInNew.join(', ')}`;
      }

      issues.push({
        creator_id: id,
        username,
        newEmails,
        reviewedEmails: revEmails,
        bio,
        issue,
      });
    }
  }
  
  // Then, match remaining entries by username+email
  for (const [key, newEntries] of newByKey.entries()) {
    if (matchedByKey.has(key)) continue; // Already matched by ID
    
    const revEntries = revByKey.get(key) || [];
    if (revEntries.length === 0) {
      // Not in reviewed - might be an issue
      const newEmails = [...new Set(newEntries.map(e => e.email).filter(e => e))];
      if (newEmails.length > 0) {
        issues.push({
          creator_id: newEntries[0].creator_id,
          username: newEntries[0].username,
          newEmails,
          reviewedEmails: [],
          bio: newEntries[0].bio,
          issue: `Extra: ${newEmails.join(', ')}`,
        });
      }
    }
  }

  console.log(`Found ${issues.length} creators with differences\n`);

  // Categorize issues
  const categories = {
    invalidPatterns: [] as typeof issues,
    concatenated: [] as typeof issues,
    missing: [] as typeof issues,
    other: [] as typeof issues,
  };

  for (const issue of issues) {
    let categorized = false;
    
    // Check for invalid patterns (like .@)
    for (const email of issue.newEmails) {
      if (email.includes('.@') || email.includes('..') || email.endsWith('.')) {
        categories.invalidPatterns.push(issue);
        categorized = true;
        break;
      }
    }
    
    if (categorized) continue;
    
    // Check for concatenated emails
    for (const newEmail of issue.newEmails) {
      if (!issue.reviewedEmails.includes(newEmail)) {
        // Check if any reviewed email is contained in new email (concatenated before)
        const found = issue.reviewedEmails.find(r => newEmail.includes(r) && newEmail.length > r.length + 3);
        if (found) {
          categories.concatenated.push(issue);
          categorized = true;
          break;
        }
      }
    }
    
    if (categorized) continue;
    
    if (issue.issue.includes('Missing')) {
      categories.missing.push(issue);
    } else {
      categories.other.push(issue);
    }
  }

  console.log('=== ISSUE CATEGORIES ===\n');
  console.log(`Invalid patterns (.@, .., etc.): ${categories.invalidPatterns.length}`);
  console.log(`Concatenated emails: ${categories.concatenated.length}`);
  console.log(`Missing emails: ${categories.missing.length}`);
  console.log(`Other issues: ${categories.other.length}\n`);

  // Show examples
  if (categories.invalidPatterns.length > 0) {
    console.log('=== INVALID PATTERNS ===');
    categories.invalidPatterns.slice(0, 10).forEach((issue, idx) => {
      console.log(`\n${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   New: ${issue.newEmails.join(', ')}`);
      console.log(`   Reviewed: ${issue.reviewedEmails.join(', ')}`);
      console.log(`   Bio: ${issue.bio.substring(0, 100)}...`);
    });
    console.log('\n');
  }

  if (categories.concatenated.length > 0) {
    console.log('=== CONCATENATED EMAILS ===');
    categories.concatenated.slice(0, 10).forEach((issue, idx) => {
      console.log(`\n${idx + 1}. @${issue.username} (${issue.creator_id})`);
      console.log(`   New: ${issue.newEmails.join(', ')}`);
      console.log(`   Reviewed: ${issue.reviewedEmails.join(', ')}`);
      console.log(`   Bio: ${issue.bio.substring(0, 100)}...`);
    });
    console.log('\n');
  }

  // Calculate accuracy
  const totalCreators = allIds.size;
  const correctCreators = totalCreators - issues.length;
  const accuracy = ((correctCreators / totalCreators) * 100).toFixed(2);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total creators: ${totalCreators}`);
  console.log(`Correct extractions: ${correctCreators}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`Accuracy: ${accuracy}%\n`);

  // Write detailed report
  const reportPath = path.join(process.cwd(), 'comparison_report.txt');
  const lines: string[] = [];
  
  lines.push('EMAIL EXTRACTION COMPARISON REPORT');
  lines.push('='.repeat(60));
  lines.push(`\nTotal creators: ${totalCreators}`);
  lines.push(`Correct: ${correctCreators}`);
  lines.push(`Issues: ${issues.length}`);
  lines.push(`Accuracy: ${accuracy}%`);
  lines.push(`\nCategories:`);
  lines.push(`- Invalid patterns: ${categories.invalidPatterns.length}`);
  lines.push(`- Concatenated: ${categories.concatenated.length}`);
  lines.push(`- Missing: ${categories.missing.length}`);
  lines.push(`- Other: ${categories.other.length}`);

  lines.push('\n\n=== ALL ISSUES ===\n');
  issues.forEach((issue, idx) => {
    lines.push(`${idx + 1}. @${issue.username} (${issue.creator_id})`);
    lines.push(`   Issue: ${issue.issue}`);
    lines.push(`   New: ${issue.newEmails.join(', ')}`);
    lines.push(`   Reviewed: ${issue.reviewedEmails.join(', ')}`);
    lines.push(`   Bio: ${issue.bio}`);
    lines.push('');
  });

  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`✅ Detailed report written to: ${reportPath}`);
}

main();

