/**
 * Jest Test Setup
 * 
 * Configures mocks and global setup for all tests.
 */

import { jest } from '@jest/globals';

// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key';
process.env.REDUCTO_API_KEY = 'test-reducto-key';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';
process.env.ALERT_EMAIL_TO = 'test@example.com';
process.env.ALERT_EMAIL_FROM = 'alerts@example.com';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.SEVERITY_THRESHOLD = '80';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global beforeAll/afterAll hooks can be added here
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
