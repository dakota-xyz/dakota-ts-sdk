/**
 * Test helpers for the agentic layer — a routed mock fetch that dispatches
 * on `${method} ${pathname}` so we can simulate the small set of endpoints
 * the agentic helpers touch (payment agents, mandates, signer groups).
 */

import { vi } from 'vitest';

export interface RecordedRequest {
  method: string;
  path: string;
  body?: unknown;
  headers: Record<string, string>;
}

export type MockRouteHandler = (
  req: RecordedRequest
) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

/**
 * Build a mock fetch dispatched on `${method} ${pathname}`. Recorded
 * requests land in the returned `requests` array.
 *
 * @param routes - map of `"METHOD /path"` -> handler
 * @param fallback - optional handler for unmatched requests (defaults to 404)
 */
export function createRoutedFetch(
  routes: Record<string, MockRouteHandler>,
  fallback?: MockRouteHandler
): {
  fetch: ReturnType<typeof vi.fn>;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchImpl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input)
    );
    const method = (init?.method ?? 'GET').toUpperCase();
    const bodyStr = init?.body ? String(init.body) : undefined;
    const record: RecordedRequest = {
      method,
      path: url.pathname,
      body: bodyStr ? safeJson(bodyStr) : undefined,
      headers: normalizeHeaders(init?.headers),
    };
    requests.push(record);

    const handler = routes[`${method} ${url.pathname}`] ?? fallback;
    if (!handler) {
      return new Response(JSON.stringify({ error: `no route for ${method} ${url.pathname}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const result = await handler(record);
    return new Response(result.body !== undefined ? JSON.stringify(result.body) : null, {
      status: result.status,
      headers: { 'content-type': 'application/json' },
    });
  };

  const mock = vi.fn();
  mock.mockImplementation(fetchImpl);
  return { fetch: mock, requests };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function normalizeHeaders(input: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  if (input instanceof Headers) {
    input.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(input)) {
    for (const pair of input) {
      const [key, value] = pair as [string, string];
      out[key.toLowerCase()] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(input)) {
    out[key.toLowerCase()] = String(value);
  }
  return out;
}
