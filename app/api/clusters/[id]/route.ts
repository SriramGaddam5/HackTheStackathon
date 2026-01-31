/**
 * Single Cluster API Route
 * 
 * GET /api/clusters/[id]
 * Fetches a single cluster with its feedback items.
 * 
 * PATCH /api/clusters/[id]
 * Updates cluster status or other properties.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';
import { Cluster, FeedbackItem } from '@/lib/db/models';
import { z } from 'zod';

// ===========================================================================
// GET - Fetch single cluster
// ===========================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const cluster = await Cluster.findById(id).lean();

    if (!cluster) {
      return NextResponse.json(
        { success: false, error: 'Cluster not found' },
        { status: 404 }
      );
    }

    // Get associated feedback items
    const feedbackItems = await FeedbackItem.find({
      _id: { $in: cluster.feedback_items },
    })
      .sort({ normalized_severity: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      cluster,
      feedback_items: feedbackItems,
    });

  } catch (error) {
    console.error('Cluster GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// ===========================================================================
// PATCH - Update cluster
// ===========================================================================

const UpdateClusterSchema = z.object({
  status: z.enum(['active', 'reviewed', 'in_progress', 'resolved', 'wont_fix']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assigned_to: z.string().optional(),
  tags: z.array(z.string()).optional(),
  summary: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    root_cause: z.string().optional(),
    suggested_fix: z.string().optional(),
    affected_area: z.string().optional(),
  }).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const body = await request.json();
    const validationResult = UpdateClusterSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Build update object
    const updateObj: Record<string, unknown> = {};
    
    if (updates.status) updateObj.status = updates.status;
    if (updates.priority) updateObj.priority = updates.priority;
    if (updates.assigned_to) updateObj.assigned_to = updates.assigned_to;
    if (updates.tags) updateObj.tags = updates.tags;
    
    if (updates.summary) {
      Object.entries(updates.summary).forEach(([key, value]) => {
        if (value !== undefined) {
          updateObj[`summary.${key}`] = value;
        }
      });
    }

    const cluster = await Cluster.findByIdAndUpdate(
      id,
      { $set: updateObj },
      { new: true }
    ).lean();

    if (!cluster) {
      return NextResponse.json(
        { success: false, error: 'Cluster not found' },
        { status: 404 }
      );
    }

    // If resolved, update all feedback items
    if (updates.status === 'resolved') {
      await FeedbackItem.updateMany(
        { _id: { $in: cluster.feedback_items } },
        { $set: { status: 'resolved' } }
      );
    }

    return NextResponse.json({
      success: true,
      cluster,
    });

  } catch (error) {
    console.error('Cluster PATCH error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
