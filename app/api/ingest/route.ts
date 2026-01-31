/**
 * Ingest API Route
 * 
 * POST /api/ingest
 * Accepts URLs, text, or file uploads and ingests them into the feedback database.
 * 
 * Request body:
 * - url: string (for web scraping)
 * - text: string (for direct text input)
 * - crawl: boolean (for multi-page crawling)
 * - maxPages: number (limit for crawling)
 * - source: string (override source detection)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeedbackIngestor, type IngestOptions } from '@/lib/ingest';
import { getInsightEngine } from '@/lib/intelligence';
import { z } from 'zod';

// ===========================================================================
// REQUEST VALIDATION
// ===========================================================================

const IngestRequestSchema = z.object({
  url: z.string().url().optional(),
  text: z.string().min(10).max(50000).optional(),
  crawl: z.boolean().optional().default(false),
  maxPages: z.number().min(1).max(100).optional().default(10),
  source: z.enum(['app_store', 'product_hunt', 'reddit', 'quora', 'stack_overflow', 'manual_upload', 'custom']).optional(),
  skipDuplicates: z.boolean().optional().default(true),
  autoAnalyze: z.boolean().optional().default(false),
}).refine(data => data.url || data.text, {
  message: 'Either url or text is required',
});

type IngestRequest = z.infer<typeof IngestRequestSchema>;

// ===========================================================================
// ROUTE HANDLER
// ===========================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = IngestRequestSchema.safeParse(body);

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

    const data: IngestRequest = validationResult.data;
    
    // Build ingest options
    const options: IngestOptions = {
      skipDuplicates: data.skipDuplicates,
    };

    if (data.url) {
      options.url = data.url;
      options.crawl = data.crawl;
      options.maxPages = data.maxPages;
    }

    if (data.text) {
      options.text = data.text;
      options.textSource = 'api-input';
    }

    if (data.source) {
      options.forceSource = data.source;
    }

    // Perform ingestion
    const ingestor = getFeedbackIngestor();
    const result = await ingestor.ingest(options);

    // Optionally auto-run analysis to create clusters
    let analysis:
      | {
          attempted: true;
          success: boolean;
          items_classified?: number;
          clusters_created?: number;
          alerts_sent?: number;
          error?: string;
        }
      | { attempted: false } = { attempted: false };

    if (data.autoAnalyze && result.itemsSaved > 0) {
      try {
        const engine = getInsightEngine();
        const analysisResult = await engine.analyze({
          batchSize: Math.max(result.itemsSaved, 20),
          skipAlerts: true,
        });

        analysis = {
          attempted: true,
          success: analysisResult.success,
          items_classified: analysisResult.itemsClassified,
          clusters_created: analysisResult.clustersCreated,
          alerts_sent: analysisResult.alertsSent,
          error: analysisResult.success ? undefined : analysisResult.errors.join('; '),
        };
      } catch (analysisError) {
        analysis = {
          attempted: true,
          success: false,
          error: analysisError instanceof Error ? analysisError.message : 'Analysis failed',
        };
      }
    }

    // Return result
    return NextResponse.json({
      success: result.success,
      strategy: result.strategy,
      source: result.source,
      items: {
        processed: result.itemsProcessed,
        saved: result.itemsSaved,
        skipped: result.itemsSkipped,
      },
      errors: result.errors,
      analysis,
      saved_items: result.savedItems.map(item => ({
        id: item._id,
        source: item.source,
        severity: item.normalized_severity,
        preview: item.content_preview,
      })),
    }, { status: result.success ? 200 : 500 });

  } catch (error) {
    console.error('Ingest API error:', error);
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
// GET - Health check and usage info
// ===========================================================================

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ingest',
    methods: ['POST'],
    description: 'Ingest feedback from URLs or text',
    usage: {
      url_scrape: {
        method: 'POST',
        body: {
          url: 'https://example.com/reviews',
          crawl: false,
          skipDuplicates: true,
        },
      },
      url_crawl: {
        method: 'POST',
        body: {
          url: 'https://example.com/reviews',
          crawl: true,
          maxPages: 10,
        },
      },
      text_input: {
        method: 'POST',
        body: {
          text: 'User feedback text here...',
          source: 'manual_upload',
        },
      },
    },
    supported_sources: [
      'app_store (apps.apple.com)',
      'product_hunt (producthunt.com)',
      'reddit (reddit.com)',
      'quora (quora.com)',
      'stack_overflow (stackoverflow.com)',
      'custom (any other URL)',
    ],
  });
}
