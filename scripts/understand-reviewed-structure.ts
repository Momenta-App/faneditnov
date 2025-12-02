#!/usr/bin/env tsx

/**
 * Understand the structure of the reviewed CSV file
 * to identify which emails are correct vs incorrect
 */

import * as fs from 'fs';
import * as path from 'path';

function normalizeId(id: string): string {
  if (!id) return '';
  if (id.includes('E+') || id.includes('e+')) {
    try {
      return String(Math.round(parseFloat(id)));
    } catch {
      return id.trim();
    }
  }
  return id.trim();
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
  hasCreatorId: boolean;
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
      
      entries.push({
        creator_id: normalizeId(creator_id),
        username: username.trim(),
        email: contact_value.trim().toLowerCase(),
        bio: bio.trim(),
        hasCreatorId: !!creator_id.trim(),
      });
    }
  }
  
  return entries;
}

function main() {
  const reviewed = parseCSV(path.join(process.cwd(), 'creator_email_reviewed.csv'));
  
  // Group entries - entries with creator_id are the extracted emails
  // Entries without creator_id but with email might be corrections
  const byCreator = new Map<string, { extracted: Entry[], corrections: Entry[] }>();
  
  let currentCreatorId = '';
  for (const entry of reviewed) {
    if (entry.hasCreatorId && entry.creator_id) {
      currentCreatorId = entry.creator_id;
      if (!byCreator.has(currentCreatorId)) {
        byCreator.set(currentCreatorId, { extracted: [], corrections: [] });
      }
      if (entry.email) {
        byCreator.get(currentCreatorId)!.extracted.push(entry);
      }
    } else if (currentCreatorId && entry.email) {
      // This is a correction row (no creator_id but has email)
      if (byCreator.has(currentCreatorId)) {
        byCreator.get(currentCreatorId)!.corrections.push(entry);
      }
    }
  }
  
  // Find cases where corrections exist
  const withCorrections: Array<{
    creator_id: string;
    username: string;
    extracted: string[];
    corrections: string[];
    bio: string;
  }> = [];
  
  for (const [id, data] of byCreator.entries()) {
    if (data.corrections.length > 0) {
      withCorrections.push({
        creator_id: id,
        username: data.extracted[0]?.username || '',
        extracted: [...new Set(data.extracted.map(e => e.email).filter(e => e))],
        corrections: [...new Set(data.corrections.map(e => e.email).filter(e => e))],
        bio: data.extracted[0]?.bio || '',
      });
    }
  }
  
  console.log(`Found ${withCorrections.length} creators with corrections\n`);
  console.log('=== EXAMPLES WITH CORRECTIONS ===\n');
  
  withCorrections.slice(0, 20).forEach((item, idx) => {
    console.log(`${idx + 1}. @${item.username} (${item.creator_id})`);
    console.log(`   Extracted (WRONG): ${item.extracted.join(', ')}`);
    console.log(`   Correct: ${item.corrections.join(', ')}`);
    console.log(`   Bio: ${item.bio.substring(0, 100)}...`);
    console.log();
  });
  
  // Write analysis
  const reportPath = path.join(process.cwd(), 'reviewed_structure_analysis.txt');
  const lines: string[] = [];
  
  lines.push('REVIEWED FILE STRUCTURE ANALYSIS');
  lines.push('='.repeat(60));
  lines.push(`\nTotal creators with corrections: ${withCorrections.length}\n`);
  
  lines.push('=== ALL CORRECTIONS ===\n');
  withCorrections.forEach((item, idx) => {
    lines.push(`${idx + 1}. @${item.username} (${item.creator_id})`);
    lines.push(`   Extracted: ${item.extracted.join(', ')}`);
    lines.push(`   Correct: ${item.corrections.join(', ')}`);
    lines.push(`   Bio: ${item.bio}`);
    lines.push('');
  });
  
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`\n✅ Analysis written to: ${reportPath}`);
}

main();

