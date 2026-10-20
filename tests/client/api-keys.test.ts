/**
 * API key names, last-used time and scopes (ENG-4792, platform ENG-3939 and
 * ENG-4790).
 */

import { describe, it, expect, expectTypeOf } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import type { ApiKey, ApiKeyScope } from '../../src/client/types.js';

function makeClient(fetchImpl: typeof fetch) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

/** A fetch that answers with the given bodies in turn and keeps each request. */
function capture(responses: unknown[]) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({
      method: init?.method ?? 'GET',
      path: new URL(String(input)).pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(responses[calls.length - 1]), {
      status: init?.method === 'POST' ? 201 : 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fetchImpl as unknown as typeof globalThis.fetch, calls };
}

describe('API keys', () => {
  it('creates a named key with a scope, renames it, and changes its scope', async () => {
    const id = '2jFh8KzLm4NpQ6RsTvWx9Ab';
    const listed = {
      id,
      user_id: '2kGi9LaXn5OrR7StUwYy0Bc',
      key_suffix: 'abc123',
      created_at: 1,
      name: 'payouts-v2',
      scope: 'read_only',
      last_used_at: null,
    };
    const { fetch, calls } = capture([
      { id, key: 'dk_live_abc', name: 'payouts', scope: 'operate' },
      { ...listed, scope: 'operate' },
      listed,
    ]);
    const client = makeClient(fetch);

    const created = await client.apiKeys.create({ name: 'payouts', scope: 'operate' });
    expect(created.scope).toBe('operate');
    await client.apiKeys.update(created.id, { name: 'payouts-v2' });
    const updated = await client.apiKeys.update(created.id, { scope: 'read_only' });
    expect(updated.scope).toBe('read_only');
    expect(updated.last_used_at).toBeNull();

    expect(calls).toEqual([
      { method: 'POST', path: '/api-keys', body: { name: 'payouts', scope: 'operate' } },
      { method: 'PATCH', path: `/api-keys/${id}`, body: { name: 'payouts-v2' } },
      { method: 'PATCH', path: `/api-keys/${id}`, body: { scope: 'read_only' } },
    ]);
  });

  it('types the scopes and the listed fields', () => {
    expectTypeOf<ApiKeyScope>().toEqualTypeOf<'full_access' | 'operate' | 'read_only'>();
    expectTypeOf<ApiKey['last_used_at']>().toEqualTypeOf<number | null>();
    expectTypeOf<ApiKey['name']>().toEqualTypeOf<string>();
  });
});
