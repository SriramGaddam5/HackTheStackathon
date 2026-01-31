/**
 * Generate Fix API Tests
 * 
 * Tests for GET/POST /api/generate-fix endpoint.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createMockRequest, parseResponse } from '../utils/request-helpers';

// Define types for mock data
type FileChange = {
  path: string;
  changes: string;
};

type FixPlan = {
  summary: string;
  files_to_modify: FileChange[];
  files_to_create: FileChange[];
  estimated_impact: string;
};

type FixResult = {
  success: boolean;
  cluster_id: string;
  fix_plan: FixPlan | null;
  markdown_file: string | null;
  pr_url: string | null;
  error: string | null;
};

type BatchResult = {
  success: boolean;
  cluster_id: string;
  pr_url: string | null;
  error: string | null;
};

// Mock data
const mockFixResult: FixResult = {
  success: true,
  cluster_id: 'cluster-1',
  fix_plan: {
    summary: 'Fix login crash by improving memory management',
    files_to_modify: [
      { path: 'src/auth/login.ts', changes: 'Add proper cleanup' },
    ],
    files_to_create: [],
    estimated_impact: 'high',
  },
  markdown_file: 'generated-fixes/cluster-1-fix.md',
  pr_url: null,
  error: null,
};

const mockBatchResults: BatchResult[] = [
  { success: true, cluster_id: 'cluster-1', pr_url: null, error: null },
  { success: true, cluster_id: 'cluster-2', pr_url: null, error: null },
  { success: false, cluster_id: 'cluster-3', pr_url: null, error: 'Generation failed' },
];

// Helper to create typed mock functions
const createFixMock = (result: FixResult) =>
  jest.fn<() => Promise<FixResult>>().mockResolvedValue(result);

const createBatchMock = (results: BatchResult[]) =>
  jest.fn<() => Promise<BatchResult[]>>().mockResolvedValue(results);

// Mock the coder module
jest.mock('@/lib/coder', () => ({
  getAgenticCoder: jest.fn(() => ({
    generateFix: createFixMock(mockFixResult),
    generateFixesForCriticalClusters: createBatchMock(mockBatchResults),
  })),
}));

describe('/api/generate-fix', () => {
  let GET: () => Promise<Response>;
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('@/app/api/generate-fix/route');
    GET = module.GET;
    POST = module.POST;
  });

  describe('GET /api/generate-fix', () => {
    it('should return usage information', async () => {
      const response = await GET();
      const data = await parseResponse<{
        endpoint: string;
        methods: string[];
        description: string;
        usage: object;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.endpoint).toBe('/api/generate-fix');
      expect(data.methods).toContain('POST');
      expect(data.usage).toBeDefined();
      expect(data.usage).toHaveProperty('single_cluster');
      expect(data.usage).toHaveProperty('all_critical');
      expect(data.usage).toHaveProperty('with_github_pr');
    });
  });

  describe('POST /api/generate-fix', () => {
    it('should generate fix for a single cluster', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { clusterId: 'cluster-1' },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        cluster_id: string;
        fix_plan: {
          summary: string;
          files_to_modify: number;
          files_to_create: number;
          estimated_impact: string;
        };
        markdown_file: string;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.cluster_id).toBe('cluster-1');
      expect(data.fix_plan).toBeDefined();
      expect(data.fix_plan.summary).toContain('Fix login crash');
      expect(data.markdown_file).toContain('cluster-1');
    });

    it('should reject request without clusterId or all flag', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: {},
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Either clusterId or all=true is required');
    });

    it('should process all critical clusters when all=true', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { all: true },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        total_processed: number;
        succeeded: number;
        failed: number;
        results: Array<{
          cluster_id: string;
          success: boolean;
          error?: string;
        }>;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.total_processed).toBe(3);
      expect(data.succeeded).toBe(2);
      expect(data.failed).toBe(1);
      expect(data.results).toHaveLength(3);
    });

    it('should accept custom severity threshold', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { all: true, threshold: 90 },
      });

      const response = await POST(request);
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
    });

    it('should accept createPR option for single cluster', async () => {
      const mockWithPR: FixResult = {
        ...mockFixResult,
        pr_url: 'https://github.com/test/repo/pull/42',
      };

      const { getAgenticCoder } = await import('@/lib/coder');
      (getAgenticCoder as jest.Mock).mockReturnValueOnce({
        generateFix: createFixMock(mockWithPR),
        generateFixesForCriticalClusters: jest.fn(),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { clusterId: 'cluster-1', createPR: true },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        pr_url: string;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pr_url).toBe('https://github.com/test/repo/pull/42');
    });

    it('should accept codebaseContext for better fix generation', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: {
          clusterId: 'cluster-1',
          codebaseContext: '// src/auth/login.ts\nexport function login() { ... }',
        },
      });

      const response = await POST(request);
      const data = await parseResponse<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid threshold (too low)', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { all: true, threshold: -10 },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject invalid threshold (too high)', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { all: true, threshold: 150 },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle fix generation failure gracefully', async () => {
      const mockFailure: FixResult = {
        success: false,
        cluster_id: 'cluster-1',
        fix_plan: null,
        markdown_file: null,
        pr_url: null,
        error: 'Cluster not found',
      };

      const { getAgenticCoder } = await import('@/lib/coder');
      (getAgenticCoder as jest.Mock).mockReturnValueOnce({
        generateFix: createFixMock(mockFailure),
        generateFixesForCriticalClusters: jest.fn(),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { clusterId: 'non-existent' },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        error: string;
      }>(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Cluster not found');
    });

    it('should handle createPR for all critical clusters', async () => {
      const mockBatchWithPRs: BatchResult[] = [
        { success: true, cluster_id: 'cluster-1', pr_url: 'https://github.com/test/repo/pull/1', error: null },
        { success: true, cluster_id: 'cluster-2', pr_url: 'https://github.com/test/repo/pull/2', error: null },
      ];

      const { getAgenticCoder } = await import('@/lib/coder');
      (getAgenticCoder as jest.Mock).mockReturnValueOnce({
        generateFix: jest.fn(),
        generateFixesForCriticalClusters: createBatchMock(mockBatchWithPRs),
      });

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/generate-fix',
        body: { all: true, createPR: true },
      });

      const response = await POST(request);
      const data = await parseResponse<{
        success: boolean;
        results: Array<{ pr_url: string }>;
      }>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results[0].pr_url).toContain('github.com');
    });
  });
});
