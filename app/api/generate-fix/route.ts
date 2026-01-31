/**
 * Generate Fix API Route
 * 
 * POST /api/generate-fix
 * Generates code fixes for a specific cluster or all critical clusters.
 * 
 * Request body:
 * - clusterId: string (specific cluster to fix)
 * - createPR: boolean (create GitHub PR)
 * - threshold: number (severity threshold for batch processing)
 * - all: boolean (process all critical clusters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgenticCoder } from '@/lib/coder';
import { z } from 'zod';

// ===========================================================================
// REQUEST VALIDATION
// ===========================================================================

const GenerateFixRequestSchema = z.object({
  clusterId: z.string().optional(),
  createPR: z.boolean().optional().default(false),
  threshold: z.number().min(0).max(100).optional().default(80),
  all: z.boolean().optional().default(false),
  codebaseContext: z.string().max(10000).optional(),
});

// ===========================================================================
// ROUTE HANDLER
// ===========================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validationResult = GenerateFixRequestSchema.safeParse(body);

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

    const { clusterId, createPR, threshold, all, codebaseContext } = validationResult.data;

    if (!clusterId && !all) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Either clusterId or all=true is required' 
        },
        { status: 400 }
      );
    }

    const coder = getAgenticCoder();

    // Process single cluster or all critical clusters
    if (clusterId) {
      const result = await coder.generateFix(clusterId, { 
        createPR, 
        codebaseContext 
      });

      return NextResponse.json({
        success: result.success,
        cluster_id: result.cluster_id,
        fix_plan: result.fix_plan ? {
          summary: result.fix_plan.summary,
          files_to_modify: result.fix_plan.files_to_modify.length,
          files_to_create: result.fix_plan.files_to_create.length,
          estimated_impact: result.fix_plan.estimated_impact,
        } : null,
        markdown_file: result.markdown_file,
        pr_url: result.pr_url,
        error: result.error,
      }, { status: result.success ? 200 : 500 });
    }

    // Process all critical clusters
    const results = await coder.generateFixesForCriticalClusters({
      threshold,
      createPRs: createPR,
    });

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      total_processed: results.length,
      succeeded: successCount,
      failed: failCount,
      results: results.map(r => ({
        cluster_id: r.cluster_id,
        success: r.success,
        pr_url: r.pr_url,
        error: r.error,
      })),
    });

  } catch (error) {
    console.error('Generate Fix API error:', error);
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
// GET - Usage info
// ===========================================================================

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate-fix',
    methods: ['POST'],
    description: 'Generate code fixes for feedback clusters',
    usage: {
      single_cluster: {
        method: 'POST',
        body: {
          clusterId: 'cluster-id-here',
          createPR: false,
          codebaseContext: '// optional relevant code snippets',
        },
      },
      all_critical: {
        method: 'POST',
        body: {
          all: true,
          threshold: 80,
          createPR: false,
        },
      },
      with_github_pr: {
        method: 'POST',
        body: {
          clusterId: 'cluster-id-here',
          createPR: true,
        },
        note: 'Requires GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO env vars',
      },
    },
  });
}
