/**
 * Transport layer tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../../src/client/transport.js';
import { resolveConfig } from '../../src/client/config.js';
import { APIError, TransportError } from '../../src/client/errors.js';
import { createMockFetch } from '../setup.js';

describe('Transport', () => {
  let transport: Transport;
  let mockFetch: ReturnType<typeof createMockFetch>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockFetch = createMockFetch([{ status: 200, body: {} }]);

    const config = resolveConfig({
      apiKey: 'test_api_key',
      timeout: 5000,
      retryPolicy: {
        maxAttempts: 3,
        initialBackoffMs: 10, // Fast for tests
        maxBackoffMs: 50,
      },
      fetch: mockFetch as unknown as typeof fetch,
    });
    transport = new Transport(config);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('request', () => {
    it('makes GET request', async () => {
      mockFetch = createMockFetch([
        { status: 200, body: { data: [{ id: '1', name: 'Test' }] } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const result = await transport.request({
        method: 'GET',
        path: '/customers',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: [{ id: '1', name: 'Test' }] });
    });

    it('makes POST request with body', async () => {
      mockFetch = createMockFetch([
        { status: 201, body: { id: '1', name: 'New Customer' } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const result = await transport.request({
        method: 'POST',
        path: '/customers',
        body: { name: 'New Customer' },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/customers');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'New Customer' }));
      expect(result).toEqual({ id: '1', name: 'New Customer' });
    });

    it('adds query parameters', async () => {
      mockFetch = createMockFetch([{ status: 200, body: { data: [] } }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'GET',
        path: '/customers',
        query: { limit: 10, status: 'active' },
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('limit=10');
      expect(url).toContain('status=active');
    });

    it('ignores undefined query parameters', async () => {
      mockFetch = createMockFetch([{ status: 200, body: { data: [] } }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'GET',
        path: '/customers',
        query: { limit: 10, status: undefined },
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('limit=10');
      expect(url).not.toContain('status');
    });

    it('adds x-api-key header', async () => {
      mockFetch = createMockFetch([{ status: 200, body: {} }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'GET',
        path: '/customers',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('test_api_key');
    });

    it('adds idempotency key for POST requests', async () => {
      mockFetch = createMockFetch([{ status: 201, body: {} }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'POST',
        path: '/customers',
        body: {},
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('uses custom idempotency key when provided', async () => {
      mockFetch = createMockFetch([{ status: 201, body: {} }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'POST',
        path: '/customers',
        body: {},
        idempotencyKey: 'custom-key-123',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBe('custom-key-123');
    });

    it('does not add idempotency key for GET requests', async () => {
      mockFetch = createMockFetch([{ status: 200, body: {} }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'GET',
        path: '/customers',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBeUndefined();
    });

    it('handles 204 No Content', async () => {
      mockFetch = createMockFetch([{ status: 204 }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const result = await transport.request({
        method: 'DELETE',
        path: '/customers/123',
      });

      expect(result).toBeUndefined();
    });

    it('throws APIError for 4xx responses', async () => {
      mockFetch = createMockFetch([
        {
          status: 404,
          body: {
            type: 'https://docs.dakota.xyz/api-reference/errors#not-found',
            title: 'Not Found',
            detail: 'Customer not found',
          },
          headers: { 'x-request-id': 'req_123' },
        },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await expect(
        transport.request({
          method: 'GET',
          path: '/customers/invalid',
        })
      ).rejects.toThrow(APIError);
    });

    it('throws TransportError for network errors', async () => {
      const errorFetch = vi.fn(async () => {
        throw new Error('Network error');
      });
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: errorFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await expect(
        transport.request({
          method: 'GET',
          path: '/customers',
        })
      ).rejects.toThrow(TransportError);
    });
  });

  describe('retry behavior', () => {
    it('retries on 429 Too Many Requests', async () => {
      mockFetch = createMockFetch([
        { status: 429, body: { message: 'Rate limited' } },
        { status: 429, body: { message: 'Rate limited' } },
        { status: 200, body: { data: [] } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const result = await transport.request({
        method: 'GET',
        path: '/customers',
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: [] });
    });

    it('retries on 503 Service Unavailable', async () => {
      mockFetch = createMockFetch([
        { status: 503, body: { message: 'Service unavailable' } },
        { status: 200, body: { data: [] } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const result = await transport.request({
        method: 'GET',
        path: '/customers',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: [] });
    });

    it('respects Retry-After header in seconds', async () => {
      mockFetch = createMockFetch([
        { status: 429, body: {}, headers: { 'retry-after': '1' } },
        { status: 200, body: { data: [] } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const start = Date.now();
      await transport.request({
        method: 'GET',
        path: '/customers',
      });
      const elapsed = Date.now() - start;

      // Should wait at least 1 second (retry-after header)
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it('stops retrying after maxAttempts', async () => {
      mockFetch = createMockFetch([
        { status: 503, body: {} },
        { status: 503, body: {} },
        { status: 503, body: {} },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await expect(
        transport.request({
          method: 'GET',
          path: '/customers',
        })
      ).rejects.toThrow(APIError);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry 400 Bad Request', async () => {
      mockFetch = createMockFetch([
        { status: 400, body: { message: 'Bad request' } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await expect(
        transport.request({
          method: 'GET',
          path: '/customers',
        })
      ).rejects.toThrow(APIError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry POST without idempotency key on 503', async () => {
      mockFetch = createMockFetch([
        { status: 503, body: {} },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        automaticIdempotency: false,
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      const noIdempotencyTransport = new Transport(config);

      await expect(
        noIdempotencyTransport.request({
          method: 'POST',
          path: '/customers',
          body: {},
        })
      ).rejects.toThrow(APIError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries POST with idempotency key on 503', async () => {
      mockFetch = createMockFetch([
        { status: 503, body: {} },
        { status: 201, body: { id: '1' } },
      ]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        retryPolicy: { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 50 },
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      const result = await transport.request({
        method: 'POST',
        path: '/customers',
        body: {},
        idempotencyKey: 'key-123',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: '1' });
    });
  });
});
