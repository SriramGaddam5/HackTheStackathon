/**
 * Firecrawl Client
 * 
 * Wrapper around the Firecrawl SDK for scraping dynamic web pages.
 * Handles different source types (App Store, Product Hunt, Reddit, etc.)
 * and extracts structured data from each.
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import type { FeedbackSource, FeedbackMeta } from '@/lib/db/models/feedback-item';

// ===========================================================================
// TYPES
// ===========================================================================

export interface ScrapedFeedback {
  source: FeedbackSource;
  content: string;
  meta: FeedbackMeta;
}

export interface ScrapeResult {
  success: boolean;
  items: ScrapedFeedback[];
  error?: string;
  rawData?: unknown;
}

// ===========================================================================
// URL PATTERN MATCHERS
// ===========================================================================

const URL_PATTERNS = {
  APP_STORE: /apps\.apple\.com\/.*\/app\//,
  PRODUCT_HUNT: /producthunt\.com\/(posts|products)\//,
  REDDIT: /reddit\.com\/r\/[\w]+\/(comments\/)?/,
  QUORA: /quora\.com\/(.*\/answer|profile|topic)\//,
  STACK_OVERFLOW: /stackoverflow\.com\/questions\//,
};

/**
 * Detect source type from URL
 */
export function detectSource(url: string): FeedbackSource {
  if (URL_PATTERNS.APP_STORE.test(url)) return 'app_store';
  if (URL_PATTERNS.PRODUCT_HUNT.test(url)) return 'product_hunt';
  if (URL_PATTERNS.REDDIT.test(url)) return 'reddit';
  if (URL_PATTERNS.QUORA.test(url)) return 'quora';
  if (URL_PATTERNS.STACK_OVERFLOW.test(url)) return 'stack_overflow';
  return 'custom';
}

// ===========================================================================
// FIRECRAWL CLIENT
// ===========================================================================

export class FirecrawlClient {
  private client: FirecrawlApp;
  
  constructor(apiKey?: string) {
    const key = apiKey || process.env.FIRECRAWL_API_KEY;
    if (!key) {
      throw new Error('FIRECRAWL_API_KEY is required');
    }
    this.client = new FirecrawlApp({ apiKey: key });
  }

  /**
   * Scrape a URL and extract feedback items
   */
  async scrape(url: string): Promise<ScrapeResult> {
    const source = detectSource(url);
    
    try {
      // Use Firecrawl to scrape the page
      const response = await this.client.scrapeUrl(url, {
        formats: ['markdown', 'html'],
        waitFor: 2000, // Wait for dynamic content
      });

      if (!response.success) {
        return {
          success: false,
          items: [],
          error: 'Failed to scrape URL',
        };
      }

      // Parse based on source type
      const items = await this.parseContent(source, url, response);
      
      return {
        success: true,
        items,
        rawData: response,
      };
    } catch (error) {
      console.error('Firecrawl scrape error:', error);
      return {
        success: false,
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Crawl multiple pages from a starting URL
   */
  async crawl(startUrl: string, options: {
    maxPages?: number;
    allowedDomains?: string[];
  } = {}): Promise<ScrapeResult> {
    const source = detectSource(startUrl);
    
    try {
      const response = await this.client.crawlUrl(startUrl, {
        limit: options.maxPages || 10,
        scrapeOptions: {
          formats: ['markdown'],
        },
      });

      if (!response.success) {
        return {
          success: false,
          items: [],
          error: 'Failed to crawl URL',
        };
      }

      // Parse all crawled pages
      const allItems: ScrapedFeedback[] = [];
      
      for (const page of response.data || []) {
        const pageItems = await this.parseContent(source, page.metadata?.sourceURL || startUrl, {
          markdown: page.markdown,
          html: page.html,
          metadata: page.metadata,
        });
        allItems.push(...pageItems);
      }

      return {
        success: true,
        items: allItems,
        rawData: response,
      };
    } catch (error) {
      console.error('Firecrawl crawl error:', error);
      return {
        success: false,
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse scraped content based on source type
   */
  private async parseContent(
    source: FeedbackSource,
    url: string,
    response: { markdown?: string; html?: string; metadata?: Record<string, unknown> }
  ): Promise<ScrapedFeedback[]> {
    const markdown = response.markdown || '';
    
    switch (source) {
      case 'app_store':
        return this.parseAppStoreReviews(markdown, url);
      case 'product_hunt':
        return this.parseProductHuntComments(markdown, url);
      case 'reddit':
        return this.parseRedditContent(markdown, url);
      case 'stack_overflow':
        return this.parseStackOverflowContent(markdown, url);
      case 'quora':
        return this.parseQuoraContent(markdown, url);
      default:
        return this.parseGenericContent(markdown, url);
    }
  }

  // ---------------------------------------------------------------------------
  // SOURCE-SPECIFIC PARSERS
  // ---------------------------------------------------------------------------

  /**
   * Parse App Store reviews
   * Looks for star ratings and review text
   */
  private parseAppStoreReviews(markdown: string, url: string): ScrapedFeedback[] {
    const items: ScrapedFeedback[] = [];
    
    // Pattern to find reviews with star ratings
    // App Store reviews typically have: ★★★★★ or "5 out of 5" patterns
    const reviewPatterns = [
      // Pattern: "★★★★☆" followed by review text
      /([★☆]{5})\s*\n\s*(.+?)(?=\n\n|[★☆]{5}|$)/gs,
      // Pattern: "X out of 5 stars" followed by text
      /(\d)\s*(?:out of 5|\/5)\s*(?:stars?)?\s*\n\s*(.+?)(?=\n\n|\d\s*(?:out of 5|\/5)|$)/gis,
    ];

    for (const pattern of reviewPatterns) {
      let match;
      while ((match = pattern.exec(markdown)) !== null) {
        const ratingStr = match[1];
        const reviewText = match[2]?.trim();
        
        if (!reviewText || reviewText.length < 10) continue;
        
        // Parse star rating
        let starRating: number;
        if (ratingStr.includes('★')) {
          starRating = (ratingStr.match(/★/g) || []).length;
        } else {
          starRating = parseInt(ratingStr, 10);
        }

        items.push({
          source: 'app_store',
          content: reviewText,
          meta: {
            star_rating: starRating,
            post_url: url,
            posted_at: new Date(),
          },
        });
      }
    }

    // If no structured reviews found, treat entire content as single feedback
    if (items.length === 0 && markdown.length > 50) {
      items.push({
        source: 'app_store',
        content: markdown.substring(0, 5000),
        meta: { post_url: url },
      });
    }

    return items;
  }

  /**
   * Parse Product Hunt comments
   * Looks for upvote counts and comment text
   */
  private parseProductHuntComments(markdown: string, url: string): ScrapedFeedback[] {
    const items: ScrapedFeedback[] = [];
    
    // Product Hunt comments often have upvote counts like "▲ 23"
    const commentPattern = /(?:▲\s*(\d+)|(\d+)\s*(?:upvotes?|points?))\s*\n\s*(.+?)(?=\n\n|▲\s*\d+|\d+\s*(?:upvotes?|points?)|$)/gis;
    
    let match;
    while ((match = commentPattern.exec(markdown)) !== null) {
      const upvotes = parseInt(match[1] || match[2], 10);
      const commentText = match[3]?.trim();
      
      if (!commentText || commentText.length < 10) continue;
      
      items.push({
        source: 'product_hunt',
        content: commentText,
        meta: {
          upvotes,
          post_url: url,
          posted_at: new Date(),
        },
      });
    }

    // Fallback: split by paragraphs if no structured comments found
    if (items.length === 0) {
      const paragraphs = markdown.split(/\n\n+/).filter(p => p.trim().length > 50);
      for (const para of paragraphs.slice(0, 20)) { // Limit to 20 items
        items.push({
          source: 'product_hunt',
          content: para.trim(),
          meta: { post_url: url, upvotes: 0 },
        });
      }
    }

    return items;
  }

  /**
   * Parse Reddit posts and comments
   */
  private parseRedditContent(markdown: string, url: string): ScrapedFeedback[] {
    const items: ScrapedFeedback[] = [];
    
    // Extract subreddit from URL
    const subredditMatch = url.match(/reddit\.com\/r\/([\w]+)/);
    const subreddit = subredditMatch?.[1];
    
    // Reddit score pattern: "X points" or "▲ X"
    const commentPattern = /(?:(\d+)\s*(?:points?|upvotes?)|▲\s*(\d+))\s*[•·]\s*(?:\d+\s*(?:hours?|days?|weeks?)\s*ago)?\s*\n\s*(.+?)(?=\n\n|\d+\s*(?:points?|upvotes?)|▲\s*\d+|$)/gis;
    
    let match;
    while ((match = commentPattern.exec(markdown)) !== null) {
      const score = parseInt(match[1] || match[2], 10);
      const commentText = match[3]?.trim();
      
      if (!commentText || commentText.length < 20) continue;
      
      items.push({
        source: 'reddit',
        content: commentText,
        meta: {
          reddit_score: score,
          subreddit,
          post_url: url,
          posted_at: new Date(),
        },
      });
    }

    // Fallback for Reddit content
    if (items.length === 0 && markdown.length > 100) {
      // Split into paragraphs and treat each as a comment
      const paragraphs = markdown.split(/\n\n+/).filter(p => p.trim().length > 30);
      for (const para of paragraphs.slice(0, 30)) {
        items.push({
          source: 'reddit',
          content: para.trim(),
          meta: { subreddit, post_url: url, reddit_score: 1 },
        });
      }
    }

    return items;
  }

  /**
   * Parse Stack Overflow questions and answers
   */
  private parseStackOverflowContent(markdown: string, url: string): ScrapedFeedback[] {
    const items: ScrapedFeedback[] = [];
    
    // SO has vote counts and view counts
    const questionMatch = markdown.match(/Asked\s+(\d+)\s*(?:years?|months?|days?|hours?)\s*ago.*?Viewed\s+(\d+[kKmM]?)\s*times/is);
    
    // Extract main question/answer content
    const contentBlocks = markdown.split(/(?:Asked|Answered|Modified)\s+\d+/i);
    
    for (const block of contentBlocks) {
      const trimmed = block.trim();
      if (trimmed.length < 50) continue;
      
      // Look for vote count in block
      const voteMatch = trimmed.match(/^(\d+)\s*(?:votes?|score)/i);
      const score = voteMatch ? parseInt(voteMatch[1], 10) : 0;
      
      // Parse view count (e.g., "10k" -> 10000)
      let viewCount = 0;
      if (questionMatch?.[2]) {
        const viewStr = questionMatch[2].toLowerCase();
        if (viewStr.includes('k')) {
          viewCount = parseFloat(viewStr) * 1000;
        } else if (viewStr.includes('m')) {
          viewCount = parseFloat(viewStr) * 1000000;
        } else {
          viewCount = parseInt(viewStr, 10);
        }
      }

      items.push({
        source: 'stack_overflow',
        content: trimmed.substring(0, 3000),
        meta: {
          so_score: score,
          view_count: viewCount,
          post_url: url,
          posted_at: new Date(),
        },
      });
    }

    return items;
  }

  /**
   * Parse Quora answers
   */
  private parseQuoraContent(markdown: string, url: string): ScrapedFeedback[] {
    const items: ScrapedFeedback[] = [];
    
    // Quora upvote pattern
    const answerPattern = /(\d+[kKmM]?)\s*(?:upvotes?|views?)\s*\n\s*(.+?)(?=\n\n|\d+[kKmM]?\s*(?:upvotes?|views?)|$)/gis;
    
    let match;
    while ((match = answerPattern.exec(markdown)) !== null) {
      const upvoteStr = match[1].toLowerCase();
      let upvotes: number;
      
      if (upvoteStr.includes('k')) {
        upvotes = parseFloat(upvoteStr) * 1000;
      } else if (upvoteStr.includes('m')) {
        upvotes = parseFloat(upvoteStr) * 1000000;
      } else {
        upvotes = parseInt(upvoteStr, 10);
      }
      
      const answerText = match[2]?.trim();
      if (!answerText || answerText.length < 30) continue;
      
      items.push({
        source: 'quora',
        content: answerText,
        meta: {
          quora_upvotes: upvotes,
          post_url: url,
          posted_at: new Date(),
        },
      });
    }

    // Fallback
    if (items.length === 0 && markdown.length > 100) {
      items.push({
        source: 'quora',
        content: markdown.substring(0, 5000),
        meta: { post_url: url, quora_upvotes: 0 },
      });
    }

    return items;
  }

  /**
   * Parse generic/unknown content
   */
  private parseGenericContent(markdown: string, url: string): ScrapedFeedback[] {
    if (!markdown || markdown.length < 50) {
      return [];
    }

    // Split into paragraphs and create feedback items
    const paragraphs = markdown
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 30);

    return paragraphs.slice(0, 50).map(content => ({
      source: 'custom' as FeedbackSource,
      content,
      meta: { post_url: url },
    }));
  }
}

// ===========================================================================
// SINGLETON EXPORT
// ===========================================================================

let firecrawlInstance: FirecrawlClient | null = null;

export function getFirecrawlClient(): FirecrawlClient {
  if (!firecrawlInstance) {
    firecrawlInstance = new FirecrawlClient();
  }
  return firecrawlInstance;
}
