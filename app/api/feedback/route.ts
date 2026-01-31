/**
 * Feedback API Route
 * 
 * GET /api/feedback
 * Fetches feedback items with filtering and pagination.
 * 
 * Query params:
 * - status: 'pending' | 'clustered' | 'resolved' | 'ignored'
 * - source: feedback source filter
 * - minSeverity: minimum severity score
 * - limit: number of items (default 50)
 * - skip: offset for pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { FeedbackItem } from '@/lib/db/models';

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

    const source = searchParams.get('source');
    if (source) {
      query.source = source;
    }

    const minSeverity = searchParams.get('minSeverity');
    if (minSeverity) {
      query.normalized_severity = { $gte: parseInt(minSeverity, 10) };
    }

    const feedbackType = searchParams.get('type');
    if (feedbackType) {
      query.feedback_type = feedbackType;
    }

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    // Execute query
    const [items, total] = await Promise.all([
      FeedbackItem.find(query)
        .sort({ normalized_severity: -1, created_at: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      FeedbackItem.countDocuments(query),
    ]);

    // Get stats
    const stats = await FeedbackItem.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          avgSeverity: { $avg: '$normalized_severity' },
          maxSeverity: { $max: '$normalized_severity' },
          byStatus: {
            $push: '$status',
          },
          bySource: {
            $push: '$source',
          },
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + items.length < total,
      },
      stats: stats[0] || {
        avgSeverity: 0,
        maxSeverity: 0,
      },
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
