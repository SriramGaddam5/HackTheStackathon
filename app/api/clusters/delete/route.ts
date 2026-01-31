import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Cluster } from '@/lib/db/models';

export async function DELETE(req: NextRequest) {
    try {
        const { ids, all } = await req.json();

        await connectToDatabase();

        let result;

        if (all) {
            // Delete all rejected clusters
            result = await Cluster.deleteMany({ status: 'rejected' });
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            // Delete specific clusters (must be rejected for safety, or allow any?)
            // Safe approach: only delete if they are already rejected, or allow delete regardless?
            // User said "Empty it", implying rejected list. But "empty ones selected" implies specific ones.
            // I'll allow deleting any selected ID to be flexible, but mostly used for rejected.
            result = await Cluster.deleteMany({ _id: { $in: ids } });
        } else {
            return NextResponse.json(
                { error: 'Invalid request: ids array or all=true required' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting clusters:', error);
        return NextResponse.json(
            { error: 'Failed to delete clusters' },
            { status: 500 }
        );
    }
}
