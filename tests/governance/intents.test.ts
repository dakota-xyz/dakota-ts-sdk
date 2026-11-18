/**
 * Governance intent builders vs. the policy engine's own canonical bytes.
 *
 * The expected bytes in the fixture come from policy-engine's
 * `intent.CanonicalIntentBytes` (see tests/fixtures/governance/README.md),
 * never from the SDK, so a drift in either the builder or the canonicalizer
 * fails here.
 */

import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  addSignersToGroupIntent,
  assertIdempotencyKey,
  createCryptoDestinationIntent,
  newIdempotencyKey,
  removeSignersFromGroupIntent,
  updateSignerGroupGovernanceIntent,
  type CanonicalIntent,
} from '../../src/governance/index.js';

interface Vector {
  name: string;
  kind: string;
  input: Record<string, unknown>;
  canonical_b64: string;
  sha256_hex: string;
}

const golden = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/governance/intents.golden.json'), 'utf8')
) as { vectors: Vector[] };

function build(v: Vector): CanonicalIntent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = v.input as Record<string, any>;
  switch (v.kind) {
    case 'add_signers_to_group':
      return addSignersToGroupIntent({
        signerGroupId: i.signer_group_id,
        newMemberKeys: i.new_member_keys,
        signerGroupVersion: i.signer_group_version,
        idempotencyKey: i.idempotency_key,
      });
    case 'remove_signers_from_group':
      return removeSignersFromGroupIntent({
        signerGroupId: i.group_id,
        membersToRemove: i.members_to_remove,
        signerGroupVersion: i.signer_group_version,
        idempotencyKey: i.idempotency_key,
      });
    case 'update_signer_group_governance':
      return updateSignerGroupGovernanceIntent({
        signerGroupId: i.signer_group_id,
        signerGroupVersion: i.signer_group_version,
        idempotencyKey: i.idempotency_key,
        governanceThreshold: i.governance_threshold,
        governanceSignerGroupId: i.governance_signer_group_id,
      });
    case 'create_crypto_destination':
      return createCryptoDestinationIntent({
        recipientId: i.recipient_id,
        networkId: i.network_id,
        address: i.address,
        signerGroupId: i.signer_group_id,
        idempotencyKey: i.idempotency_key,
      });
    default:
      throw new Error(`unknown kind ${v.kind}`);
  }
}

describe('governance intents match the policy engine byte for byte', () => {
  it('covers every intent kind', () => {
    expect(new Set(golden.vectors.map((v) => v.kind))).toEqual(
      new Set([
        'add_signers_to_group',
        'remove_signers_from_group',
        'update_signer_group_governance',
        'create_crypto_destination',
      ])
    );
  });

  for (const v of golden.vectors) {
    it(v.name, () => {
      const got = build(v);
      const want = Buffer.from(v.canonical_b64, 'base64');
      expect(Buffer.from(got.bytes).equals(want)).toBe(true);
      expect(got.canonical).toBe(want.toString('utf8'));
      expect(createHash('sha256').update(got.bytes).digest('hex')).toBe(v.sha256_hex);
    });
  }
});

describe('governance intent rules', () => {
  const base = {
    signerGroupId: 'grp',
    signerGroupVersion: 0,
    idempotencyKey: '047caa77-8cec-4e96-994c-a12b655231de',
  };

  it('always emits signer_group_version, including 0', () => {
    const c = addSignersToGroupIntent({ ...base, newMemberKeys: ['k'] });
    expect(c.canonical).toContain('"signer_group_version":0');
  });

  it('omits unset governance settings (null and undefined both clear)', () => {
    const cleared = updateSignerGroupGovernanceIntent({
      ...base,
      governanceThreshold: null,
      governanceSignerGroupId: undefined,
    });
    expect(cleared.canonical).not.toContain('governance_threshold');
    expect(cleared.canonical).not.toContain('governance_signer_group_id');
    expect(cleared.canonical).not.toContain('null');
  });

  it('refuses an uppercase or non-UUID idempotency key', () => {
    const upper = '047CAA77-8CEC-4E96-994C-A12B655231DE';
    expect(() =>
      addSignersToGroupIntent({ ...base, newMemberKeys: ['k'], idempotencyKey: upper })
    ).toThrow(/lowercase UUID/);
    expect(() => assertIdempotencyKey('not-a-uuid')).toThrow(/lowercase UUID/);
  });

  it('refuses a negative, fractional or unsafe version', () => {
    for (const v of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
      expect(() =>
        removeSignersFromGroupIntent({ ...base, membersToRemove: ['k'], signerGroupVersion: v })
      ).toThrow(/signer_group_version/);
    }
  });

  it('refuses an empty member list and a threshold below 1', () => {
    expect(() => addSignersToGroupIntent({ ...base, newMemberKeys: [] })).toThrow(/at least one/);
    expect(() => removeSignersFromGroupIntent({ ...base, membersToRemove: [''] })).toThrow(
      /required/
    );
    for (const t of [0, 1.5, 1e21, 2 ** 31]) {
      expect(() => updateSignerGroupGovernanceIntent({ ...base, governanceThreshold: t })).toThrow(
        /governanceThreshold/
      );
    }
  });

  describe('newIdempotencyKey', () => {
    const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('uses crypto.randomUUID, lowercased', () => {
      vi.stubGlobal('crypto', { randomUUID: () => '047CAA77-8CEC-4E96-994C-A12B655231DE' });
      expect(newIdempotencyKey()).toBe('047caa77-8cec-4e96-994c-a12b655231de');
    });

    it('falls back to getRandomValues (React Native with a polyfill)', () => {
      vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => webcrypto.getRandomValues(a) });
      const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
      expect(keys.size).toBe(50);
      for (const k of keys) expect(k).toMatch(V4);
    });

    it('refuses to invent a key without a cryptographic random source', () => {
      vi.stubGlobal('crypto', undefined);
      expect(() => newIdempotencyKey()).toThrow(/random source/);
    });
  });
});

describe('member keys with surrounding whitespace', () => {
  const base = {
    signerGroupId: 'grp',
    signerGroupVersion: 0,
    idempotencyKey: '047caa77-8cec-4e96-994c-a12b655231de',
  };

  it('are refused, since the platform trims an added key before it verifies', () => {
    expect(() => addSignersToGroupIntent({ ...base, newMemberKeys: ['key\n'] })).toThrow(
      /newMemberKeys\[0\] has leading or trailing whitespace/
    );
    expect(() =>
      removeSignersFromGroupIntent({ ...base, membersToRemove: ['ok', ' key'] })
    ).toThrow(/membersToRemove\[1\] has leading or trailing whitespace/);
  });
});
