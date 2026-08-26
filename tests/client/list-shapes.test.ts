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

/**
 * `GET /transactions` serves three resource families from one path, and the
 * family decides the row shape. With `transaction_type` absent the SERVER
 * infers it from the other filters, and `customer_id` on its own infers
 * `auto_account` — so the obvious spelling of "this customer's one-off
 * transactions" came back as their auto-account ones, parsed into the
 * one-off type with missing fields rather than failing.
 */
describe('transaction family selection', () => {
  const PAGE = (transactionType: string) => ({
    status: 200,
    body: {
      data: [{ id: 'tx_1' }],
      meta: { has_more_after: false, transaction_type: transactionType },
    },
  });

  it('names the one_off family rather than letting customer_id infer another', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /transactions': () => PAGE('one_off'),
    });
    const client = makeClient(fetch);

    await client.transactions.list({ customer_id: 'cust_1' }).toArray();

    expect(requests[0]?.query.transaction_type).toBe('one_off');
    expect(requests[0]?.query.customer_id).toBe('cust_1');
  });

  it('names one_off on a bare list too', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /transactions': () => PAGE('one_off'),
    });
    const client = makeClient(fetch);

    await client.transactions.list().toArray();

    expect(requests[0]?.query.transaction_type).toBe('one_off');
  });

  it('passes an explicitly requested family through untouched', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /transactions': () => PAGE('wallet'),
    });
    const client = makeClient(fetch);

    await client.transactions
      .list({ transaction_type: 'wallet', wallet_id: 'wal_1', direction: 'out' })
      .toArray();

    expect(requests[0]?.query.transaction_type).toBe('wallet');
    expect(requests[0]?.query.wallet_id).toBe('wal_1');
    expect(requests[0]?.query.direction).toBe('out');
  });

  it('throws when the server reports a different family than the one asked for', async () => {
    const { fetch } = createRoutedFetch({
      'GET /transactions': () => PAGE('auto_account'),
    });
    const client = makeClient(fetch);

    await expect(client.transactions.list({ customer_id: 'cust_1' }).toArray()).rejects.toThrow(
      /Asked for one_off transactions but the server listed auto_account/
    );
  });

  it('accepts a page whose meta does not name a family', async () => {
    // Silence is not a mismatch: a response that says nothing about its
    // family has not claimed to have served the wrong one, and failing here
    // would break every server that omits the field.
    const { fetch } = createRoutedFetch({
      'GET /transactions': () => ({
        status: 200,
        body: { data: [{ id: 'tx_1' }], meta: { has_more_after: false } },
      }),
    });
    const client = makeClient(fetch);

    const rows = await client.transactions.list().toArray();

    expect(rows.map((t) => t.id)).toEqual(['tx_1']);
  });
});
