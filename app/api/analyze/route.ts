/**
 * Analyze API Route
 * 
 * POST /api/analyze
 * Triggers the Insight Engine to analyze pending feedback.
 * Classifies feedback, creates clusters, and sends alerts.
 * 
 * Request body:
 * - batchSize: number (how many items to process)
 * - skipAlerts: boolean (skip sending email alerts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInsightEngine } from '@/lib/intelligence';
import { z } from 'zod';

// ===========================================================================
// REQUEST VALIDATION
// ===========================================================================

const AnalyzeRequestSchema = z.object({
  batchSize: z.number().min(1).max(200).optional().default(50),
  skipAlerts: z.boolean().optional().default(false),
});

// ===========================================================================
// ROUTE HANDLER
// ===========================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validationResult = AnalyzeRequestSchema.safeParse(body);

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

    const { batchSize, skipAlerts } = validationResult.data;

    // Run analysis
    const engine = getInsightEngine();
    const result = await engine.analyze({ batchSize, skipAlerts });

    return NextResponse.json({
      success: result.success,
      items_classified: result.itemsClassified,
      clusters_created: result.clustersCreated,
      alerts_sent: result.alertsSent,
      errors: result.errors,
    }, { status: result.success ? 200 : 500 });

  } catch (error) {
    console.error('Analyze API error:', error);
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
// GET - Trigger analysis with defaults
// ===========================================================================

export async function GET() {
  try {
    const engine = getInsightEngine();
    const result = await engine.analyze({ batchSize: 50 });

    return NextResponse.json({
      success: result.success,
      items_classified: result.itemsClassified,
      clusters_created: result.clustersCreated,
      alerts_sent: result.alertsSent,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
