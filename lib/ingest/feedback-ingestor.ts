/**
 * Feedback Ingestor
 * 
 * Central orchestrator for ingesting feedback from multiple sources.
 * Uses strategy pattern to handle different input types:
 * - URL scraping (via Firecrawl)
 * - Document parsing (via Reducto)
 * - Direct text input
 */

import { connectToDatabase } from '@/lib/db/connection';
import { FeedbackItem, type IFeedbackItem, type FeedbackSource } from '@/lib/db/models/feedback-item';
import { FirecrawlClient, getFirecrawlClient, detectSource, type ScrapedFeedback } from './firecrawl-client';
import { ReductoClient, getReductoClient, type ParsedDocument } from './reducto-client';
import { normalizeSeverity } from '@/lib/utils/normalize-severity';

// ===========================================================================
// TYPES
// ===========================================================================

export type IngestStrategy = 'url' | 'file' | 'text';

export interface IngestOptions {
  // For URL strategy
  url?: string;
  crawl?: boolean;  // If true, crawl multiple pages
  maxPages?: number;

  // For file strategy
  file?: File | Buffer;
  fileName?: string;

  // For text strategy
  text?: string;
  textSource?: string;  // Label for the text source

  // Common options
  forceSource?: FeedbackSource;  // Override auto-detected source
  skipDuplicates?: boolean;      // Check for existing content
}

export interface IngestResult {
  success: boolean;
  strategy: IngestStrategy;
  source: FeedbackSource;
  itemsProcessed: number;
  itemsSaved: number;
  itemsSkipped: number;
  errors: string[];
  savedItems: IFeedbackItem[];
}

// ===========================================================================
// FEEDBACK INGESTOR
// ===========================================================================

export class FeedbackIngestor {
  private firecrawl: FirecrawlClient;
  private reducto: ReductoClient;

  constructor(options?: { firecrawlKey?: string; reductoKey?: string }) {
    this.firecrawl = options?.firecrawlKey
      ? new FirecrawlClient(options.firecrawlKey)
      : getFirecrawlClient();
    this.reducto = options?.reductoKey
      ? new ReductoClient(options.reductoKey)
      : getReductoClient();
  }

  /**
   * Main ingestion method - automatically determines strategy
   */
  async ingest(options: IngestOptions): Promise<IngestResult> {
    // Determine strategy
    const strategy = this.determineStrategy(options);

    switch (strategy) {
      case 'url':
        return this.ingestFromUrl(options);
      case 'file':
        return this.ingestFromFile(options);
      case 'text':
        return this.ingestFromText(options);
      default:
        return {
          success: false,
          strategy: 'url',
          source: 'custom',
          itemsProcessed: 0,
          itemsSaved: 0,
          itemsSkipped: 0,
          errors: ['Could not determine ingestion strategy'],
          savedItems: [],
        };
    }
  }

  /**
   * Determine ingestion strategy from options
   */
  private determineStrategy(options: IngestOptions): IngestStrategy {
    if (options.url) return 'url';
    if (options.file) return 'file';
    if (options.text) return 'text';
    throw new Error('No valid input provided. Specify url, file, or text.');
  }

  // ---------------------------------------------------------------------------
  // URL STRATEGY (Firecrawl)
  // ---------------------------------------------------------------------------

  private async ingestFromUrl(options: IngestOptions): Promise<IngestResult> {
    const { url, crawl = false, maxPages = 10, forceSource, skipDuplicates = true } = options;

    if (!url) {
      return this.errorResult('url', 'custom', 'URL is required');
    }

    const source = forceSource || detectSource(url);
    const errors: string[] = [];

    try {
      // Scrape or crawl the URL
      const scrapeResult = crawl
        ? await this.firecrawl.crawl(url, { maxPages })
        : await this.firecrawl.scrape(url);

      if (!scrapeResult.success) {
        return this.errorResult('url', source, scrapeResult.error || 'Scrape failed');
      }

      // Process and save items
      const { saved, skipped, savedItems } = await this.processAndSave(
        scrapeResult.items,
        skipDuplicates
      );

      return {
        success: true,
        strategy: 'url',
        source,
        itemsProcessed: scrapeResult.items.length,
        itemsSaved: saved,
        itemsSkipped: skipped,
        errors,
        savedItems,
      };
    } catch (error) {
      return this.errorResult('url', source, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ---------------------------------------------------------------------------
  // FILE STRATEGY (Reducto)
  // ---------------------------------------------------------------------------

  private async ingestFromFile(options: IngestOptions): Promise<IngestResult> {
    const { file, fileName = 'uploaded-document', skipDuplicates = true } = options;

    if (!file) {
      return this.errorResult('file', 'manual_upload', 'File is required');
    }

    try {
      const parseResult = await this.reducto.parseFile(file, { fileName });

      if (!parseResult.success) {
        return this.errorResult('file', 'manual_upload', parseResult.error || 'Parse failed');
      }

      // Process and save items
      const { saved, skipped, savedItems } = await this.processAndSave(
        parseResult.items,
        skipDuplicates
      );

      return {
        success: true,
        strategy: 'file',
        source: 'manual_upload',
        itemsProcessed: parseResult.items.length,
        itemsSaved: saved,
        itemsSkipped: skipped,
        errors: [],
        savedItems,
      };
    } catch (error) {
      return this.errorResult('file', 'manual_upload', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ---------------------------------------------------------------------------
  // TEXT STRATEGY (Direct input)
  // ---------------------------------------------------------------------------

  private async ingestFromText(options: IngestOptions): Promise<IngestResult> {
    const { text, textSource = 'direct-input', skipDuplicates = true } = options;

    if (!text || text.trim().length < 10) {
      return this.errorResult('text', 'manual_upload', 'Text input is too short');
    }

    try {
      const parseResult = this.reducto.parseText(text, { fileName: textSource });

      if (!parseResult.success) {
        return this.errorResult('text', 'manual_upload', parseResult.error || 'Parse failed');
      }

      // Process and save items
      const { saved, skipped, savedItems } = await this.processAndSave(
        parseResult.items,
        skipDuplicates
      );

      return {
        success: true,
        strategy: 'text',
        source: 'manual_upload',
        itemsProcessed: parseResult.items.length,
        itemsSaved: saved,
        itemsSkipped: skipped,
        errors: [],
        savedItems,
      };
    } catch (error) {
      return this.errorResult('text', 'manual_upload', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ---------------------------------------------------------------------------
  // COMMON PROCESSING
  // ---------------------------------------------------------------------------

  /**
   * Process raw feedback items and save to database
   */
  private async processAndSave(
    items: (ScrapedFeedback | ParsedDocument)[],
    skipDuplicates: boolean
  ): Promise<{ saved: number; skipped: number; savedItems: IFeedbackItem[] }> {
    await connectToDatabase();

    let saved = 0;
    let skipped = 0;
    const savedItems: IFeedbackItem[] = [];

    for (const item of items) {
      try {
        // Check for duplicates if enabled
        if (skipDuplicates) {
          const contentHash = this.hashContent(item.content);
          const existing = await FeedbackItem.findOne({
            content_preview: item.content.substring(0, 200),
          });

          if (existing) {
            skipped++;
            continue;
          }
        }

        // Calculate normalized severity
        const severity = normalizeSeverity(item.source, item.meta, {
          postedAt: item.meta.posted_at,
          content: item.content,
        });

        // Create and save the feedback item
        const feedbackItem = new FeedbackItem({
          source: item.source,
          source_url: item.meta.post_url,
          content: item.content,
          content_preview: item.content.substring(0, 200) + (item.content.length > 200 ? '...' : ''),
          meta: item.meta,
          normalized_severity: severity,
          status: 'pending',
          feedback_type: 'unknown', // Will be classified by Insight Engine
          keywords: this.extractKeywords(item.content),
        });

        await feedbackItem.save();
        savedItems.push(feedbackItem);
        saved++;
      } catch (error) {
        console.error('Error saving feedback item:', error);
        // Continue processing other items
      }
    }

    return { saved, skipped, savedItems };
  }

  /**
   * Extract keywords from content (simple implementation)
   */
  private extractKeywords(content: string): string[] {
    // Common words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
      'because', 'until', 'while', 'this', 'that', 'these', 'those', 'it', 'its',
    ]);

    // Extract words, filter, and count
    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    // Count word frequency
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    // Return top keywords
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Simple content hash for deduplication
   */
  private hashContent(content: string): string {
    // Simple hash - in production, use proper hashing
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  /**
   * Create error result
   */
  private errorResult(strategy: IngestStrategy, source: FeedbackSource, error: string): IngestResult {
    return {
      success: false,
      strategy,
      source,
      itemsProcessed: 0,
      itemsSaved: 0,
      itemsSkipped: 0,
      errors: [error],
      savedItems: [],
    };
  }
}

// ===========================================================================
// SINGLETON EXPORT
// ===========================================================================

let ingestorInstance: FeedbackIngestor | null = null;

export function getFeedbackIngestor(): FeedbackIngestor {
  if (!ingestorInstance) {
    ingestorInstance = new FeedbackIngestor();
  }
  return ingestorInstance;
}
