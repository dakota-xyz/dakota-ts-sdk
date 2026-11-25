/**
 * Policy attach/detach signed at the policy's version (ENG-6773).
 *
 * The expected bytes are copied from policy-engine v0.0.48's own vectors
 * (pkg/intent/reconstruct_policy_version_test.go), the reconstruction that
 * verifies these signatures. Without a version the bytes are the ones signed
 * before ENG-6512; with it, `policy_version` joins as a JSON integer.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import {
  APIError,
  StalePolicyVersionError,
  StaleSignerGroupVersionError,
} from '../../src/client/errors.js';
import type { EndorsedRequest } from '../../src/client/types.js';
import { attachPolicyPayload, detachPolicyPayload } from '../../src/agentic/sign.js';
import { canonicalJSON } from '../../src/agentic/canonicalize.js';
import { createRoutedFetch } from './helpers.js';

const decoder = new TextDecoder();

describe('policy attach/detach payloads with policy_version', () => {
  it('attach without a version signs the pre-ENG-6512 bytes', () => {
    expect(decoder.decode(attachPolicyPayload('wal-1', 'pol-1', 'key-1'))).toBe(
      '{"idempotency_key":"key-1","policy_id":"pol-1","type":"attach_policy_to_wallet","wallet_id":"wal-1"}'
    );
    expect(decoder.decode(attachPolicyPayload('wal-1', 'pol-1', 'key-1', {}))).toBe(
      '{"idempotency_key":"key-1","policy_id":"pol-1","type":"attach_policy_to_wallet","wallet_id":"wal-1"}'
    );
  });

  it('attach with a version', () => {
    expect(
      decoder.decode(attachPolicyPayload('wal-1', 'pol-1', 'key-1', { policyVersion: 3 }))
    ).toBe(
      '{"idempotency_key":"key-1","policy_id":"pol-1","policy_version":3,"type":"attach_policy_to_wallet","wallet_id":"wal-1"}'
    );
  });

  it('detach without a version signs the pre-ENG-6512 bytes', () => {
    expect(decoder.decode(detachPolicyPayload('wal-1', 'pol-1', 'key-1'))).toBe(
      '{"idempotency_key":"key-1","policy_id":"pol-1","type":"detach_policy_from_wallet","wallet_id":"wal-1"}'
    );
  });

  it('detach with a version', () => {
    expect(
      decoder.decode(detachPolicyPayload('wal-1', 'pol-1', 'key-1', { policyVersion: 7 }))
    ).toBe(
      '{"idempotency_key":"key-1","policy_id":"pol-1","policy_version":7,"type":"detach_policy_from_wallet","wallet_id":"wal-1"}'
    );
  });

  it('refuses a version that is not a whole number of 1 or more', () => {
    for (const v of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31]) {
      expect(() => attachPolicyPayload('wal-1', 'pol-1', 'key-1', { policyVersion: v })).toThrow(
        /policy version/
      );
      expect(() => detachPolicyPayload('wal-1', 'pol-1', 'key-1', { policyVersion: v })).toThrow(
        /policy version/
      );
    }
  });
});

// The caller gives the version twice: once as `{ policyVersion }` (the signed
// bytes) and once as the intent's `policy_version` (what is sent). The
// platform verifies the signature over the intent it receives, so the
// canonical form of the sent intent must be exactly the signed bytes. This
// pins it for both intents, with and without a version.
describe('the sent intent canonicalizes to the signed payload', () => {
  type Intent = NonNullable<EndorsedRequest['intent']>;
  const cases: Array<[string, Uint8Array, Intent]> = [
    [
      'attach with version',
      attachPolicyPayload('wal-1', 'pol-1', 'key-1', { policyVersion: 5 }),
      {
        type: 'attach_policy_to_wallet',
        wallet_id: 'wal-1',
        policy_id: 'pol-1',
        idempotency_key: 'key-1',
        policy_version: 5,
      },
    ],
    [
      'attach without version',
      attachPolicyPayload('wal-1', 'pol-1', 'key-1'),
      {
        type: 'attach_policy_to_wallet',
        wallet_id: 'wal-1',
        policy_id: 'pol-1',
        idempotency_key: 'key-1',
      },
    ],
    [
      'detach with version',
      detachPolicyPayload('wal-1', 'pol-1', 'key-1', { policyVersion: 5 }),
      {
        type: 'detach_policy_from_wallet',
        wallet_id: 'wal-1',
        policy_id: 'pol-1',
        idempotency_key: 'key-1',
        policy_version: 5,
      },
    ],
    [
      'detach without version',
      detachPolicyPayload('wal-1', 'pol-1', 'key-1'),
      {
        type: 'detach_policy_from_wallet',
        wallet_id: 'wal-1',
        policy_id: 'pol-1',
        idempotency_key: 'key-1',
      },
    ],
  ];
  for (const [name, signed, intent] of cases) {
    it(name, () => {
      expect(canonicalJSON(intent)).toBe(decoder.decode(signed));
    });
  }
});

// The platform's 409 for a stale policy_version, as its public spec gives it
// (platform#2673).
const STALE_POLICY_VERSION = {
  type: 'https://docs.dakota.xyz/api-reference/errors#stale-policy-version',
  title: 'Stale Policy Version',
  status: 409,
  detail:
    "The policy changed since the signatures were made. Read the policy's version and sign again with a new idempotency_key.",
  instance: 'https://api.platform.dakota.xyz/policies/example-id/wallets/example-id',
  request_id: 'req_01hzy6y7v8w9x0y1z2a3b4c5d6',
  reason: 'stale_policy_version',
  code: 'stale_policy_version',
};

function makeClient(fetchImpl: unknown) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl as typeof fetch,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

describe('policies.attachToWallet / detachFromWallet with policy_version', () => {
  it('sends the version it was signed with, and maps the 409 to StalePolicyVersionError', async () => {
    const { fetch, requests } = createRoutedFetch({
      'PUT /policies/pol-1/wallets/wal-1': () => ({ status: 409, body: STALE_POLICY_VERSION }),
      'DELETE /policies/pol-1/wallets/wal-1': () => ({ status: 204 }),
    });
    const client = makeClient(fetch);
    const key = '7f0c2a9e-3b1d-4e8a-9c55-1d2e3f4a5b6c';

    const attach: EndorsedRequest = {
      intent: {
        type: 'attach_policy_to_wallet',
        wallet_id: 'wal-1',
        policy_id: 'pol-1',
        idempotency_key: key,
        policy_version: 3,
      },
      signatures: ['sig'],
    };
    const err = await client.policies
      .attachToWallet('pol-1', 'wal-1', { endorsement: attach, idempotencyKey: key })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StalePolicyVersionError);
    expect(err).toBeInstanceOf(APIError);
    expect(err).not.toBeInstanceOf(StaleSignerGroupVersionError);
    expect((err as APIError).statusCode).toBe(409);
    expect((err as APIError).code).toBe('stale_policy_version');
    expect((err as Error).name).toBe('StalePolicyVersionError');

    const detach: EndorsedRequest = {
      intent: {
        type: 'detach_policy_from_wallet',
        wallet_id: 'wal-1',
        policy_id: 'pol-1',
        idempotency_key: key,
      },
      signatures: ['sig'],
    };
    await client.policies.detachFromWallet('pol-1', 'wal-1', {
      endorsement: detach,
      idempotencyKey: key,
    });

    expect(requests).toHaveLength(2);
    expect((requests[0]?.body as { intent: Record<string, unknown> }).intent.policy_version).toBe(
      3
    );
    expect((requests[1]?.body as { intent: Record<string, unknown> }).intent).not.toHaveProperty(
      'policy_version'
    );
  });

  it('maps from the problem type when the body has no code', async () => {
    const { fetch } = createRoutedFetch({
      'PUT /policies/pol-1/wallets/wal-1': () => ({
        status: 409,
        body: { type: STALE_POLICY_VERSION.type, title: 'Stale Policy Version', status: 409 },
      }),
    });
    const err = await makeClient(fetch)
      .policies.attachToWallet('pol-1', 'wal-1', {
        endorsement: {
          intent: {
            type: 'attach_policy_to_wallet',
            wallet_id: 'wal-1',
            policy_id: 'pol-1',
            idempotency_key: 'k',
          },
          signatures: ['sig'],
        },
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StalePolicyVersionError);
  });
});
