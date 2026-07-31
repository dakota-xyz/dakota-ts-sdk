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
      mockFetch = createMockFetch([{ status: 200, body: { data: [{ id: '1', name: 'Test' }] } }]);
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
      mockFetch = createMockFetch([{ status: 201, body: { id: '1', name: 'New Customer' } }]);
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

    it('adds idempotency key for PUT requests', async () => {
      mockFetch = createMockFetch([{ status: 204 }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'PUT',
        path: '/policies/pol_1/wallets/wal_1',
        idempotencyKey: 'attach-key-1',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBe('attach-key-1');
    });

    it('adds idempotency key for PATCH requests', async () => {
      mockFetch = createMockFetch([{ status: 200, body: {} }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'PATCH',
        path: '/policies/pol_1/rules/rule_1',
        body: {},
        idempotencyKey: 'update-key-1',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBe('update-key-1');
    });

    it('auto-generates idempotency key for PUT when automaticIdempotency is enabled', async () => {
      mockFetch = createMockFetch([{ status: 204 }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'PUT',
        path: '/policies/pol_1/wallets/wal_1',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('auto-generates idempotency key for DELETE requests (agentic detach requires it)', async () => {
      mockFetch = createMockFetch([{ status: 204 }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'DELETE',
        path: '/signer-groups/g1/signers/s1',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('uses custom idempotency key for DELETE when provided', async () => {
      mockFetch = createMockFetch([{ status: 204 }]);
      const config = resolveConfig({
        apiKey: 'test_api_key',
        fetch: mockFetch as unknown as typeof fetch,
      });
      transport = new Transport(config);

      await transport.request({
        method: 'DELETE',
        path: '/signer-groups/g1/signers/s1',
        idempotencyKey: 'detach-key-1',
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-idempotency-key']).toBe('detach-key-1');
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
      mockFetch = createMockFetch([{ status: 400, body: { message: 'Bad request' } }]);
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
      mockFetch = createMockFetch([{ status: 503, body: {} }]);
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

  describe('timeout resolution', () => {
    // A fetch that never settles until aborted — the only honest way to
    // exercise a deadline.
    function hangingFetch(): {
      fetch: ReturnType<typeof vi.fn<[unknown, RequestInit?], Promise<Response>>>;
      deadlines: number[];
    } {
      const deadlines: number[] = [];
      const fetch = vi.fn((_url: unknown, init?: RequestInit): Promise<Response> => {
        const started = Date.now();
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            deadlines.push(Date.now() - started);
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });
      return { fetch, deadlines };
    }

    function transportWith(configOverrides: Record<string, unknown>, fetchImpl: unknown) {
      return new Transport(
        resolveConfig({
          apiKey: 'test_api_key',
          retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
          fetch: fetchImpl as typeof fetch,
          ...configOverrides,
        })
      );
    }

    it('names the elapsed deadline and how to change it, so it is not read as a server error', async () => {
      const { fetch } = hangingFetch();
      const t = transportWith({ timeout: 30 }, fetch);

      await expect(t.request({ method: 'GET', path: '/customers' })).rejects.toThrow(
        /timed out after 30ms/
      );
      await expect(t.request({ method: 'GET', path: '/customers' })).rejects.toThrow(
        /client-side deadline/
      );
    });

    it('a per-request timeout beats the client-wide one', async () => {
      const { fetch, deadlines } = hangingFetch();
      const t = transportWith({ timeout: 5000 }, fetch);

      await expect(t.request({ method: 'GET', path: '/customers', timeout: 40 })).rejects.toThrow(
        /timed out after 40ms/
      );
      // Actually aborted at ~40ms, not the configured 5s.
      expect(deadlines[0]).toBeLessThan(1000);
    });

    it('an endpoint default applies when the caller configured no timeout', async () => {
      const { fetch } = hangingFetch();
      const t = transportWith({}, fetch); // no explicit timeout

      await expect(t.request({ method: 'GET', path: '/x', endpointTimeout: 25 })).rejects.toThrow(
        /timed out after 25ms/
      );
    });

    it('an EXPLICIT client timeout beats an endpoint default — the caller chose it', async () => {
      const { fetch } = hangingFetch();
      const t = transportWith({ timeout: 20 }, fetch);

      // The endpoint would like 60s; the caller said 20ms and wins.
      await expect(
        t.request({ method: 'GET', path: '/x', endpointTimeout: 60_000 })
      ).rejects.toThrow(/timed out after 20ms/);
    });

    it('a per-request timeout still beats an explicit client timeout', async () => {
      const { fetch } = hangingFetch();
      const t = transportWith({ timeout: 20 }, fetch);

      await expect(
        t.request({ method: 'GET', path: '/x', timeout: 45, endpointTimeout: 60_000 })
      ).rejects.toThrow(/timed out after 45ms/);
    });

    it('reports a caller abort as a cancellation, and does not retry it', async () => {
      const { fetch } = hangingFetch();
      const t = new Transport(
        resolveConfig({
          apiKey: 'test_api_key',
          timeout: 60_000, // long, so only the caller's abort can fire
          retryPolicy: { maxAttempts: 3, initialBackoffMs: 1, maxBackoffMs: 1 },
          fetch: fetch as unknown as typeof fetch,
        })
      );

      const controller = new AbortController();
      const pending = t.request({ method: 'GET', path: '/customers', signal: controller.signal });
      controller.abort();

      await expect(pending).rejects.toThrow(TransportError);
      await expect(pending).rejects.toThrow(/aborted by caller/);
      // Re-issuing a request the caller explicitly called off would be wrong.
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
