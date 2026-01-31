/**
 * Firecrawl Client Tests
 * 
 * Tests for the Firecrawl web scraping client.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { detectSource, FirecrawlClient } from '@/lib/ingest/firecrawl-client';

// Define types for mock data
type ScrapeResponse = {
  success: boolean;
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
};

type CrawlResponse = {
  success: boolean;
  data?: Array<{
    markdown?: string;
    html?: string;
    metadata?: { sourceURL?: string };
  }>;
};

// Type for our mock functions
type MockScrapeUrl = jest.Mock<(url: string, options?: unknown) => Promise<ScrapeResponse>>;
type MockCrawlUrl = jest.Mock<(url: string, options?: unknown) => Promise<CrawlResponse>>;

// Mock the Firecrawl SDK
jest.mock('@mendable/firecrawl-js', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      scrapeUrl: jest.fn(),
      crawlUrl: jest.fn(),
    })),
  };
});

describe('detectSource', () => {
  it('should detect App Store URLs', () => {
    expect(detectSource('https://apps.apple.com/us/app/myapp/id123456789')).toBe('app_store');
    expect(detectSource('https://apps.apple.com/gb/app/example/id987654321')).toBe('app_store');
  });

  it('should detect Product Hunt URLs', () => {
    expect(detectSource('https://www.producthunt.com/posts/my-product')).toBe('product_hunt');
    expect(detectSource('https://producthunt.com/products/cool-app')).toBe('product_hunt');
  });

  it('should detect Reddit URLs', () => {
    expect(detectSource('https://www.reddit.com/r/programming/comments/abc123/title')).toBe('reddit');
    expect(detectSource('https://reddit.com/r/webdev/')).toBe('reddit');
  });

  it('should detect Quora URLs', () => {
    expect(detectSource('https://www.quora.com/What-is-the-best/answer/Someone')).toBe('quora');
    expect(detectSource('https://quora.com/topic/Programming')).toBe('quora');
  });

  it('should detect Stack Overflow URLs', () => {
    expect(detectSource('https://stackoverflow.com/questions/12345/how-to-do-something')).toBe('stack_overflow');
  });

  it('should return custom for unknown URLs', () => {
    expect(detectSource('https://example.com/feedback')).toBe('custom');
    expect(detectSource('https://myblog.com/review')).toBe('custom');
    expect(detectSource('https://github.com/user/repo')).toBe('custom');
  });
});

describe('FirecrawlClient', () => {
  let client: FirecrawlClient;
  let mockScrapeUrl: MockScrapeUrl;
  let mockCrawlUrl: MockCrawlUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked module and create typed mocks
    const FirecrawlApp = require('@mendable/firecrawl-js').default;
    mockScrapeUrl = jest.fn() as MockScrapeUrl;
    mockCrawlUrl = jest.fn() as MockCrawlUrl;
    
    FirecrawlApp.mockImplementation(() => ({
      scrapeUrl: mockScrapeUrl,
      crawlUrl: mockCrawlUrl,
    }));

    client = new FirecrawlClient('test-api-key');
  });

  describe('constructor', () => {
    it('should throw error if no API key provided', () => {
      const originalEnv = process.env.FIRECRAWL_API_KEY;
      delete process.env.FIRECRAWL_API_KEY;
      
      expect(() => new FirecrawlClient()).toThrow('FIRECRAWL_API_KEY is required');
      
      process.env.FIRECRAWL_API_KEY = originalEnv;
    });

    it('should use provided API key', () => {
      expect(() => new FirecrawlClient('my-api-key')).not.toThrow();
    });

    it('should use environment variable if no key provided', () => {
      process.env.FIRECRAWL_API_KEY = 'env-api-key';
      expect(() => new FirecrawlClient()).not.toThrow();
    });
  });

  describe('scrape', () => {
    it('should return success with scraped items', async () => {
      const response: ScrapeResponse = {
        success: true,
        markdown: '★★★★★\nGreat app, love it!\n\n★★★☆☆\nNeeds improvement',
      };
      mockScrapeUrl.mockResolvedValue(response);

      const result = await client.scrape('https://apps.apple.com/us/app/test/id123');

      expect(result.success).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].source).toBe('app_store');
    });

    it('should handle failed scrape', async () => {
      const response: ScrapeResponse = { success: false };
      mockScrapeUrl.mockResolvedValue(response);

      const result = await client.scrape('https://example.com');

      expect(result.success).toBe(false);
      expect(result.items).toHaveLength(0);
      expect(result.error).toBe('Failed to scrape URL');
    });

    it('should handle scrape exceptions', async () => {
      mockScrapeUrl.mockRejectedValue(new Error('Network error'));

      const result = await client.scrape('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should parse Reddit content correctly', async () => {
      const response: ScrapeResponse = {
        success: true,
        markdown: '150 points • 3 hours ago\nThis is a really helpful post about programming.\n\n75 points • 1 day ago\nAnother great comment here.',
      };
      mockScrapeUrl.mockResolvedValue(response);

      const result = await client.scrape('https://reddit.com/r/programming/comments/xyz');

      expect(result.success).toBe(true);
      expect(result.items[0].source).toBe('reddit');
    });

    it('should parse Product Hunt content correctly', async () => {
      const response: ScrapeResponse = {
        success: true,
        markdown: '▲ 45\nThis product is amazing! Really helped my workflow.\n\n▲ 23\nGreat design and functionality.',
      };
      mockScrapeUrl.mockResolvedValue(response);

      const result = await client.scrape('https://producthunt.com/posts/cool-app');

      expect(result.success).toBe(true);
      expect(result.items[0].source).toBe('product_hunt');
    });

    it('should handle generic content for unknown sources', async () => {
      const response: ScrapeResponse = {
        success: true,
        markdown: 'This is some generic feedback content.\n\nAnother paragraph of user feedback here.',
      };
      mockScrapeUrl.mockResolvedValue(response);

      const result = await client.scrape('https://example.com/feedback');

      expect(result.success).toBe(true);
      expect(result.items[0].source).toBe('custom');
    });
  });

  describe('crawl', () => {
    it('should crawl multiple pages successfully', async () => {
      const response: CrawlResponse = {
        success: true,
        data: [
          { markdown: '★★★★★\nFirst page review content', metadata: { sourceURL: 'https://apps.apple.com/page1' } },
          { markdown: '★★★☆☆\nSecond page review content', metadata: { sourceURL: 'https://apps.apple.com/page2' } },
        ],
      };
      mockCrawlUrl.mockResolvedValue(response);

      const result = await client.crawl('https://apps.apple.com/us/app/test/id123', { maxPages: 5 });

      expect(result.success).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should handle failed crawl', async () => {
      const response: CrawlResponse = { success: false };
      mockCrawlUrl.mockResolvedValue(response);

      const result = await client.crawl('https://example.com');

      expect(result.success).toBe(false);
      expect(result.items).toHaveLength(0);
      expect(result.error).toBe('Failed to crawl URL');
    });

    it('should handle crawl exceptions', async () => {
      mockCrawlUrl.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await client.crawl('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should respect maxPages option', async () => {
      const response: CrawlResponse = { success: true, data: [] };
      mockCrawlUrl.mockResolvedValue(response);

      await client.crawl('https://example.com', { maxPages: 20 });

      expect(mockCrawlUrl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ limit: 20 })
      );
    });
  });
});
