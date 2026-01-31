/**
 * Analyze API Tests
 * 
 * Tests for GET/POST /api/analyze endpoint.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMockRequest, parseResponse } from '../utils/request-helpers';

type AnalysisResult = {
  success: boolean;
  itemsClassified: number;
  clustersCreated: number;
  alertsSent: number;
  errors: string[];
};

const mockAnalysisResult: AnalysisResult = {
  success: true,
  itemsClassified: 10,
  clustersCreated: 3,
  alertsSent: 1,
  errors: [],
};

// Helper to create typed mock functions
const createAnalyzeMock = (result: AnalysisResult) => 
  jest.fn<() => Promise<AnalysisResult>>().mockResolvedValue(result);

const createAnalyzeRejectMock = (error: Error) =>
  jest.fn<() => Promise<AnalysisResult>>().mockRejectedValue(error);

// Mock the intelligence module
jest.mock('@/lib/intelligence', () => ({
  getInsightEngine: jest.fn(() => ({
    analyze: createAnalyzeMock(mockAnalysisResult),
  })),
}));

describe('/api/analyze', () => {
  let GET: () => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('@/app/api/analyze/route');
    GET = module.GET;
    POST = module.POST;
  });

  describe('GET /api/analyze', () => {
    it('should run analysis with defaults and return results', async () => {
      const response = await GET();
      const data = await parseResponse<{
        success: boolean;
        items_classified: number;
        clusters_created: number;
        alerts_sent: number;
        errors: string[];
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items_classified).toBe(10);
      expect(data.clusters_created).toBe(3);
      expect(data.alerts_sent).toBe(1);
      expect(data.errors).toEqual([]);
    });

    it('should handle analysis errors gracefully', async () => {
      const { getInsightEngine } = await import('@/lib/intelligence');
      (getInsightEngine as jest.Mock).mockReturnValueOnce({
        analyze: createAnalyzeRejectMock(new Error('Analysis failed')),
      });

      const response = await GET();
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Analysis failed');
    });
  });

  describe('POST /api/analyze', () => {
    it('should run analysis with default options', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: {},
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        items_classified: number;
        clusters_created: number;
        alerts_sent: number;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items_classified).toBe(10);
    });

    it('should accept custom batchSize', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: { batchSize: 100 },
      });

      const response = await POST(request);
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should skip alerts when requested', async () => {
      const { getInsightEngine } = await import('@/lib/intelligence');
      (getInsightEngine as jest.Mock).mockReturnValueOnce({
        analyze: createAnalyzeMock({ ...mockAnalysisResult, alertsSent: 0 }),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: { skipAlerts: true },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        alerts_sent: number;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alerts_sent).toBe(0);
    });

    it('should reject invalid batchSize (too small)', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: { batchSize: 0 },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('should reject invalid batchSize (too large)', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: { batchSize: 500 },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return errors array when analysis has issues', async () => {
      const mockResultWithErrors: AnalysisResult = {
        success: false,
        itemsClassified: 5,
        clustersCreated: 1,
        alertsSent: 0,
        errors: ['LLM rate limit exceeded', 'Database timeout on batch 3'],
      };

      const { getInsightEngine } = await import('@/lib/intelligence');
      (getInsightEngine as jest.Mock).mockReturnValueOnce({
        analyze: createAnalyzeMock(mockResultWithErrors),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: {},
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        errors: string[];
      }>(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.errors).toHaveLength(2);
      expect(data.errors).toContain('LLM rate limit exceeded');
    });

    it('should handle analysis with no pending items', async () => {
      const { getInsightEngine } = await import('@/lib/intelligence');
      (getInsightEngine as jest.Mock).mockReturnValueOnce({
        analyze: createAnalyzeMock({
          success: true,
          itemsClassified: 0,
          clustersCreated: 0,
          alertsSent: 0,
          errors: [],
        }),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/analyze',
        body: {},
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        items_classified: number;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items_classified).toBe(0);
    });
  });
});
