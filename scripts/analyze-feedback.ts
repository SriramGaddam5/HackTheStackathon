#!/usr/bin/env tsx
/**
 * Analyze Feedback Script
 * 
 * CLI script to run the Insight Engine analysis.
 * Used by GitHub Actions and for manual runs.
 * 
 * Usage:
 *   npm run analyze
 *   npx tsx scripts/analyze-feedback.ts
 */

import { getInsightEngine } from '../lib/intelligence';
import { disconnectFromDatabase } from '../lib/db/connection';

async function main() {
  console.log('🔍 Starting feedback analysis...\n');

  const engine = getInsightEngine();
  
  try {
    const result = await engine.analyze({
      batchSize: 100,
      skipAlerts: false,
    });

    console.log('\n📊 Analysis Results:');
    console.log('====================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Items classified: ${result.itemsClassified}`);
    console.log(`📦 Clusters created/updated: ${result.clustersCreated}`);
    console.log(`📧 Alerts sent: ${result.alertsSent}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }

    // Update trends
    console.log('\n📈 Updating cluster trends...');
    await engine.updateTrends();
    console.log('✅ Trends updated');

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

main();
