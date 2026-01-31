
import { connectToDatabase } from '../lib/db/connection';
import { Cluster } from '../lib/db/models/cluster';
import { FeedbackItem } from '../lib/db/models/feedback-item';
import mongoose from 'mongoose';

// Env vars provided via shell execution

async function reset() {
    try {
        console.log('Connecting to DB...');
        await connectToDatabase();

        console.log('Deleting all clusters...');
        const deleteResult = await Cluster.deleteMany({});
        console.log(`Deleted ${deleteResult.deletedCount} clusters.`);

        console.log('Resetting feedback items to pending...');
        const updateResult = await FeedbackItem.updateMany({}, {
            $set: { status: 'pending', cluster_id: null }
        });
        console.log(`Updated ${updateResult.modifiedCount} feedback items.`);

        console.log('Reset complete!');
    } catch (error) {
        console.error('Error resetting DB:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

reset();
