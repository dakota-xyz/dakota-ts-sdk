/**
 * The surface the 2026-09 spec sync brought in: withdrawing an onboarding
 * application, the RD marketing-fee payout destination, and the sandbox's
 * SWIFT simulation types.
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

describe('withdrawing an onboarding application', () => {
  it('posts the reason to the customer-scoped withdraw route', async () => {
    const { fetch, requests } = createRoutedFetch({
      'POST /customers/cust_1/applications/app_1/withdraw': () => ({ status: 200 }),
    });
    const client = makeClient(fetch);

    await client.customers.withdrawApplication('cust_1', 'app_1', {
      reason: 'Customer opted not to proceed',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.body).toEqual({ reason: 'Customer opted not to proceed' });
  });

  it('sends an empty object when no reason is given — the body is required', async () => {
    const { fetch, requests } = createRoutedFetch({
      'POST /customers/cust_1/applications/app_1/withdraw': () => ({ status: 200 }),
    });
    const client = makeClient(fetch);

    await client.customers.withdrawApplication('cust_1', 'app_1');

    expect(requests[0]?.body).toEqual({});
  });

  it('surfaces the 409 for an application that already has a decision', async () => {
    const { fetch } = createRoutedFetch({
      'POST /customers/cust_1/applications/app_1/withdraw': () => ({
        status: 409,
        body: {
          type: 'https://docs.dakota.xyz/api-reference/errors#conflict',
          title: 'Conflict',
          status: 409,
          detail: 'application already has a decision',
        },
      }),
    });
    const client = makeClient(fetch);

    await expect(client.customers.withdrawApplication('cust_1', 'app_1')).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('RD marketing-fee payout destination', () => {
  it('getPayoutDestination() reads the registered wallet', async () => {
    const { fetch } = createRoutedFetch({
      'GET /rd-marketing-fee/payout-destination': () => ({
        status: 200,
        body: {
          chain: 'eip155:8453',
          address: '0x1234567890123456789012345678901234567890',
          updated_at: '2026-08-20T12:00:00Z',
        },
      }),
    });
    const client = makeClient(fetch);

    const dest = await client.rdMarketingFee.getPayoutDestination();

    expect(dest.chain).toBe('eip155:8453');
    expect(dest.address).toBe('0x1234567890123456789012345678901234567890');
  });

  it('a 404 is the ordinary "nothing registered yet" state, surfaced as an APIError', async () => {
    const { fetch } = createRoutedFetch({
      'GET /rd-marketing-fee/payout-destination': () => ({
        status: 404,
        body: {
          type: 'https://docs.dakota.xyz/api-reference/errors#not-found',
          title: 'Not Found',
          status: 404,
          detail: 'no destination is registered',
        },
      }),
    });
    const client = makeClient(fetch);

    const error = await client.rdMarketingFee.getPayoutDestination().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).statusCode).toBe(404);
  });

  it('setPayoutDestination() PUTs only the address — the chain is not a parameter', async () => {
    const { fetch, requests } = createRoutedFetch({
      'PUT /rd-marketing-fee/payout-destination': (req) => ({
        status: 200,
        body: {
          chain: 'eip155:8453',
          address: (req.body as { address: string }).address,
          updated_at: '2026-08-20T12:00:00Z',
        },
      }),
    });
    const client = makeClient(fetch);

    const dest = await client.rdMarketingFee.setPayoutDestination(
      { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
      { idempotencyKey: '4c1e3a3e-8f4e-4d2b-9d1b-0f2b8a7f9e11' }
    );

    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.body).toEqual({ address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' });
    expect(requests[0]?.headers['x-idempotency-key']).toBe('4c1e3a3e-8f4e-4d2b-9d1b-0f2b8a7f9e11');
    expect(dest.chain).toBe('eip155:8453');
  });
});

describe('sandbox SWIFT simulation', () => {
  it('accepts swift_inbound against an onramp account', async () => {
    const { fetch, requests } = createRoutedFetch({
      'POST /sandbox/simulate/inbound': () => ({
        status: 200,
        body: { simulation_id: 'sim_swift_1', state: 'accepted' },
      }),
    });
    const client = makeClient(fetch);

    const result = await client.sandbox.simulateInbound({
      simulation_id: 'sim_swift_1',
      type: 'swift_inbound',
      account_id: 'acc_swift',
      amount: '2500.00',
      currency: 'USD',
    });

    expect(result.state).toBe('accepted');
    expect(requests[0]?.body).toMatchObject({ type: 'swift_inbound', account_id: 'acc_swift' });
  });

  it('accepts a swift outbound return keyed on the spec field names', async () => {
    const { fetch, requests } = createRoutedFetch({
      'POST /sandbox/simulate/inbound': () => ({
        status: 200,
        body: { simulation_id: 'sim_swift_2', state: 'accepted' },
      }),
    });
    const client = makeClient(fetch);

    await client.sandbox.simulateInbound({
      simulation_id: 'sim_swift_2',
      type: 'swift_outbound_returned',
      account_id: 'acc_offramp',
      one_off_transaction_id: '2NfHrqBHb3cTfLVkFSGmHZqdDQ7',
      amount: '2500.00',
      currency: 'USD',
    });

    expect(requests[0]?.body).toMatchObject({
      type: 'swift_outbound_returned',
      account_id: 'acc_offramp',
      one_off_transaction_id: '2NfHrqBHb3cTfLVkFSGmHZqdDQ7',
    });
  });
});
