/**
 * Developer-fee naming (ENG-3956, platform ENG-3899 / ENG-3900) and the fixed
 * developer fee (ENG-3918, platform ENG-3916 / ENG-4029).
 *
 * Receipts carry `developer_fee`, with `client_fee` deprecated but still sent
 * with the same value; accounts and one-offs report `developer_fee_bps`. The
 * agentic requests take `developer_fee_defaults` and the auto-account action
 * `developer_fee_bps`, with the old `developer_fee` / `fee_bps` still
 * accepted. These tests read both names, so code written against the old ones
 * keeps compiling as well as working.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import type { components } from '../../src/generated/api.js';
import type {
  Account,
  AccountCreateRequest,
  AccountUpdateRequest,
  OneOffTransaction,
  OneOffTransactionRequest,
  CreateInstructionsRequest,
  DeveloperFee,
  DeveloperFeeDefaults,
} from '../../src/client/types.js';
import { createRoutedFetch } from '../agentic/helpers.js';

type AmountDetails = components['schemas']['AmountDetails'];
type CreateAutoAccountAction = components['schemas']['CreateAutoAccountAction'];

const FEE = { amount: '1.25', asset: 'USDC', network: 'base-mainnet' };

function makeClient(fetchImpl: typeof fetch) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

describe('developer fee on REST responses', () => {
  it('a one-off receipt exposes developer_fee AND the deprecated client_fee', async () => {
    const { fetch } = createRoutedFetch({
      'GET /transactions/tx_1': () => ({
        status: 200,
        body: {
          id: 'tx_1',
          status: 'completed',
          developer_fee_bps: 50,
          receipt: { developer_fee: FEE, client_fee: FEE },
        },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const tx = await client.transactions.get('tx_1');

    expect(tx.developer_fee_bps).toBe(50);
    expect(tx.receipt?.developer_fee).toEqual(FEE);

    // Existing code reads client_fee as AmountDetails. The deprecated field is
    // an inline copy of that shape in the spec (so `deprecated` survives);
    // tsc enforces this, so the copy cannot drift from AmountDetails.
    type Receipt = NonNullable<typeof tx.receipt>;
    expectTypeOf<Receipt['client_fee']>().toEqualTypeOf<AmountDetails | undefined>();
    expectTypeOf<Receipt['developer_fee']>().toEqualTypeOf<AmountDetails | undefined>();
    expect(tx.receipt?.client_fee).toEqual(tx.receipt?.developer_fee);
  });

  it('an account exposes developer_fee_bps', async () => {
    const { fetch } = createRoutedFetch({
      'GET /accounts/acc_1': () => ({
        status: 200,
        body: { id: 'acc_1', account_type: 'onramp', developer_fee_bps: 0 },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const account = await client.accounts.get('acc_1');

    expect(account.developer_fee_bps).toBe(0);
  });
});

/**
 * Fixed developer fee (ENG-3918, platform ENG-3916 / ENG-4029). The fee is a
 * decimal STRING in units of the deposited asset: a number would lose the
 * two-decimal precision the platform validates, so the type must reject one
 * and the wire must carry a JSON string.
 */
describe('fixed developer fee', () => {
  /** A fetch that keeps the raw request body, so the wire bytes can be asserted. */
  function rawCapture(responseBody: unknown) {
    const bodies: string[] = [];
    const fetchImpl = async (_input: unknown, init?: RequestInit): Promise<Response> => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    return { fetch: fetchImpl as unknown as typeof globalThis.fetch, bodies };
  }

  it('the request and response fields are typed string, never number', () => {
    expectTypeOf<AccountCreateRequest['developer_fee_fixed']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AccountUpdateRequest['developer_fee_fixed']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<OneOffTransactionRequest['developer_fee_fixed']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<Account['developer_fee_fixed']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Account['minimum_deposit']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<OneOffTransaction['developer_fee_fixed']>().toEqualTypeOf<string | undefined>();

    // @ts-expect-error a number is not a fixed fee
    const numeric: AccountUpdateRequest['developer_fee_fixed'] = 10;
    expect(numeric).toBeDefined();
  });

  it('accounts.create sends developer_fee_fixed as a JSON string', async () => {
    const { fetch, bodies } = rawCapture({ id: 'acc_1', account_type: 'onramp' });
    const client = makeClient(fetch);

    await client.accounts.create({ account_type: 'onramp', developer_fee_fixed: '10.00' });

    expect(bodies[0]).toContain('"developer_fee_fixed":"10.00"');
  });

  it('accounts.update sends developer_fee_fixed as a JSON string', async () => {
    const { fetch, bodies } = rawCapture({ id: 'acc_1', account_type: 'onramp' });
    const client = makeClient(fetch);

    await client.accounts.update('acc_1', {
      account_type: 'onramp',
      developer_fee_fixed: '10.00',
    });

    expect(bodies[0]).toContain('"developer_fee_fixed":"10.00"');
  });

  it('transactions.create sends developer_fee_fixed as a JSON string', async () => {
    const { fetch, bodies } = rawCapture({ id: 'tx_1' });
    const client = makeClient(fetch);

    await client.transactions.create({
      customer_id: 'cus_1',
      source_network_id: 'ethereum-mainnet',
      source_asset: 'USDC',
      destination_id: 'dst_1',
      destination_asset: 'USD',
      developer_fee_fixed: '10.00',
    });

    expect(bodies[0]).toContain('"developer_fee_fixed":"10.00"');
  });

  it('a fixed-fee account exposes developer_fee_fixed and minimum_deposit', async () => {
    const { fetch } = createRoutedFetch({
      'GET /accounts/acc_1': () => ({
        status: 200,
        body: {
          id: 'acc_1',
          account_type: 'onramp',
          developer_fee_bps: 0,
          developer_fee_fixed: '10.00',
          minimum_deposit: '10.01',
        },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const account = await client.accounts.get('acc_1');

    expect(account.developer_fee_fixed).toBe('10.00');
    expect(account.minimum_deposit).toBe('10.01');
  });

  it('a bps account omits developer_fee_fixed and minimum_deposit', async () => {
    const { fetch } = createRoutedFetch({
      'GET /accounts/acc_2': () => ({
        status: 200,
        body: { id: 'acc_2', account_type: 'onramp', developer_fee_bps: 50 },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const account = await client.accounts.get('acc_2');

    expect(account.developer_fee_fixed).toBeUndefined();
    expect(account.minimum_deposit).toBeUndefined();
  });

  it('a one-off exposes developer_fee_fixed, and omits it when unset', async () => {
    const { fetch } = createRoutedFetch({
      'GET /transactions/tx_fixed': () => ({
        status: 200,
        body: { id: 'tx_fixed', developer_fee_bps: 0, developer_fee_fixed: '10.00' },
      }),
      'GET /transactions/tx_bps': () => ({
        status: 200,
        body: { id: 'tx_bps', developer_fee_bps: 50 },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    expect((await client.transactions.get('tx_fixed')).developer_fee_fixed).toBe('10.00');
    expect((await client.transactions.get('tx_bps')).developer_fee_fixed).toBeUndefined();
  });
});

describe('agentic developer-fee fields', () => {
  it('instructions.create sends developer_fee_defaults as given', async () => {
    const { fetch, requests } = createRoutedFetch({
      'POST /instructions': () => ({ status: 200, body: { instruction_ids: [] } }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    const defaults: DeveloperFeeDefaults = {
      swap: { developer_fee_bps: 50 },
      offramp: { developer_fee_bps: 25 },
    };

    await client.instructions.create({
      payment_agent_id: 'agt_1',
      proposals: [],
      developer_fee_defaults: defaults,
    });

    expect(
      (requests[0]?.body as { developer_fee_defaults?: unknown }).developer_fee_defaults
    ).toEqual(defaults);
  });

  it('the deprecated request fields still type-check', () => {
    const legacyFee: DeveloperFee = { swap_bps: 50, offramp_bps: 25 };
    const legacyRequest: CreateInstructionsRequest = {
      payment_agent_id: 'agt_1',
      proposals: [],
      developer_fee: legacyFee,
    };
    const action: Pick<CreateAutoAccountAction, 'developer_fee_bps' | 'fee_bps'> = {
      developer_fee_bps: 50,
    };
    const legacyAction: Pick<CreateAutoAccountAction, 'developer_fee_bps' | 'fee_bps'> = {
      fee_bps: 50,
    };

    expect(legacyRequest.developer_fee).toEqual(legacyFee);
    expect(action.developer_fee_bps).toBe(legacyAction.fee_bps);
  });
});
