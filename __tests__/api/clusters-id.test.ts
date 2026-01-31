/**
 * Single Cluster API Tests
 * 
 * Tests for GET/PATCH /api/clusters/[id] endpoint.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMockRequest, parseResponse } from '../utils/request-helpers';

// Define types for mock data
type ClusterSummary = {
  title: string;
  description: string;
  root_cause: string;
  suggested_fix: string;
  affected_area: string;
};

type Cluster = {
  _id: string;
  summary: ClusterSummary;
  aggregate_severity: number;
  priority: string;
  status: string;
  feedback_items: string[];
  metrics: { total_items: number };
};

type FeedbackItem = {
  _id: string;
  content: string;
  normalized_severity: number;
};

// Mock data
const mockCluster: Cluster = {
  _id: 'cluster-1',
  summary: {
    title: 'Login Crash Issues',
    description: 'Multiple users reporting crashes on login',
    root_cause: 'Memory leak',
    suggested_fix: 'Fix memory management',
    affected_area: 'authentication',
  },
  aggregate_severity: 92,
  priority: 'critical',
  status: 'active',
  feedback_items: ['feedback-1', 'feedback-2'],
  metrics: { total_items: 2 },
};

const mockFeedbackItems: FeedbackItem[] = [
  { _id: 'feedback-1', content: 'App crashes on login', normalized_severity: 95 },
  { _id: 'feedback-2', content: 'Cannot login', normalized_severity: 88 },
];

// Mock the database module
jest.mock('@/lib/db/connection', () => ({
  connectToDatabase: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

// Mock the models
jest.mock('@/lib/db/models', () => ({
  Cluster: {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn<() => Promise<Cluster>>().mockResolvedValue(mockCluster),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn<() => Promise<Cluster>>().mockResolvedValue({ ...mockCluster, status: 'resolved' }),
    }),
  },
  FeedbackItem: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn<() => Promise<FeedbackItem[]>>().mockResolvedValue(mockFeedbackItems),
        }),
      }),
    }),
    updateMany: jest.fn<() => Promise<{ modifiedCount: number }>>().mockResolvedValue({ modifiedCount: 2 }),
  },
}));

describe('/api/clusters/[id]', () => {
  let GET: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  let PATCH: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('@/app/api/clusters/[id]/route');
    GET = module.GET;
    PATCH = module.PATCH;
  });

  describe('GET /api/clusters/[id]', () => {
    it('should return a cluster with feedback items', async () => {
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/clusters/cluster-1',
      });

      const response = await GET(request, { params: Promise.resolve({ id: 'cluster-1' }) });
      const data = await parseResponse<{
        success: boolean;
        cluster: Cluster;
        feedback_items: FeedbackItem[];
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.cluster).toBeDefined();
      expect(data.cluster.summary.title).toBe('Login Crash Issues');
      expect(Array.isArray(data.feedback_items)).toBe(true);
    });

    it('should return 404 for non-existent cluster', async () => {
      // Override mock for this test
      const { Cluster } = await import('@/lib/db/models');
      (Cluster.findById as jest.Mock).mockReturnValueOnce({
        lean: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/clusters/non-existent',
      });

      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await parseResponse<{ success: boolean; error: string }>(response);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Cluster not found');
    });
  });

  describe('PATCH /api/clusters/[id]', () => {
    it('should update cluster status', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/clusters/cluster-1',
        body: { status: 'resolved' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'cluster-1' }) });
      const data = await parseResponse<{
        success: boolean;
        cluster: { status: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should update cluster priority', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/clusters/cluster-1',
        body: { priority: 'high' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'cluster-1' }) });
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid status', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/clusters/cluster-1',
        body: { status: 'invalid_status' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'cluster-1' }) });
      const data = await parseResponse<{ success: boolean; error: string }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('should update cluster summary', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/clusters/cluster-1',
        body: {
          summary: {
            title: 'Updated Title',
            description: 'Updated description',
          },
        },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'cluster-1' }) });
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should update cluster tags', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/clusters/cluster-1',
        body: { tags: ['urgent', 'login', 'bug'] },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'cluster-1' }) });
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
