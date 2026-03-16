/**
 * Test setup file.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// Set up ed25519 to use sha512 hash function in Node.js
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));
ed25519.etc.sha512Async = async (...m) => sha512(ed25519.etc.concatBytes(...m));

// Mock fetch globally
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore original fetch
  globalThis.fetch = originalFetch;
});

/**
 * Create a mock fetch function.
 */
export function createMockFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  let callIndex = 0;

  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;

    if (!response) {
      throw new Error('No mock response configured');
    }

    return new Response(
      response.body !== undefined ? JSON.stringify(response.body) : null,
      {
        status: response.status,
        headers: {
          'content-type': 'application/json',
          ...response.headers,
        },
      }
    );
  });
}

/**
 * Create a mock fetch that throws a network error.
 */
export function createNetworkErrorFetch(message = 'Network error') {
  return vi.fn(async () => {
    throw new Error(message);
  });
}

/**
 * Create a mock AbortController that aborts immediately.
 */
export function createAbortedFetch() {
  return vi.fn(async () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    throw error;
  });
}

/**
 * Test utilities.
 */
export const testUtils = {
  /**
   * Wait for a condition to be true.
   */
  async waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  },

  /**
   * Create a delay.
   */
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};
