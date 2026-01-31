/**
 * Test Request Helpers
 * 
 * Utilities for creating mock Next.js requests in tests.
 */

import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest for testing
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: unknown;
  searchParams?: Record<string, string>;
}): NextRequest {
  const { method = 'GET', url = 'http://localhost:3000', body, searchParams } = options;

  let fullUrl = url;
  if (searchParams) {
    const params = new URLSearchParams(searchParams);
    fullUrl = `${url}?${params.toString()}`;
  }

  const init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(fullUrl, init);
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
