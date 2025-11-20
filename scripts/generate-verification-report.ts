#!/usr/bin/env tsx

/**
 * Master Verification Report Generator
 * Generates a comprehensive markdown report from verification data
 * 
 * Usage:
 *   npx tsx scripts/generate-verification-report.ts
 * 
 * Prerequisites:
 *   - Run verify-all-data.ts first to generate verification-report.json
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface TableVerification {
  table_name: string;
  target_count: number;
  schema_source_count: number;
  data_source_count: number;
  expected_total: number;
  difference: number;
  status: 'complete' | 'missing' | 'extra' | 'error' | 'not_in_target';
  target_exists: boolean;
  schema_source_exists: boolean;
  data_source_exists: boolean;
  issues: string[];
}

interface VerificationReport {
  summary: {
    total_tables: number;
    complete: number;
    missing_data: number;
    extra_data: number;
    errors: number;
    not_in_target: number;
  };
  tables: TableVerification[];
  generated_at: string;
}

function generateMarkdownReport(report: VerificationReport): string {
  const { summary, tables } = report;
  const generatedAt = new Date(report.generated_at).toLocaleString();

  let markdown = `# Database Verification Report\n\n`;
  markdown += `**Generated:** ${generatedAt}\n\n`;
  markdown += `---\n\n`;

  // Executive Summary
  markdown += `## Executive Summary\n\n`;
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Tables Verified | ${summary.total_tables} |\n`;
  markdown += `| ✅ Complete | ${summary.complete} |\n`;
  markdown += `| ⚠️ Missing Data | ${summary.missing_data} |\n`;
  markdown += `| ⚠️ Extra Data | ${summary.extra_data} |\n`;
  markdown += `| ❌ Errors | ${summary.errors} |\n`;
  markdown += `| ❌ Not in Target | ${summary.not_in_target} |\n\n`;

  const completionRate = ((summary.complete / summary.total_tables) * 100).toFixed(1);
  markdown += `**Completion Rate:** ${completionRate}%\n\n`;

  if (summary.complete === summary.total_tables) {
    markdown += `✅ **All tables are complete!**\n\n`;
  } else {
    markdown += `⚠️ **Action Required:** ${summary.missing_data + summary.not_in_target} tables need attention.\n\n`;
  }

  markdown += `---\n\n`;

  // Tables by Status
  const completeTables = tables.filter(t => t.status === 'complete');
  const missingTables = tables.filter(t => t.status === 'missing');
  const extraTables = tables.filter(t => t.status === 'extra');
  const errorTables = tables.filter(t => t.status === 'error');
  const notInTargetTables = tables.filter(t => t.status === 'not_in_target');

  // Complete Tables
  if (completeTables.length > 0) {
    markdown += `## ✅ Complete Tables (${completeTables.length})\n\n`;
    markdown += `| Table Name | Target | Schema Source | Data Source | Expected | Status |\n`;
    markdown += `|------------|--------|--------------|-------------|----------|--------|\n`;
    completeTables.forEach(table => {
      markdown += `| \`${table.table_name}\` | ${table.target_count} | ${table.schema_source_count} | ${table.data_source_count} | ${table.expected_total} | ✅ |\n`;
    });
    markdown += `\n`;
  }

  // Missing Data Tables
  if (missingTables.length > 0) {
    markdown += `## ⚠️ Tables with Missing Data (${missingTables.length})\n\n`;
    markdown += `| Table Name | Target | Expected | Missing | Issues |\n`;
    markdown += `|------------|--------|----------|--------|--------|\n`;
    missingTables.forEach(table => {
      const missingCount = Math.abs(table.difference);
      markdown += `| \`${table.table_name}\` | ${table.target_count} | ${table.expected_total} | ${missingCount} | ${table.issues.length > 0 ? table.issues[0] : 'N/A'} |\n`;
    });
    markdown += `\n`;

    markdown += `### Details\n\n`;
    missingTables.forEach(table => {
      markdown += `#### \`${table.table_name}\`\n\n`;
      markdown += `- **Target Count:** ${table.target_count}\n`;
      markdown += `- **Schema Source Count:** ${table.schema_source_count}\n`;
      markdown += `- **Data Source Count:** ${table.data_source_count}\n`;
      markdown += `- **Expected Total:** ${table.expected_total}\n`;
      markdown += `- **Missing:** ${Math.abs(table.difference)} rows\n\n`;
      if (table.issues.length > 0) {
        markdown += `**Issues:**\n`;
        table.issues.forEach(issue => {
          markdown += `- ${issue}\n`;
        });
        markdown += `\n`;
      }
    });
    markdown += `\n`;
  }

  // Extra Data Tables
  if (extraTables.length > 0) {
    markdown += `## ⚠️ Tables with Extra Data (${extraTables.length})\n\n`;
    markdown += `| Table Name | Target | Expected | Extra |\n`;
    markdown += `|------------|--------|----------|-------|\n`;
    extraTables.forEach(table => {
      markdown += `| \`${table.table_name}\` | ${table.target_count} | ${table.expected_total} | ${table.difference} |\n`;
    });
    markdown += `\n`;
  }

  // Error Tables
  if (errorTables.length > 0) {
    markdown += `## ❌ Tables with Errors (${errorTables.length})\n\n`;
    markdown += `| Table Name | Issues |\n`;
    markdown += `|------------|--------|\n`;
    errorTables.forEach(table => {
      const issuesPreview = table.issues.length > 0 ? table.issues[0].substring(0, 100) : 'Unknown error';
      markdown += `| \`${table.table_name}\` | ${issuesPreview} |\n`;
    });
    markdown += `\n`;

    markdown += `### Details\n\n`;
    errorTables.forEach(table => {
      markdown += `#### \`${table.table_name}\`\n\n`;
      if (table.issues.length > 0) {
        table.issues.forEach(issue => {
          markdown += `- ${issue}\n`;
        });
        markdown += `\n`;
      }
    });
    markdown += `\n`;
  }

  // Not in Target Tables
  if (notInTargetTables.length > 0) {
    markdown += `## ❌ Tables Not in Target (${notInTargetTables.length})\n\n`;
    markdown += `| Table Name | Schema Source | Data Source | Action Required |\n`;
    markdown += `|------------|---------------|-------------|-----------------|\n`;
    notInTargetTables.forEach(table => {
      const hasData = table.schema_source_count > 0 || table.data_source_count > 0;
      markdown += `| \`${table.table_name}\` | ${table.schema_source_count} | ${table.data_source_count} | ${hasData ? 'Migrate data' : 'Create table'} |\n`;
    });
    markdown += `\n`;
  }

  // Recommendations
  markdown += `---\n\n`;
  markdown += `## Recommendations\n\n`;

  if (missingTables.length > 0 || notInTargetTables.length > 0) {
    markdown += `### Immediate Actions\n\n`;
    markdown += `1. **Run migration script:** Execute \`npx tsx scripts/migrate-missing-data.ts\` to migrate missing data\n`;
    if (notInTargetTables.length > 0) {
      markdown += `2. **Create missing tables:** Ensure all required tables exist in target database\n`;
    }
    markdown += `3. **Re-run verification:** After migration, run \`npx tsx scripts/verify-all-data.ts\` again\n\n`;
  }

  if (extraTables.length > 0) {
    markdown += `### Data Quality\n\n`;
    markdown += `- Review tables with extra data to ensure data integrity\n`;
    markdown += `- Verify that extra rows are not duplicates\n\n`;
  }

  if (errorTables.length > 0) {
    markdown += `### Error Resolution\n\n`;
    markdown += `- Investigate tables with errors\n`;
    markdown += `- Check database connectivity and permissions\n`;
    markdown += `- Review table schemas for compatibility issues\n\n`;
  }

  // Table Categories Breakdown
  markdown += `---\n\n`;
  markdown += `## Table Categories Breakdown\n\n`;

  const knownTableLists = {
    'Core Hot Tables': ['creators_hot', 'videos_hot', 'sounds_hot', 'hashtags_hot'],
    'Core Cold Tables': ['creators_cold', 'creator_profiles_cold', 'videos_cold', 'sounds_cold', 'hashtags_cold'],
    'Fact/Relationship Tables': ['video_sound_facts', 'video_hashtag_facts', 'creator_video_facts', 'raw_refs', 'video_creator_mentions'],
    'Communities Tables': ['communities', 'community_video_memberships', 'community_creator_memberships', 'community_hashtag_memberships'],
    'Time Series Tables': ['video_metrics_timeseries', 'creator_metrics_timeseries', 'sound_metrics_timeseries', 'hashtag_metrics_timeseries', 'video_play_count_history'],
  };

  const allKnownTables = new Set(
    Object.values(knownTableLists).flat()
  );

  const otherTables = tables
    .filter(t => !allKnownTables.has(t.table_name))
    .map(t => t.table_name);

  const categories = {
    ...knownTableLists,
    'Other Tables': otherTables,
  };

  Object.entries(categories).forEach(([category, tableNames]) => {
    if (tableNames.length === 0) return;
    
    markdown += `### ${category}\n\n`;
    markdown += `| Table Name | Status | Target | Expected |\n`;
    markdown += `|------------|--------|--------|----------|\n`;
    
    tableNames.forEach(tableName => {
      const table = tables.find(t => t.table_name === tableName);
      if (!table) return;
      
      const statusIcon = table.status === 'complete' ? '✅' : 
                        table.status === 'missing' ? '⚠️' : 
                        table.status === 'error' ? '❌' : '❓';
      markdown += `| \`${tableName}\` | ${statusIcon} ${table.status} | ${table.target_count} | ${table.expected_total} |\n`;
    });
    markdown += `\n`;
  });

  // Next Steps
  markdown += `---\n\n`;
  markdown += `## Next Steps\n\n`;
  markdown += `1. Review this report for any issues\n`;
  if (missingTables.length > 0 || notInTargetTables.length > 0) {
    markdown += `2. Run \`npx tsx scripts/migrate-missing-data.ts\` to fill gaps\n`;
  }
  markdown += `3. Run \`npx tsx scripts/migrate-communities-data.ts\` for communities-specific data\n`;
  markdown += `4. Re-run verification: \`npx tsx scripts/verify-all-data.ts\`\n`;
  markdown += `5. Verify foreign key integrity\n`;
  markdown += `6. Run aggregation functions if needed\n`;
  markdown += `7. Test application with migrated data\n\n`;

  markdown += `---\n\n`;
  markdown += `*Report generated by database verification system*\n`;

  return markdown;
}

async function generateVerificationReport() {
  console.log('📊 Generating Verification Report');
  console.log('==================================\n');

  const reportPath = resolve(process.cwd(), 'verification-report.json');
  if (!existsSync(reportPath)) {
    console.error('❌ verification-report.json not found.');
    console.error('   Please run verify-all-data.ts first to generate verification data.');
    process.exit(1);
  }

  const report: VerificationReport = JSON.parse(readFileSync(reportPath, 'utf-8'));

  console.log(`📋 Loaded verification data for ${report.tables.length} tables\n`);

  const markdown = generateMarkdownReport(report);

  const outputPath = resolve(process.cwd(), 'DATABASE_VERIFICATION_REPORT.md');
  writeFileSync(outputPath, markdown);

  console.log(`✅ Report generated: ${outputPath}\n`);

  // Print summary
  const { summary } = report;
  console.log('📊 Summary:');
  console.log(`   Total Tables: ${summary.total_tables}`);
  console.log(`   ✅ Complete: ${summary.complete}`);
  console.log(`   ⚠️  Missing Data: ${summary.missing_data}`);
  console.log(`   ⚠️  Extra Data: ${summary.extra_data}`);
  console.log(`   ❌ Errors: ${summary.errors}`);
  console.log(`   ❌ Not in Target: ${summary.not_in_target}`);

  const completionRate = ((summary.complete / summary.total_tables) * 100).toFixed(1);
  console.log(`\n   Completion Rate: ${completionRate}%\n`);

  if (summary.complete === summary.total_tables) {
    console.log('✅ All tables are complete!');
  } else {
    console.log('⚠️  Action required - see report for details');
  }
}

generateVerificationReport().catch(console.error);

