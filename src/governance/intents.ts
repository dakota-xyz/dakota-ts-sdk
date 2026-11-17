/**
 * Canonical intents for signer-group governance changes.
 *
 * A change to a governed signer group (adding or removing members, changing
 * who governs it) needs signatures from the group's governing members. Each
 * signature covers the RFC 8785 (JCS) canonical JSON of an "intent" that the
 * policy engine rebuilds from the request and checks byte-for-byte. A wrong
 * key, a missing `signer_group_version`, or an idempotency key that differs
 * from the `X-Idempotency-Key` header gives a signature that never verifies,
 * so build the intent here rather than by hand.
 *
 * The builders are pure (no I/O, no `node:` import), so they run in a
 * browser or mobile app as well as on a server. The byte equality with the
 * policy engine is pinned by golden vectors in the test suite.
 */

import { canonicalJSON } from '../agentic/canonicalize.js';
import { utf8 } from './encoding.js';

/** `add_signers_to_group`: endorses adding members to a signer group. */
export interface AddSignersToGroupIntent {
  readonly type: 'add_signers_to_group';
  readonly signer_group_id: string;
  readonly new_member_keys: readonly string[];
  readonly signer_group_version: number;
  readonly idempotency_key: string;
}

/**
 * `remove_signers_from_group`: endorses removing members. Note the group id
 * key is `group_id` here, not `signer_group_id`.
 */
export interface RemoveSignersFromGroupIntent {
  readonly type: 'remove_signers_from_group';
  readonly group_id: string;
  readonly members_to_remove: readonly string[];
  readonly signer_group_version: number;
  readonly idempotency_key: string;
}

/**
 * `update_signer_group_governance`: endorses replacing a group's governance
 * settings. An optional setting is ABSENT when not set (never null), and an
 * absent setting is cleared by the change.
 */
export interface UpdateSignerGroupGovernanceIntent {
  readonly type: 'update_signer_group_governance';
  readonly signer_group_id: string;
  readonly signer_group_version: number;
  readonly idempotency_key: string;
  readonly governance_threshold?: number;
  readonly governance_signer_group_id?: string;
}

/** `create_crypto_destination`: endorses creating a crypto destination. */
export interface CreateCryptoDestinationIntent {
  readonly type: 'create_crypto_destination';
  readonly recipient_id: string;
  readonly network_id: string;
  readonly address: string;
  readonly signer_group_id: string;
  readonly idempotency_key: string;
}

/** Any intent this module builds. */
export type GovernanceIntent =
  | AddSignersToGroupIntent
  | RemoveSignersFromGroupIntent
  | UpdateSignerGroupGovernanceIntent
  | CreateCryptoDestinationIntent;

/**
 * An intent together with the exact bytes its signatures cover.
 *
 * - `canonical` is the canonical JSON as a string (handy to store or log).
 * - `bytes` is its UTF-8 encoding: what an ES256 signer signs, and what a
 *   WebAuthn `navigator.credentials.get()` call takes as its `challenge`.
 */
export interface CanonicalIntent<T extends GovernanceIntent = GovernanceIntent> {
  readonly intent: T;
  readonly canonical: string;
  readonly bytes: Uint8Array;
}

const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Check that `key` is a lowercase UUID, the only idempotency key the platform
 * accepts on these endpoints. The same key goes into the intent and the
 * `X-Idempotency-Key` header, so an uppercase key would be refused even
 * though its signature is otherwise valid.
 *
 * @throws TypeError when it is not.
 */
export function assertIdempotencyKey(key: string): void {
  if (typeof key !== 'string' || !LOWERCASE_UUID.test(key)) {
    throw new TypeError(
      `idempotency key must be a lowercase UUID (got ${JSON.stringify(key)}); the platform refuses any other form`
    );
  }
}

/**
 * A fresh lowercase v4 UUID for a governance change, from the platform's
 * cryptographic random source (`crypto.randomUUID`, else
 * `crypto.getRandomValues`).
 */
export function newIdempotencyKey(): string {
  const c = (
    globalThis as {
      crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().toLowerCase();
  }
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('no cryptographic random source: pass an idempotency key explicitly');
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function nonEmpty(name: string, value: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

function keyList(name: string, keys: readonly string[]): string[] {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError(`${name} must list at least one public key`);
  }
  return keys.map((k, i) => nonEmpty(`${name}[${i}]`, k));
}

function version(v: number): number {
  if (!Number.isSafeInteger(v) || v < 0) {
    throw new TypeError(
      `signer_group_version must be a non-negative integer (got ${String(v)}); read it from the group's \`version\``
    );
  }
  return v;
}

function finish<T extends GovernanceIntent>(intent: T): CanonicalIntent<T> {
  const canonical = canonicalJSON(intent);
  return { intent, canonical, bytes: utf8(canonical) };
}

/**
 * Intent for adding members to a signer group
 * (`POST /signer-groups/{id}/signers`). That endpoint adds one `member_key`
 * per request, so pass `[memberKey]`.
 *
 * @param params.signerGroupVersion - the group's current `version` (0 is valid
 *   and is signed as 0)
 * @param params.idempotencyKey - a lowercase UUID; send the SAME value as the
 *   request's `X-Idempotency-Key`
 */
export function addSignersToGroupIntent(params: {
  signerGroupId: string;
  newMemberKeys: readonly string[];
  signerGroupVersion: number;
  idempotencyKey: string;
}): CanonicalIntent<AddSignersToGroupIntent> {
  assertIdempotencyKey(params.idempotencyKey);
  return finish({
    type: 'add_signers_to_group',
    signer_group_id: nonEmpty('signerGroupId', params.signerGroupId),
    new_member_keys: keyList('newMemberKeys', params.newMemberKeys),
    signer_group_version: version(params.signerGroupVersion),
    idempotency_key: params.idempotencyKey,
  });
}

/**
 * Intent for removing members from a signer group
 * (`POST /signer-groups/{id}/signer-removals`). `membersToRemove` is signed
 * in the order given, which must be the order sent.
 */
export function removeSignersFromGroupIntent(params: {
  signerGroupId: string;
  membersToRemove: readonly string[];
  signerGroupVersion: number;
  idempotencyKey: string;
}): CanonicalIntent<RemoveSignersFromGroupIntent> {
  assertIdempotencyKey(params.idempotencyKey);
  return finish({
    type: 'remove_signers_from_group',
    group_id: nonEmpty('signerGroupId', params.signerGroupId),
    members_to_remove: keyList('membersToRemove', params.membersToRemove),
    signer_group_version: version(params.signerGroupVersion),
    idempotency_key: params.idempotencyKey,
  });
}

/**
 * Intent for replacing a signer group's governance settings
 * (`PATCH /signer-groups/{id}/governance`).
 *
 * The change replaces the WHOLE governance state: leave a setting out (or
 * pass null) to clear it, which the intent expresses by omitting the key.
 * No `governanceThreshold` means the default quorum; no
 * `governanceSignerGroupId` means the group governs itself.
 */
export function updateSignerGroupGovernanceIntent(params: {
  signerGroupId: string;
  signerGroupVersion: number;
  idempotencyKey: string;
  governanceThreshold?: number | null;
  governanceSignerGroupId?: string | null;
}): CanonicalIntent<UpdateSignerGroupGovernanceIntent> {
  assertIdempotencyKey(params.idempotencyKey);
  const intent: {
    -readonly [K in keyof UpdateSignerGroupGovernanceIntent]: UpdateSignerGroupGovernanceIntent[K];
  } = {
    type: 'update_signer_group_governance',
    signer_group_id: nonEmpty('signerGroupId', params.signerGroupId),
    signer_group_version: version(params.signerGroupVersion),
    idempotency_key: params.idempotencyKey,
  };
  if (params.governanceThreshold !== undefined && params.governanceThreshold !== null) {
    if (!Number.isInteger(params.governanceThreshold) || params.governanceThreshold < 1) {
      throw new TypeError('governanceThreshold must be an integer >= 1, or null to clear it');
    }
    intent.governance_threshold = params.governanceThreshold;
  }
  if (params.governanceSignerGroupId !== undefined && params.governanceSignerGroupId !== null) {
    intent.governance_signer_group_id = nonEmpty(
      'governanceSignerGroupId',
      params.governanceSignerGroupId
    );
  }
  return finish(intent);
}

/**
 * Intent for creating a crypto destination endorsed by a signer group's
 * governance (`POST /recipients/{recipient_id}/destinations` with
 * `destination_type: 'crypto'`, `signatures` and `signer_group_id`). Send
 * `crypto_address` = `address` and the same `network_id`.
 */
export function createCryptoDestinationIntent(params: {
  recipientId: string;
  networkId: string;
  address: string;
  signerGroupId: string;
  idempotencyKey: string;
}): CanonicalIntent<CreateCryptoDestinationIntent> {
  assertIdempotencyKey(params.idempotencyKey);
  return finish({
    type: 'create_crypto_destination',
    recipient_id: nonEmpty('recipientId', params.recipientId),
    network_id: nonEmpty('networkId', params.networkId),
    address: nonEmpty('address', params.address),
    signer_group_id: nonEmpty('signerGroupId', params.signerGroupId),
    idempotency_key: params.idempotencyKey,
  });
}
