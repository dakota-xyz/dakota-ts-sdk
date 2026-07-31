/**
 * List-endpoint response-shape tests.
 *
 * Most Dakota list endpoints answer with the `{data, meta}` envelope, but a
 * few answer with a BARE ARRAY — `GET /mandates` and
 * `GET /wallets/{id}/signer-groups` today. The paginator has to handle both,
 * because the failure mode when it does not is the worst kind: reading
 * `.data` off an array yields undefined, the page comes back empty, and the
 * caller gets zero results with no error at all for records that plainly
 * exist and that `get(id)` returns fine.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import { createRoutedFetch } from '../agentic/helpers.js';

function makeClient(fetchImpl: unknown) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl as typeof fetch,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

const MANDATES = [
  { id: 'mandate_1', status: 'active', version: 1 },
  { id: 'mandate_2', status: 'pending', version: 1 },
];

describe('bare-array list endpoints', () => {
  it('mandates.list() yields the mandates when /mandates returns a bare array', async () => {
    const { fetch } = createRoutedFetch({
      'GET /mandates': () => ({ status: 200, body: MANDATES }),
    });
    const client = makeClient(fetch);

    const all = await client.mandates.list().toArray();

    expect(all).toHaveLength(2);
    expect(all.map((m) => m.id)).toEqual(['mandate_1', 'mandate_2']);
  });

  it('async iteration over a bare array visits every row', async () => {
    const { fetch } = createRoutedFetch({
      'GET /mandates': () => ({ status: 200, body: MANDATES }),
    });
    const client = makeClient(fetch);

    const seen: string[] = [];
    for await (const m of client.mandates.list()) {
      seen.push(m.id!);
    }

    expect(seen).toEqual(['mandate_1', 'mandate_2']);
  });

  it('first() returns the first row rather than null', async () => {
    const { fetch } = createRoutedFetch({
      'GET /mandates': () => ({ status: 200, body: MANDATES }),
    });
    const client = makeClient(fetch);

    expect((await client.mandates.list().first())?.id).toBe('mandate_1');
  });

  it('a bare array is one COMPLETE page — it must not be re-fetched forever', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /mandates': () => ({ status: 200, body: MANDATES }),
    });
    const client = makeClient(fetch);

    await client.mandates.list().toArray();

    // No cursor to follow, so exactly one request: an array response carries
    // no `meta.has_more_after`, which correctly reads as false.
    expect(requests.filter((r) => r.path === '/mandates')).toHaveLength(1);
  });

  it('signerGroups.listForWallet() has the same shape and must work too', async () => {
    const { fetch } = createRoutedFetch({
      'GET /wallets/wlt_1/signer-groups': () => ({
        status: 200,
        body: [{ id: 'sg_1', name: 'Approvers' }],
      }),
    });
    const client = makeClient(fetch);

    const groups = await client.signerGroups.listForWallet('wlt_1').toArray();

    expect(groups.map((g) => g.id)).toEqual(['sg_1']);
  });

  it('an empty bare array is still empty — the fix must not invent rows', async () => {
    const { fetch } = createRoutedFetch({
      'GET /mandates': () => ({ status: 200, body: [] }),
    });
    const client = makeClient(fetch);

    expect(await client.mandates.list().toArray()).toEqual([]);
  });

  it('the enveloped endpoints keep working, including their cursor', async () => {
    let page = 0;
    const { fetch } = createRoutedFetch({
      'GET /customers': () => {
        const first = page++ === 0;
        return {
          status: 200,
          body: first
            ? { data: [{ id: 'cst_1' }], meta: { has_more_after: true } }
            : { data: [{ id: 'cst_2' }], meta: { has_more_after: false } },
        };
      },
    });
    const client = makeClient(fetch);

    const all = await client.customers.list().toArray();

    expect(all.map((c) => c.id)).toEqual(['cst_1', 'cst_2']);
  });
});
