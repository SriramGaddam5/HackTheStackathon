/**
 * Clusters API Tests
 * 
 * Tests for GET /api/clusters endpoint.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMockRequest, parseResponse } from '../utils/request-helpers';

// Define types for mock data
type ClusterItem = {
  _id: string;
  summary: { title: string; description: string };
  aggregate_severity: number;
  priority: string;
  status: string;
  metrics: { total_items: number };
};

type ClusterStats = {
  totalClusters: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgSeverity: number;
  totalFeedbackItems: number;
};

// Mock data
const mockClusters: ClusterItem[] = [
  {
    _id: 'cluster-1',
    summary: { title: 'Login Crash Issues', description: 'App crashes on login' },
    aggregate_severity: 92,
    priority: 'critical',
    status: 'active',
    metrics: { total_items: 15 },
  },
  {
    _id: 'cluster-2',
    summary: { title: 'Dark Mode Request', description: 'Users want dark mode' },
    aggregate_severity: 60,
    priority: 'medium',
    status: 'reviewed',
    metrics: { total_items: 8 },
  },
];

const mockStats: ClusterStats[] = [
  {
    totalClusters: 2,
    critical: 1,
    high: 0,
    medium: 1,
    low: 0,
    avgSeverity: 76,
    totalFeedbackItems: 23,
  },
];

// Mock the database module
jest.mock('@/lib/db/connection', () => ({
  connectToDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// Mock the models
jest.mock('@/lib/db/models', () => ({
  Cluster: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            lean: jest.fn<() => Promise<ClusterItem[]>>().mockResolvedValue(mockClusters),
          }),
        }),
      }),
    }),
    countDocuments: jest.fn<() => Promise<number>>().mockResolvedValue(2),
    aggregate: jest.fn<() => Promise<ClusterStats[]>>().mockResolvedValue(mockStats),
  },
  FeedbackItem: {},
}));

describe('GET /api/clusters', () => {
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('@/app/api/clusters/route');
    GET = module.GET;
  });

  it('should return clusters successfully', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/clusters',
    });

    const response = await GET(request);
    const data = await parseResponse<{
      success: boolean;
      clusters: unknown[];
      pagination: { total: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.clusters)).toBe(true);
    expect(data.pagination.total).toBe(2);
  });

  it('should filter by status', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/clusters',
      searchParams: { status: 'active' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should filter by priority', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/clusters',
      searchParams: { priority: 'critical' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should filter by minimum severity', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/clusters',
      searchParams: { minSeverity: '80' },
    });

    const response = await GET(request);
    const data = await parseResponse<{ success: boolean }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should include stats in response', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/clusters',
    });

    const response = await GET(request);
    const data = await parseResponse<{
      success: boolean;
      stats: ClusterStats;
    }>(response);

    expect(response.status).toBe(200);
    expect(data.stats).toBeDefined();
    expect(data.stats.totalClusters).toBe(2);
    expect(data.stats.critical).toBe(1);
    expect(data.stats.medium).toBe(1);
  });

  it('should respect pagination parameters', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/clusters',
      searchParams: { limit: '5', skip: '10' },
    });

    const response = await GET(request);
    const data = await parseResponse<{
      success: boolean;
      pagination: { limit: number; skip: number };
    }>(response);

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(5);
    expect(data.pagination.skip).toBe(10);
  });
});
