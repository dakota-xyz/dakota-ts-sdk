/**
 * Agentic wallet-membership tests — port of go-sdk/client/agentic_test.go.
 *
 * `attachUserToWallet` adds the signer to an existing wallet-attached
 * signer group (no signature, no policy creation). Idempotent when already
 * a member, errors when the group isn't attached to the wallet.
 *
 * `detachUserFromWallet` is the inverse: removes the signer from the named
 * group (resolving its key → id). Idempotent when not a member, errors
 * when the group isn't on the wallet.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import { P256MandateSigner } from '../../src/agentic/sign.js';
import { createRoutedFetch, type RecordedRequest } from './helpers.js';

const WALLET_ID = 'wlt_1';
const GROUP_ID = 'spend_grp';

interface FakeMember {
  id: string;
  public_key: string;
}

/**
 * Build a mock of the endpoints attach/detachUserFromWallet touch.
 *
 * `walletGroupIds` — which signer groups the wallet has attached (drives the
 * "group on wallet" check via GET /signer-groups/{id}/wallets).
 * `members` — the members inside GROUP_ID.
 */
function newAgenticMock(walletGroupIds: string[], members: FakeMember[]) {
  return createRoutedFetch({
    // Symmetric group→wallets read. The wallet is "in" this list iff the
    // wallet is bound to `GROUP_ID`.
    [`GET /signer-groups/${GROUP_ID}/wallets`]: () => ({
      status: 200,
      body: walletGroupIds.includes(GROUP_ID) ? [{ id: WALLET_ID }] : [],
    }),
    [`GET /signer-groups/${GROUP_ID}`]: () => ({
      status: 200,
      body: { id: GROUP_ID, members },
    }),
    [`POST /signer-groups/${GROUP_ID}/signers`]: () => ({
      status: 201,
      body: {},
    }),
    // No signer id is captured here; individual tests read
    // `requests` to assert the deletion path.
    [`DELETE /signer-groups/${GROUP_ID}/signers/sig_self`]: (req) => {
      // The real platform requires an idempotency key on this DELETE.
      if (!req.headers['x-idempotency-key']) {
        return { status: 400, body: { error: 'x-idempotency-key is required' } };
      }
      return { status: 200, body: { id: GROUP_ID } };
    },
    [`DELETE /signer-groups/${GROUP_ID}/signers/sig_other`]: () => ({
      status: 200,
      body: { id: GROUP_ID },
    }),
  });
}

function makeClient(fetchImpl: typeof fetch) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

describe('attachUserToWallet', () => {
  it('adds the signer to the group when not a member', async () => {
    const signer = P256MandateSigner.generate();
    const pub = signer.publicKeyBase64();

    const { fetch, requests } = newAgenticMock(
      [GROUP_ID],
      [{ id: 'sig_other', public_key: 'someoneelse' }]
    );
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.attachUserToWallet(WALLET_ID, pub, GROUP_ID);
    expect(result.alreadyMember).toBe(false);

    const addReq = findRequest(requests, 'POST', `/signer-groups/${GROUP_ID}/signers`);
    expect(addReq).toBeDefined();
    expect((addReq!.body as { member_key: string }).member_key).toBe(pub);
    expect(addReq!.headers['x-idempotency-key']).toBeTruthy();
  });

  it('is idempotent when the signer is already a member (no add)', async () => {
    const signer = P256MandateSigner.generate();
    const pub = signer.publicKeyBase64();

    const { fetch, requests } = newAgenticMock([GROUP_ID], [{ id: 'sig_self', public_key: pub }]);
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.attachUserToWallet(WALLET_ID, pub, GROUP_ID);
    expect(result.alreadyMember).toBe(true);
    expect(findRequest(requests, 'POST', `/signer-groups/${GROUP_ID}/signers`)).toBeUndefined();
  });

  it('errors when the group is not attached to the wallet', async () => {
    const signer = P256MandateSigner.generate();
    const pub = signer.publicKeyBase64();

    const { fetch, requests } = newAgenticMock(['other_grp'], []);
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    await expect(client.attachUserToWallet(WALLET_ID, pub, GROUP_ID)).rejects.toThrow(
      /not attached to wallet/
    );
    expect(findRequest(requests, 'POST', `/signer-groups/${GROUP_ID}/signers`)).toBeUndefined();
  });
});

describe('detachUserFromWallet', () => {
  it('removes the signer from the group by resolving key → id', async () => {
    const signer = P256MandateSigner.generate();
    const pub = signer.publicKeyBase64();

    const { fetch, requests } = newAgenticMock(
      [GROUP_ID],
      [
        { id: 'sig_self', public_key: pub },
        { id: 'sig_other', public_key: 'someoneelse' },
      ]
    );
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.detachUserFromWallet(WALLET_ID, pub, GROUP_ID);
    expect(result.wasMember).toBe(true);

    const del = findRequest(requests, 'DELETE', `/signer-groups/${GROUP_ID}/signers/sig_self`);
    expect(del).toBeDefined();
    expect(del!.headers['x-idempotency-key']).toBeTruthy();
  });

  it('is idempotent when the signer is not a member (no delete)', async () => {
    const signer = P256MandateSigner.generate();
    const pub = signer.publicKeyBase64();

    const { fetch, requests } = newAgenticMock(
      [GROUP_ID],
      [{ id: 'sig_other', public_key: 'someoneelse' }]
    );
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.detachUserFromWallet(WALLET_ID, pub, GROUP_ID);
    expect(result.wasMember).toBe(false);
    expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  });

  it('errors when the group is not attached to the wallet', async () => {
    const signer = P256MandateSigner.generate();
    const pub = signer.publicKeyBase64();

    const { fetch, requests } = newAgenticMock(['other_grp'], []);
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    await expect(client.detachUserFromWallet(WALLET_ID, pub, GROUP_ID)).rejects.toThrow(
      /not attached to wallet/
    );
    expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  });
});

function findRequest(
  requests: RecordedRequest[],
  method: string,
  path: string
): RecordedRequest | undefined {
  return requests.find((r) => r.method === method && r.path === path);
}
