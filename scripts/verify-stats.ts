
import { connectToDatabase } from '@/lib/db/connection';
import { FeedbackItem } from '@/lib/db/models/feedback-item';
import { Cluster } from '@/lib/db/models/cluster';

async function verifyStats() {
    await connectToDatabase();

    const totalFeedback = await FeedbackItem.countDocuments();

    // STATS CARD LOGIC MATCHING:
    // Dashboard counts ALL clusters
    const clusters = await Cluster.countDocuments();

    // Dashboard counts Critical where priority='critical' and status!='resolved'
    const criticalClusters = await Cluster.countDocuments({
        priority: 'critical',
        status: { $ne: 'resolved' }
    });

    const allItems = await FeedbackItem.find({}, { normalized_severity: 1 });
    const totalSeverity = allItems.reduce((sum, item) => sum + item.normalized_severity, 0);
    const avgSeverity = allItems.length > 0 ? Math.round(totalSeverity / allItems.length) : 0;

    console.log('--- DB STATS VERIFICATION ---');
    console.log(`Total Feedback Items: ${totalFeedback}`);
    console.log(`Total Clusters (Dashboard metric): ${clusters}`);
    console.log(`Critical Clusters: ${criticalClusters}`);
    console.log(`Average Severity: ${avgSeverity}`);

    // Breakdown for debugging
    const activeClusters = await Cluster.countDocuments({ status: { $in: ['active', 'reviewed'] } });
    console.log(`(Active/Reviewed Clusters only: ${activeClusters})`);
    console.log('-----------------------------');

    process.exit(0);
}

verifyStats().catch(console.error);
