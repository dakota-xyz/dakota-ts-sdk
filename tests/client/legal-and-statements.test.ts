/**
 * The surface the platform added while the vendored spec sat still:
 * legal documents, the legal-acceptance context, RD marketing-fee statements,
 * the unified customer status header, and the ledger's cursor tiebreaker.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import { APIError } from '../../src/client/errors.js';
import { createRoutedFetch } from '../agentic/helpers.js';

function makeClient(fetchImpl: unknown) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl as typeof fetch,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

describe('legal documents', () => {
  it('list() unwraps the data envelope', async () => {
    const { fetch } = createRoutedFetch({
      'GET /legal/documents': () => ({
        status: 200,
        body: {
          data: [
            {
              key: 'dakota_tos',
              version: '2026-08-04',
              revision: 5,
              content_type: 'text/markdown',
            },
            {
              key: 'dakota_privacy',
              version: '2026-07-23',
              revision: 3,
              content_type: 'text/markdown',
            },
          ],
        },
      }),
    });
    const client = makeClient(fetch);

    const docs = await client.legal.list();

    expect(docs.map((d) => d.key)).toEqual(['dakota_tos', 'dakota_privacy']);
  });

  it('list() returns an empty array rather than undefined on an empty body', async () => {
    const { fetch } = createRoutedFetch({
      'GET /legal/documents': () => ({ status: 200, body: {} }),
    });
    const client = makeClient(fetch);

    await expect(client.legal.list()).resolves.toEqual([]);
  });

  it('get() asks for the in-force revision when no version is given', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /legal/documents/dakota_tos': () => ({
        status: 200,
        body: { key: 'dakota_tos', version: '2026-08-04', revision: 5, content: '# Terms' },
      }),
    });
    const client = makeClient(fetch);

    const doc = await client.legal.get('dakota_tos');

    expect(doc.content).toBe('# Terms');
    expect(requests[0]?.query.version).toBeUndefined();
  });

  it('get() pins an explicit revision', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /legal/documents/dakota_tos': () => ({
        status: 200,
        body: { key: 'dakota_tos', version: '2026-07-23', revision: 4 },
      }),
    });
    const client = makeClient(fetch);

    await client.legal.get('dakota_tos', '2026-07-23');

    expect(requests[0]?.query.version).toBe('2026-07-23');
  });
});

describe('legal acceptance context', () => {
  it('reads the acceptance page context without reading the application', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /applications/app_1/legal-acceptance': () => ({
        status: 200,
        body: {
          application_type: 'business',
          outstanding_documents: [
            {
              key: 'dakota_tos',
              title: 'Dakota Terms of Service',
              version: '2026-09',
              revision: 4,
            },
          ],
          accepted_agreements: [{ attestation_type: 'e_sign', version: '2025-11' }],
          attestors: [{ id: 'ind_1', name: 'Ada Lovelace' }],
        },
      }),
    });
    const client = makeClient(fetch);

    const ctx = await client.applications.getLegalAcceptance('app_1');

    expect(ctx.application_type).toBe('business');
    expect(ctx.outstanding_documents[0]?.key).toBe('dakota_tos');
    expect(ctx.attestors[0]?.name).toBe('Ada Lovelace');
    // The point of the endpoint: the KYB record is never fetched.
    expect(requests.map((r) => r.path)).toEqual(['/applications/app_1/legal-acceptance']);
  });
});

describe('RD marketing fee statements', () => {
  it('listMonths() unwraps months, newest first', async () => {
    const { fetch } = createRoutedFetch({
      'GET /rd-marketing-fee/statements': () => ({
        status: 200,
        body: { months: ['2026-08-01', '2026-07-01'] },
      }),
    });
    const client = makeClient(fetch);

    await expect(client.rdMarketingFee.listMonths()).resolves.toEqual(['2026-08-01', '2026-07-01']);
  });

  it('an empty month list is not an error — the contract starts later', async () => {
    const { fetch } = createRoutedFetch({
      'GET /rd-marketing-fee/statements': () => ({ status: 200, body: { months: [] } }),
    });
    const client = makeClient(fetch);

    await expect(client.rdMarketingFee.listMonths()).resolves.toEqual([]);
  });

  it('getStatement() keeps an unstamped day absent rather than zero', async () => {
    const { fetch } = createRoutedFetch({
      'GET /rd-marketing-fee/statements/2026-08-01': () => ({
        status: 200,
        body: {
          month: '2026-08-01',
          y_bps_monthly: 15,
          days_in_month: 31,
          days_stamped: 2,
          daily: [
            { date: '2026-08-01', balance_minor: '1250000' },
            { date: '2026-08-02', balance_minor: '0' },
            { date: '2026-08-03' },
          ],
        },
      }),
    });
    const client = makeClient(fetch);

    const statement = await client.rdMarketingFee.getStatement('2026-08-01');

    // "0" means the client held no RD; absent means the day is not derived
    // yet. Different facts, and the SDK must not flatten them together.
    expect(statement.daily[1]?.balance_minor).toBe('0');
    expect(statement.daily[2]?.balance_minor).toBeUndefined();
  });
});

describe('customer status header', () => {
  it('listPage() surfaces status_counts, which the row iterator drops', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /customers': () => ({
        status: 200,
        body: {
          data: [{ id: 'cust_1', status: 'info_requested' }],
          meta: { has_more_after: false },
          status_counts: { approved: 128, info_requested: 7 },
        },
      }),
    });
    const client = makeClient(fetch);

    const page = await client.customers.listPage({ status: 'info_requested,frozen', limit: 25 });

    expect(page.status_counts?.approved).toBe(128);
    expect(page.data[0]?.id).toBe('cust_1');
    expect(requests[0]?.query.status).toBe('info_requested,frozen');
    expect(requests[0]?.query.limit).toBe('25');
  });

  it('list() passes the unified status filter through', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /customers': () => ({
        status: 200,
        body: { data: [], meta: { has_more_after: false } },
      }),
    });
    const client = makeClient(fetch);

    await client.customers
      .list({ status: 'frozen', sort_by: 'created_at', sort_dir: 'desc' })
      .toArray();

    expect(requests[0]?.query.status).toBe('frozen');
    expect(requests[0]?.query.sort_by).toBe('created_at');
    expect(requests[0]?.query.sort_dir).toBe('desc');
  });
});

describe('self-serve ledger paging', () => {
  it('sends cursor_id alongside cursor', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /self-serve/credits/ledger': () => ({
        status: 200,
        body: { entries: [], has_more: false },
      }),
    });
    const client = makeClient(fetch);

    await client.selfServe.listLedger({ cursor: '2026-08-01T00:00:00Z', cursor_id: 'led_9' });

    expect(requests[0]?.query.cursor).toBe('2026-08-01T00:00:00Z');
    expect(requests[0]?.query.cursor_id).toBe('led_9');
  });
});

describe('problem details extensions', () => {
  it('APIError carries user_message and resolution_url', async () => {
    const { fetch } = createRoutedFetch({
      'GET /customers/cust_1': () => ({
        status: 403,
        body: {
          type: 'https://docs.dakota.xyz/api-reference/errors#terms-not-accepted',
          title: 'Terms Not Accepted',
          status: 403,
          detail: 'Customer cust_1 has not accepted attestation_type=terms_of_service.',
          user_message: 'Please accept the updated Terms of Service to continue.',
          resolution_url: 'https://onboarding.dakota.xyz/applications/app_1?token=tok_1',
        },
      }),
    });
    const client = makeClient(fetch);

    const err = await client.customers.get('cust_1').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(APIError);
    const apiErr = err as APIError;
    expect(apiErr.code).toBe('terms-not-accepted');
    // The machine-facing rendition stays on `message`...
    expect(apiErr.message).toContain('attestation_type=terms_of_service');
    // ...and the one to show a person is separate.
    expect(apiErr.userMessage).toBe('Please accept the updated Terms of Service to continue.');
    expect(apiErr.resolutionUrl).toBe(
      'https://onboarding.dakota.xyz/applications/app_1?token=tok_1'
    );
  });

  it('both are null when the problem carries neither', async () => {
    const { fetch } = createRoutedFetch({
      'GET /customers/cust_1': () => ({
        status: 404,
        body: {
          type: 'https://docs.dakota.xyz/api-reference/errors#not-found',
          title: 'Customer Not Found',
          status: 404,
        },
      }),
    });
    const client = makeClient(fetch);

    const err = (await client.customers.get('cust_1').catch((e: unknown) => e)) as APIError;

    expect(err.userMessage).toBeNull();
    expect(err.resolutionUrl).toBeNull();
  });
});

/**
 * Filters the spec has carried for a while that the typed surface never
 * named. `ListParams` has an index signature, so these always reached the
 * wire if you knew to pass them — they were just undiscoverable and untyped.
 */
describe('previously untyped list filters', () => {
  const EMPTY = () => ({ status: 200, body: { data: [], meta: { has_more_after: false } } });

  it('auto-transactions takes its filters, with epoch-second dates', async () => {
    const { fetch, requests } = createRoutedFetch({ 'GET /auto-transactions': EMPTY });
    const client = makeClient(fetch);

    await client.autoTransactions
      .list({
        auto_account_id: 'acct_1',
        statuses: 'pending,processing',
        types: 'onramp,offramp',
        start_date: 1_760_000_000,
        outgoing_amount_min: '100.00',
        sort_dir: 'desc',
      })
      .toArray();

    const q = requests[0]?.query;
    expect(q?.auto_account_id).toBe('acct_1');
    expect(q?.statuses).toBe('pending,processing');
    expect(q?.types).toBe('onramp,offramp');
    // Epoch SECONDS here, unlike the ISO strings every other list takes.
    expect(q?.start_date).toBe('1760000000');
    expect(q?.outgoing_amount_min).toBe('100.00');
    expect(q?.sort_dir).toBe('desc');
  });

  it('users takes search, roles, and sorting', async () => {
    const { fetch, requests } = createRoutedFetch({ 'GET /users': EMPTY });
    const client = makeClient(fetch);

    await client.users.list({ search: 'ada', roles: 'admin,member', sort_by: 'email' }).toArray();

    expect(requests[0]?.query.search).toBe('ada');
    expect(requests[0]?.query.roles).toBe('admin,member');
    expect(requests[0]?.query.sort_by).toBe('email');
  });

  it('destinations takes destination_type', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /recipients/rcp_1/destinations': EMPTY,
    });
    const client = makeClient(fetch);

    await client.destinations.list('rcp_1', { destination_type: 'crypto' }).toArray();

    expect(requests[0]?.query.destination_type).toBe('crypto');
  });

  it('scheduled payments take mandate_version and page', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /scheduled-payments': () => ({ status: 200, body: [] }),
    });
    const client = makeClient(fetch);

    await client.scheduledPayments
      .list({ mandate_id: 'mnd_1', mandate_version: 2, limit: 50, page: 2 })
      .toArray();

    expect(requests[0]?.query.mandate_version).toBe('2');
    expect(requests[0]?.query.page).toBe('2');
  });

  it('applications.get inlines only the sections asked for', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /applications/app_1': () => ({ status: 200, body: { id: 'app_1' } }),
    });
    const client = makeClient(fetch);

    await client.applications.get('app_1', { include: 'entities,validation' });

    expect(requests[0]?.query.include).toBe('entities,validation');
  });

  it('applications.get sends no include when none is asked for', async () => {
    const { fetch, requests } = createRoutedFetch({
      'GET /applications/app_1': () => ({ status: 200, body: { id: 'app_1' } }),
    });
    const client = makeClient(fetch);

    await client.applications.get('app_1');

    expect(requests[0]?.query.include).toBeUndefined();
  });
});
