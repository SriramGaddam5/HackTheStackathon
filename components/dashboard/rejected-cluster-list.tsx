import { connectToDatabase } from '@/lib/db/connection';
import { Cluster } from '@/lib/db/models';
import { RejectedClusterListClient } from './rejected-cluster-list-client';

async function getRejectedClusters() {
    try {
        await connectToDatabase();

        const clusters = await Cluster.find({
            status: 'rejected',
        })
            .sort({ updated_at: -1 })
            .lean();

        return clusters;
    } catch (error) {
        console.error('Error fetching rejected clusters:', error);
        return [];
    }
}

export async function RejectedClusterList() {
    const clusters = await getRejectedClusters();

    return <RejectedClusterListClient clusters={JSON.parse(JSON.stringify(clusters))} />;
}
