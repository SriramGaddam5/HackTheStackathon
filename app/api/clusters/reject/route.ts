import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Cluster } from '@/lib/db/models';

export async function POST(req: NextRequest) {
    try {
        const { ids } = await req.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: ids array required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const result = await Cluster.updateMany(
            { _id: { $in: ids } },
            { $set: { status: 'rejected' } }
        );

        return NextResponse.json({
            success: true,
            modifiedCount: result.modifiedCount,
        });
    } catch (error) {
        console.error('Error rejecting clusters:', error);
        return NextResponse.json(
            { error: 'Failed to reject clusters' },
            { status: 500 }
        );
    }
}
