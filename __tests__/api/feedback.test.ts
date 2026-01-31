/**
 * Feedback API Tests
 * 
 * Tests for GET /api/feedback endpoint.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMockRequest, parseResponse } from '../utils/request-helpers';

// Define types for mock data
type FeedbackItem = {
  _id: string;
  source: string;
  content: string;
  normalized_severity: number;
  status: string;
};

type AggregateStats = {
  avgSeverity: number;
  maxSeverity: number;
};

// Mock data
const mockFeedbackItems: FeedbackItem[] = [
  {
    _id: 'feedback-1',
    source: 'reddit',
    content: 'The app crashes on login.',
    normalized_severity: 95,
    status: 'pending',
  },
  {
    _id: 'feedback-2',
    source: 'product_hunt',
    content: 'Would love dark mode.',
    normalized_severity: 60,
    status: 'pending',
  },
];

const mockStats: AggregateStats[] = [{ avgSeverity: 77.5, maxSeverity: 95 }];

// Mock the database module
jest.mock('@/lib/db/connection', () => ({
  connectToDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// Mock the FeedbackItem model
jest.mock('@/lib/db/models', () => ({
  FeedbackItem: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            lean: jest.fn<() => Promise<FeedbackItem[]>>().mockResolvedValue(mockFeedbackItems),
          }),
        }),
      }),
    }),
    countDocuments: jest.fn<() => Promise<number>>().mockResolvedValue(2),
    aggregate: jest.fn<() => Promise<AggregateStats[]>>().mockResolvedValue(mockStats),
  },
}));

describe('GET /api/feedback', () => {
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Dynamic import to ensure mocks are applied
    const module = await import('@/app/api/feedback/route');
    GET = module.GET;
  });

  it('should return feedback items successfully', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
    });

    const response = await GET(request);
    const data = await parseResponse<{
      success: boolean;
      items: unknown[];
      pagination: { total: number; limit: number; skip: number; hasMore: boolean };
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
  });

  it('should respect limit and skip parameters', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
      searchParams: { limit: '10', skip: '5' },
    });

    const response = await GET(request);
    const data = await parseResponse<{
      success: boolean;
      pagination: { limit: number; skip: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.skip).toBe(5);
  });

  it('should filter by status', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
      searchParams: { status: 'pending' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should filter by source', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
      searchParams: { source: 'reddit' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should filter by minimum severity', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
      searchParams: { minSeverity: '80' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should filter by feedback type', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
      searchParams: { type: 'bug' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should include stats in response', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/feedback',
    });

    const response = await GET(request);
    const data = await parseResponse<{
      success: boolean;
      stats: { avgSeverity: number; maxSeverity: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(data.stats).toBeDefined();
    expect(data.stats.avgSeverity).toBeDefined();
    expect(data.stats.maxSeverity).toBeDefined();
  });
});
