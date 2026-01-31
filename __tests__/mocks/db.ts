/**
 * Database Mocks
 * 
 * Mock implementations for MongoDB models and connection.
 */

import { jest } from '@jest/globals';

// Define types for mock data
type FeedbackItem = {
  _id: string;
  source: string;
  content: string;
  content_preview: string;
  feedback_type: string;
  normalized_severity: number;
  status: string;
  keywords: string[];
  created_at: Date;
  meta: Record<string, unknown>;
};

type ClusterSummary = {
  title: string;
  description: string;
  root_cause: string | null;
  suggested_fix: string;
  affected_area: string;
};

type ClusterMetrics = {
  total_items: number;
  avg_severity: number;
  max_severity: number;
  sources: string[];
  first_seen: Date;
  last_seen: Date;
  trend: string;
};

type Cluster = {
  _id: string;
  summary: ClusterSummary;
  metrics: ClusterMetrics;
  aggregate_severity: number;
  priority: string;
  status: string;
  feedback_items: string[];
  alert_sent: boolean;
  tags: string[];
};

type AggregateStats = {
  avgSeverity: number;
  maxSeverity: number;
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

// Sample mock data
export const mockFeedbackItems: FeedbackItem[] = [
  {
    _id: 'feedback-1',
    source: 'reddit',
    content: 'The app crashes on login. Very frustrating!',
    content_preview: 'The app crashes on login...',
    feedback_type: 'bug',
    normalized_severity: 95,
    status: 'pending',
    keywords: ['crash', 'login'],
    created_at: new Date('2026-01-30'),
    meta: {},
  },
  {
    _id: 'feedback-2',
    source: 'product_hunt',
    content: 'Would love to see dark mode support.',
    content_preview: 'Would love to see dark mode...',
    feedback_type: 'feature_request',
    normalized_severity: 60,
    status: 'pending',
    keywords: ['dark mode', 'feature'],
    created_at: new Date('2026-01-29'),
    meta: {},
  },
  {
    _id: 'feedback-3',
    source: 'app_store',
    content: 'Great app! Works perfectly.',
    content_preview: 'Great app! Works perfectly.',
    feedback_type: 'praise',
    normalized_severity: 10,
    status: 'clustered',
    keywords: ['great', 'perfect'],
    created_at: new Date('2026-01-28'),
    meta: { star_rating: 5 },
  },
];

export const mockClusters: Cluster[] = [
  {
    _id: 'cluster-1',
    summary: {
      title: 'Login Crash Issues',
      description: 'Multiple users reporting app crashes during login.',
      root_cause: 'Memory leak in auth module',
      suggested_fix: 'Fix memory management in login flow',
      affected_area: 'authentication',
    },
    metrics: {
      total_items: 15,
      avg_severity: 88,
      max_severity: 95,
      sources: ['reddit', 'app_store'],
      first_seen: new Date('2026-01-20'),
      last_seen: new Date('2026-01-30'),
      trend: 'rising',
    },
    aggregate_severity: 92,
    priority: 'critical',
    status: 'active',
    feedback_items: ['feedback-1'],
    alert_sent: true,
    tags: ['login', 'crash'],
  },
  {
    _id: 'cluster-2',
    summary: {
      title: 'Dark Mode Feature Request',
      description: 'Users requesting dark mode support.',
      root_cause: null,
      suggested_fix: 'Implement dark theme using CSS variables',
      affected_area: 'ui',
    },
    metrics: {
      total_items: 8,
      avg_severity: 55,
      max_severity: 65,
      sources: ['product_hunt', 'reddit'],
      first_seen: new Date('2026-01-15'),
      last_seen: new Date('2026-01-29'),
      trend: 'stable',
    },
    aggregate_severity: 60,
    priority: 'medium',
    status: 'reviewed',
    feedback_items: ['feedback-2'],
    alert_sent: false,
    tags: ['ui', 'dark-mode'],
  },
];

// Create mock model functions
export const createMockModel = () => ({
  find: jest.fn().mockReturnThis(),
  findById: jest.fn().mockReturnThis(),
  findByIdAndUpdate: jest.fn().mockReturnThis(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  updateMany: jest.fn(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  lean: jest.fn(),
  save: jest.fn(),
});

// Mock FeedbackItem model
export const mockFeedbackItemModel = {
  ...createMockModel(),
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          lean: jest.fn<() => Promise<FeedbackItem[]>>().mockResolvedValue(mockFeedbackItems),
        }),
        lean: jest.fn<() => Promise<FeedbackItem[]>>().mockResolvedValue(mockFeedbackItems),
      }),
    }),
  }),
  countDocuments: jest.fn<() => Promise<number>>().mockResolvedValue(mockFeedbackItems.length),
  aggregate: jest.fn<() => Promise<AggregateStats[]>>().mockResolvedValue([
    { avgSeverity: 55, maxSeverity: 95 },
  ]),
};

// Mock Cluster model
export const mockClusterModel = {
  ...createMockModel(),
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          lean: jest.fn<() => Promise<Cluster[]>>().mockResolvedValue(mockClusters),
        }),
        lean: jest.fn<() => Promise<Cluster[]>>().mockResolvedValue(mockClusters),
      }),
    }),
  }),
  findById: jest.fn().mockReturnValue({
    lean: jest.fn<() => Promise<Cluster>>().mockResolvedValue(mockClusters[0]),
  }),
  countDocuments: jest.fn<() => Promise<number>>().mockResolvedValue(mockClusters.length),
  aggregate: jest.fn<() => Promise<ClusterStats[]>>().mockResolvedValue([
    {
      totalClusters: 2,
      critical: 1,
      high: 0,
      medium: 1,
      low: 0,
      avgSeverity: 76,
      totalFeedbackItems: 23,
    },
  ]),
};

// Mock database connection
export const mockConnectToDatabase = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
