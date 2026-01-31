/**
 * Ingest API Tests
 * 
 * Tests for GET/POST /api/ingest endpoint.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMockRequest, parseResponse } from '../utils/request-helpers';

// Define types for mock data
type SavedItem = {
  _id: string;
  source: string;
  normalized_severity: number;
  content_preview: string;
};

type IngestResult = {
  success: boolean;
  strategy: string;
  source: string;
  itemsProcessed: number;
  itemsSaved: number;
  itemsSkipped: number;
  errors: string[];
  savedItems: SavedItem[];
};

type AnalysisResult = {
  success: boolean;
  itemsClassified: number;
  clustersCreated: number;
  alertsSent: number;
  errors: string[];
};

// Mock data
const mockIngestResult: IngestResult = {
  success: true,
  strategy: 'text',
  source: 'manual_upload',
  itemsProcessed: 1,
  itemsSaved: 1,
  itemsSkipped: 0,
  errors: [],
  savedItems: [
    {
      _id: 'feedback-new',
      source: 'manual_upload',
      normalized_severity: 70,
      content_preview: 'Test feedback content...',
    },
  ],
};

const mockAnalysisResult: AnalysisResult = {
  success: true,
  itemsClassified: 1,
  clustersCreated: 0,
  alertsSent: 0,
  errors: [],
};

// Helper to create typed mock functions
const createIngestMock = (result: IngestResult) =>
  jest.fn<() => Promise<IngestResult>>().mockResolvedValue(result);

const createAnalyzeMock = (result: AnalysisResult) =>
  jest.fn<() => Promise<AnalysisResult>>().mockResolvedValue(result);

// Mock the ingest module
jest.mock('@/lib/ingest', () => ({
  getFeedbackIngestor: jest.fn(() => ({
    ingest: createIngestMock(mockIngestResult),
  })),
}));

// Mock the intelligence module
jest.mock('@/lib/intelligence', () => ({
  getInsightEngine: jest.fn(() => ({
    analyze: createAnalyzeMock(mockAnalysisResult),
  })),
}));

describe('/api/ingest', () => {
  let GET: () => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('@/app/api/ingest/route');
    GET = module.GET;
    POST = module.POST;
  });

  describe('GET /api/ingest', () => {
    it('should return usage information', async () => {
      const response = await GET();
      const data = await parseResponse<{
        endpoint: string;
        methods: string[];
        description: string;
        usage: object;
        supported_sources: string[];
      }>(response);

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe('/api/ingest');
      expect(data.methods).toContain('POST');
      expect(data.usage).toBeDefined();
      expect(Array.isArray(data.supported_sources)).toBe(true);
    });
  });

  describe('POST /api/ingest', () => {
    it('should ingest text successfully', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          text: 'This is a test feedback about app crashes on login. Very frustrating!',
          source: 'manual_upload',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        strategy: string;
        source: string;
        items: { processed: number; saved: number; skipped: number };
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.strategy).toBe('text');
      expect(data.items.saved).toBeGreaterThanOrEqual(0);
    });

    it('should ingest URL successfully', async () => {
      // Update mock for URL ingestion
      const { getFeedbackIngestor } = await import('@/lib/ingest');
      (getFeedbackIngestor as jest.Mock).mockReturnValue({
        ingest: createIngestMock({
          ...mockIngestResult,
          strategy: 'firecrawl',
          source: 'reddit',
        }),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          url: 'https://www.reddit.com/r/programming/comments/example',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        strategy: string;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject request without url or text', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {},
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
        details: unknown[];
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('should reject invalid URL', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          url: 'not-a-valid-url',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject text that is too short', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          text: 'short',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should run auto-analysis when requested', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          text: 'This is a test feedback that needs to be analyzed automatically.',
          autoAnalyze: true,
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        analysis: { attempted: boolean; success?: boolean };
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.analysis.attempted).toBe(true);
    });

    it('should handle crawl option for URL', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          url: 'https://www.reddit.com/r/programming',
          crawl: true,
          maxPages: 5,
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should respect skipDuplicates option', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          text: 'Test feedback with duplicate checking disabled.',
          skipDuplicates: false,
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should accept valid source override', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          text: 'Test feedback from a specific source.',
          source: 'reddit',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid source', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/ingest',
        body: {
          text: 'Test feedback with invalid source.',
          source: 'invalid_source',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });
});
