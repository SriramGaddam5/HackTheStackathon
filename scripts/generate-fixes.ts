#!/usr/bin/env tsx
/**
 * Generate Fixes Script
 * 
 * CLI script to generate code fixes for critical clusters.
 * Used by GitHub Actions and for manual runs.
 * 
 * Usage:
 *   npm run generate-fixes
 *   npx tsx scripts/generate-fixes.ts
 * 
 * Environment variables:
 *   CREATE_PRS - Set to 'true' to create GitHub PRs
 *   SEVERITY_THRESHOLD - Minimum severity to process (default: 80)
 */

import { getAgenticCoder } from '../lib/coder';
import { disconnectFromDatabase } from '../lib/db/connection';

async function main() {
  console.log('🔧 Starting fix generation...\n');

  const coder = getAgenticCoder();
  const createPRs = process.env.CREATE_PRS === 'true';
  const threshold = parseInt(process.env.SEVERITY_THRESHOLD || '80', 10);

  console.log(`Configuration:`);
  console.log(`  - Severity threshold: ${threshold}`);
  console.log(`  - Create PRs: ${createPRs}`);
  console.log('');

  try {
    const results = await coder.generateFixesForCriticalClusters({
      threshold,
      createPRs,
    });

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📊 Generation Results:');
    console.log('======================');
    console.log(`📦 Total clusters processed: ${results.length}`);
    console.log(`✅ Succeeded: ${succeeded.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (succeeded.length > 0) {
      console.log('\n✅ Successfully generated fixes:');
      succeeded.forEach((result, i) => {
        console.log(`  ${i + 1}. Cluster: ${result.cluster_id}`);
        if (result.markdown_file) {
          console.log(`     File: ${result.markdown_file}`);
        }
        if (result.pr_url) {
          console.log(`     PR: ${result.pr_url}`);
        }
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed generations:');
      failed.forEach((result, i) => {
        console.log(`  ${i + 1}. Cluster: ${result.cluster_id}`);
        console.log(`     Error: ${result.error}`);
      });
    }

    process.exit(failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fix generation failed:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

main();
