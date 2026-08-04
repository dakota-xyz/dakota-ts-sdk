/**
 * Agentic client-policy resource tests (ALPHA).
 *
 * The registration is a FULL REPLACE, and its whole reason for existing is
 * that the per-request copy fails silently when you forget it. Both of those
 * are asserted here.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import { APIError } from '../../src/client/errors.js';
import { createRoutedFetch } from '../agentic/helpers.js';

const PATH = '/agentic-policy';

function makeClient(fetchImpl: unknown) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl as typeof fetch,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

const POLICY = {
  payee_model: 'flat' as const,
  payout_assets: ['USDC', 'USDT'],
  labels: { limit: 'spending limit', payee: 'recipient', limit_unit: 'USD' },
  payout_route: 'conversion_account_only' as const,
};

describe('agenticPolicy', () => {
  it('addresses /agentic-policy — the client comes from the API key, never a path id', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET ${PATH}`]: () => ({ status: 200, body: { policy: {} } }),
      [`PUT ${PATH}`]: () => ({ status: 200, body: { policy: {} } }),
    });
    const client = makeClient(fetch);

    await client.agenticPolicy.get();
    await client.agenticPolicy.set({});

    // The platform router registers exactly this. A client-scoped path 404s,
    // which is what shipped in 2.2.0.
    expect(requests.map((r) => r.path)).toEqual(['/agentic-policy', '/agentic-policy']);
    expect(requests.every((r) => !r.path.includes('/clients/'))).toBe(true);
  });

  it('registers a policy and returns the NORMALIZED stored form', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`PUT ${PATH}`]: (req) => ({
        status: 200,
        // The server normalizes defaults away, so the response is not an
        // echo — a caller must read `policy`, not assume what it sent.
        body: { policy: req.body, created_at: 1754000000, updated_at: 1754000000 },
      }),
    });
    const client = makeClient(fetch);

    const registered = await client.agenticPolicy.set(POLICY);

    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.body).toEqual(POLICY);
    expect(registered.policy).toEqual(POLICY);
    expect(registered.updated_at).toBe(1754000000);
  });

  it('sends an idempotency key on the PUT (the platform requires one)', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`PUT ${PATH}`]: () => ({ status: 200, body: { policy: {} } }),
    });

    await makeClient(fetch).agenticPolicy.set(POLICY, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });

    expect(requests[0]?.headers['x-idempotency-key']).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('clears the registration with an empty body — a replace, never a merge', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`PUT ${PATH}`]: () => ({ status: 200, body: { policy: {} } }),
    });

    const registered = await makeClient(fetch).agenticPolicy.set({});

    // An omitted field means "no longer wanted", so `{}` must reach the wire
    // as `{}` rather than being dropped or merged into anything.
    expect(requests[0]?.body).toEqual({});
    expect(registered.policy).toEqual({});
  });

  it('reads the registered policy back', async () => {
    const { fetch } = createRoutedFetch({
      [`GET ${PATH}`]: () => ({
        status: 200,
        body: { policy: POLICY, created_at: 1, updated_at: 2 },
      }),
    });

    const got = await makeClient(fetch).agenticPolicy.get();

    expect(got.policy.labels?.payee).toBe('recipient');
  });

  it('surfaces "no registration" as a 404 the caller can distinguish', async () => {
    const { fetch } = createRoutedFetch({
      [`GET ${PATH}`]: () => ({
        status: 404,
        body: { title: 'Not Found', detail: 'This client has no registered policy.' },
      }),
    });

    // Not an error condition — it is the default. Callers branch on the
    // status, so it must arrive as a typed APIError rather than a throw
    // that looks like a transport failure.
    const err = await makeClient(fetch)
      .agenticPolicy.get()
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(APIError);
    expect((err as APIError).statusCode).toBe(404);
  });

  it('surfaces a rejected policy as a 400 at registration time', async () => {
    const { fetch } = createRoutedFetch({
      [`PUT ${PATH}`]: () => ({
        status: 400,
        body: { title: 'Bad Request', detail: 'unknown label concept "reciepient"' },
      }),
    });

    const err = await makeClient(fetch)
      .agenticPolicy.set({ labels: { payee: 'x' } })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(APIError);
    expect((err as APIError).statusCode).toBe(400);
  });
});
