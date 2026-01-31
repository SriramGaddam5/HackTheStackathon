/**
 * Clusters API Route
 * 
 * GET /api/clusters
 * Fetches clusters with filtering and pagination.
 * 
 * Query params:
 * - status: cluster status filter
 * - priority: priority filter
 * - minSeverity: minimum aggregate severity
 * - limit: number of items (default 20)
 * - skip: offset for pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Cluster, FeedbackItem } from '@/lib/db/models';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    
    // Build query
    const query: Record<string, unknown> = {};
    
    const status = searchParams.get('status');
    if (status) {
      query.status = status;
    }

    const priority = searchParams.get('priority');
    if (priority) {
      query.priority = priority;
    }

    const minSeverity = searchParams.get('minSeverity');
    if (minSeverity) {
      query.aggregate_severity = { $gte: parseInt(minSeverity, 10) };
    }

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    // Execute query
    const [clusters, total] = await Promise.all([
      Cluster.find(query)
        .sort({ aggregate_severity: -1, 'metrics.total_items': -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Cluster.countDocuments(query),
    ]);

    // Get summary stats
    const stats = await Cluster.aggregate([
      {
        $group: {
          _id: null,
          totalClusters: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
          avgSeverity: { $avg: '$aggregate_severity' },
          totalFeedbackItems: { $sum: '$metrics.total_items' },
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      clusters,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + clusters.length < total,
      },
      stats: stats[0] || {
        totalClusters: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        avgSeverity: 0,
        totalFeedbackItems: 0,
      },
    });

  } catch (error) {
    console.error('Clusters API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
