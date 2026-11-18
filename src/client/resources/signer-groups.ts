/**
 * Signer Groups resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import { randomUUID } from 'node:crypto';

import { StaleSignerGroupVersionError } from '../errors.js';
import {
  addSignersToGroupIntent,
  assertIdempotencyKey,
  newIdempotencyKey,
  removeSignersFromGroupIntent,
  updateSignerGroupGovernanceIntent,
  type CanonicalIntent,
} from '../../governance/intents.js';
import { signGovernanceIntent, type GovernanceSignerLike } from '../../governance/signer.js';
import { utf8 } from '../../governance/encoding.js';
import type {
  SignerGroup,
  SignerGroupCreateRequest,
  SignerGroupGetParams,
  SignerGroupGovernanceSettings,
  SignerGroupGovernanceUpdateRequest,
  SignerGroupSignerAddRequest,
  SignerGroupSignerRemovalRequest,
  Signer,
  SignerCreateRequest,
  AttachedWallet,
  ListParams,
  PreparedSignerGroupChange,
  PrepareSignerGroupChangeOptions,
  RequestOptions,
  SignedSignerGroupChangeOptions,
} from '../types.js';

/**
 * Signer Groups API resource.
 */
export class SignerGroupsResource extends BaseResource {
  /**
   * Create a new signer group.
   *
   * @param data - Signer group creation data
   * @returns Created signer group
   */
  async create(data: SignerGroupCreateRequest, options?: RequestOptions): Promise<SignerGroup> {
    return this.transport.request<SignerGroup>({
      method: 'POST',
      path: '/signer-groups',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List signer groups.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of signer groups
   */
  list(params?: ListParams): PaginatedIterator<SignerGroup> {
    return this.paginate<SignerGroup>('/signer-groups', params);
  }

  /**
   * Get a signer group by ID.
   *
   * Pass `{ include_removed: true }` to also get a `removed_members` array of
   * signers that were removed from this group, each carrying its `removed_at`
   * timestamp. Defaults to active members only.
   *
   * @param signerGroupId - Signer group ID
   * @param params - Optional `{ include_removed }`
   * @returns Signer group record
   *
   * @example
   * ```typescript
   * const group = await client.signerGroups.get(groupId, { include_removed: true });
   * for (const s of group.removed_members ?? []) {
   *   console.log(s.name, 'removed at', s.removed_at);
   * }
   * ```
   */
  async get(signerGroupId: string, params?: SignerGroupGetParams): Promise<SignerGroup> {
    return this.transport.request<SignerGroup>({
      method: 'GET',
      path: `/signer-groups/${seg(signerGroupId)}`,
      query: { ...params },
    });
  }

  /**
   * Add an existing signer's public key to a group.
   *
   * The endpoint takes `{ member_key }` — the base64 PKIX (SPKI) public
   * key of an existing signer resource — not a fresh signer definition.
   * Returns the updated group (with the new member included).
   *
   * A governed group (governance settings, or a client with governance
   * enforcement on) refuses an unsigned add with
   * `EndorsementRequiredError`; use {@link addSignerSigned} instead, or pass
   * `signatures` + `signer_group_version` yourself with the SAME idempotency
   * key that is inside the signed intent.
   *
   * @param signerGroupId - Signer group ID
   * @param data - `{ member_key }` (the signer's base64 PKIX public key)
   * @returns The updated signer group
   */
  async addSigner(
    signerGroupId: string,
    data: SignerGroupSignerAddRequest,
    options?: RequestOptions
  ): Promise<SignerGroup> {
    if (data.signatures !== undefined) {
      requireSignedKey('addSigner', options);
    }
    return this.transport.request<SignerGroup>({
      method: 'POST',
      path: `/signer-groups/${seg(signerGroupId)}/signers`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Remove ONE signer from a group, unsigned, by its KSUID `signer_id`
   * (`DELETE /signer-groups/{id}/signers/{signer_id}`).
   *
   * A governed group refuses this with `EndorsementRequiredError`; use
   * {@link removeSignersSigned} instead. Not to be confused with
   * {@link removeSigners} (plural), the signed removal by PUBLIC KEY.
   *
   * @param signerGroupId - Signer group ID
   * @param signerId - The signer's KSUID `signer_id` — NOT its public key.
   *   (The standalone `client.signers.delete()` takes the public key instead.)
   * @param options - Optional request options (e.g. an explicit idempotency
   *   key — the platform requires one on this DELETE)
   */
  async removeSigner(
    signerGroupId: string,
    signerId: string,
    options?: RequestOptions
  ): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/signer-groups/${seg(signerGroupId)}/signers/${seg(signerId)}`,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  // --------------------------------------------------------------------------
  // Signed (governed) membership and governance changes
  // --------------------------------------------------------------------------

  /**
   * Remove members by PUBLIC KEY, with signatures from the group's governance
   * (`POST /signer-groups/{id}/signer-removals`). Low level: you supply the
   * signed body, and `options.idempotencyKey` is required and MUST be the key
   * inside the signed intent. Prefer {@link removeSignersSigned}. (The
   * singular {@link removeSigner} is the unsigned removal by `signer_id`.)
   */
  async removeSigners(
    signerGroupId: string,
    data: SignerGroupSignerRemovalRequest,
    options?: RequestOptions
  ): Promise<SignerGroup> {
    requireSignedKey('removeSigners', options);
    return this.transport.request<SignerGroup>({
      method: 'POST',
      path: `/signer-groups/${seg(signerGroupId)}/signer-removals`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Replace a group's governance settings with signatures from its current
   * governance (`PATCH /signer-groups/{id}/governance`). The body is the
   * WHOLE state: a setting left out is cleared. Low level: you supply the
   * signed body, and `options.idempotencyKey` is required and MUST be the key
   * inside the signed intent. Prefer {@link updateGovernanceSigned}.
   */
  async updateGovernance(
    signerGroupId: string,
    data: SignerGroupGovernanceUpdateRequest,
    options?: RequestOptions
  ): Promise<SignerGroup> {
    requireSignedKey('updateGovernance', options);
    return this.transport.request<SignerGroup>({
      method: 'PATCH',
      path: `/signer-groups/${seg(signerGroupId)}/governance`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Build (but do not sign or send) the change that adds `memberKey` to the
   * group. Reads the group's current `version` unless
   * `options.signerGroupVersion` is given, and generates a lowercase UUID
   * idempotency key unless one is given.
   *
   * Use it when the signatures are collected elsewhere — for example a
   * passkey in the user's browser: send `change.canonical` there, pass it to
   * `buildChallenge`, then give the packed assertions to
   * {@link submitSignedChange}.
   */
  async prepareAddSigner(
    signerGroupId: string,
    memberKey: string,
    options?: PrepareSignerGroupChangeOptions
  ): Promise<PreparedSignerGroupChange> {
    return this.prepareChange(
      'add_signers_to_group',
      signerGroupId,
      { memberKeys: [memberKey] },
      options
    );
  }

  /**
   * Build (but do not sign or send) the change that removes `memberKeys`
   * (public keys, as the group lists them; signed in this order).
   */
  async prepareRemoveSigners(
    signerGroupId: string,
    memberKeys: readonly string[],
    options?: PrepareSignerGroupChangeOptions
  ): Promise<PreparedSignerGroupChange> {
    return this.prepareChange(
      'remove_signers_from_group',
      signerGroupId,
      { memberKeys: [...memberKeys] },
      options
    );
  }

  /**
   * Build (but do not sign or send) the change that sets the group's
   * governance to `settings`. It replaces the whole state: a setting left
   * out or null is cleared.
   */
  async prepareGovernanceUpdate(
    signerGroupId: string,
    settings: SignerGroupGovernanceSettings,
    options?: PrepareSignerGroupChangeOptions
  ): Promise<PreparedSignerGroupChange> {
    const governance: { governance_threshold?: number; governance_signer_group_id?: string } = {};
    if (settings.governance_threshold !== undefined && settings.governance_threshold !== null) {
      governance.governance_threshold = settings.governance_threshold;
    }
    if (
      settings.governance_signer_group_id !== undefined &&
      settings.governance_signer_group_id !== null
    ) {
      governance.governance_signer_group_id = settings.governance_signer_group_id;
    }
    return this.prepareChange(
      'update_signer_group_governance',
      signerGroupId,
      { governance },
      options
    );
  }

  /**
   * Send a prepared change with its signatures (ES256 DER base64, or packed
   * passkey assertions), using the change's idempotency key as
   * `X-Idempotency-Key`. Re-checks that the change still matches the intent
   * that was signed and refuses it otherwise, without sending anything.
   *
   * @throws EndorsementRequiredError, InsufficientEndorsementsError,
   *   StaleSignerGroupVersionError, BelowThresholdError (all APIError)
   */
  async submitSignedChange(
    change: PreparedSignerGroupChange,
    signatures: readonly string[],
    options?: Pick<RequestOptions, 'timeout'>
  ): Promise<SignerGroup> {
    if (
      !Array.isArray(signatures) ||
      signatures.length === 0 ||
      signatures.some((s) => typeof s !== 'string' || s === '')
    ) {
      throw new TypeError('a signed change needs at least one non-empty signature');
    }
    const built = buildChangeIntent(change);
    if (built.canonical !== change.canonical) {
      throw new Error(
        'the prepared change does not match the intent that was signed (it was altered after it was prepared); prepare it again'
      );
    }
    // Every body field comes from the intent that was rebuilt and checked
    // above, never from the stored change, so nothing unsigned goes out.
    const i = built.intent;
    const requestOptions = { idempotencyKey: i.idempotency_key, timeout: options?.timeout };
    const sigs = [...signatures];
    switch (i.type) {
      case 'add_signers_to_group':
        return this.addSigner(
          i.signer_group_id,
          {
            member_key: i.new_member_keys[0]!,
            signer_group_version: i.signer_group_version,
            signatures: sigs,
          },
          requestOptions
        );
      case 'remove_signers_from_group':
        return this.removeSigners(
          i.group_id,
          {
            members_to_remove: [...i.members_to_remove],
            signer_group_version: i.signer_group_version,
            signatures: sigs,
          },
          requestOptions
        );
      case 'update_signer_group_governance': {
        const body: SignerGroupGovernanceUpdateRequest = {
          ...(i.governance_threshold !== undefined && {
            governance_threshold: i.governance_threshold,
          }),
          ...(i.governance_signer_group_id !== undefined && {
            governance_signer_group_id: i.governance_signer_group_id,
          }),
          signer_group_version: i.signer_group_version,
          signatures: sigs,
        };
        return this.updateGovernance(i.signer_group_id, body, requestOptions);
      }
      default:
        throw new TypeError(`cannot submit a ${i.type} change from signerGroups`);
    }
  }

  /**
   * Add `memberKey` to a governed group in one call: read the version, build
   * the `add_signers_to_group` intent, sign it with each signer (in order),
   * and send it with the same idempotency key in the intent and the header.
   *
   * @param signers - ES256 signers (`ES256Signer`, your KMS) or plain
   *   `(bytes) => signature` functions; together they must meet the group's
   *   `effective_governance_threshold`. For a passkey in the user's browser
   *   or app, use {@link prepareAddSigner} + {@link submitSignedChange}
   *   instead, so the API key stays on your server; `webauthnSigner` fits
   *   here only when the passkey prompt runs in the same process as this
   *   client. Each stale retry calls every signer again.
   * @example
   * ```typescript
   * const group = await client.signerGroups.addSignerSigned(groupId, newKey, [
   *   ES256Signer.fromPrivateKey(adminKeyPem),
   * ]);
   * ```
   */
  async addSignerSigned(
    signerGroupId: string,
    memberKey: string,
    signers: readonly GovernanceSignerLike[],
    options?: SignedSignerGroupChangeOptions
  ): Promise<SignerGroup> {
    return this.signAndSubmit(
      () => this.prepareAddSigner(signerGroupId, memberKey, options),
      signers,
      options
    );
  }

  /** Remove `memberKeys` from a governed group in one call; see {@link addSignerSigned}. */
  async removeSignersSigned(
    signerGroupId: string,
    memberKeys: readonly string[],
    signers: readonly GovernanceSignerLike[],
    options?: SignedSignerGroupChangeOptions
  ): Promise<SignerGroup> {
    return this.signAndSubmit(
      () => this.prepareRemoveSigners(signerGroupId, memberKeys, options),
      signers,
      options
    );
  }

  /**
   * Replace a group's governance settings in one call; see
   * {@link addSignerSigned}. Signed by the group's CURRENT governance.
   *
   * `staleRetries` is refused here: the change replaces the WHOLE governance
   * state, so re-signing it after someone else changed the group would
   * silently undo their change. On `StaleSignerGroupVersionError`, re-read
   * the group, decide, and call again.
   */
  async updateGovernanceSigned(
    signerGroupId: string,
    settings: SignerGroupGovernanceSettings,
    signers: readonly GovernanceSignerLike[],
    options?: SignedSignerGroupChangeOptions
  ): Promise<SignerGroup> {
    if (options?.staleRetries) {
      throw new TypeError(
        'staleRetries is not supported on updateGovernanceSigned: a re-sign after a concurrent change would undo it'
      );
    }
    return this.signAndSubmit(
      () => this.prepareGovernanceUpdate(signerGroupId, settings, options),
      signers,
      options
    );
  }

  private async prepareChange(
    kind: PreparedSignerGroupChange['kind'],
    signerGroupId: string,
    fields: Pick<PreparedSignerGroupChange, 'memberKeys' | 'governance'>,
    options?: PrepareSignerGroupChangeOptions
  ): Promise<PreparedSignerGroupChange> {
    if (options?.idempotencyKey !== undefined) {
      assertIdempotencyKey(options.idempotencyKey);
    }
    const signerGroupVersion =
      options?.signerGroupVersion ?? (await this.currentVersion(signerGroupId));
    const draft = {
      kind,
      signerGroupId,
      signerGroupVersion,
      idempotencyKey: options?.idempotencyKey ?? governanceIdempotencyKey(),
      ...fields,
      canonical: '',
    };
    return { ...draft, canonical: buildChangeIntent(draft).canonical };
  }

  private async currentVersion(signerGroupId: string): Promise<number> {
    const group = await this.get(signerGroupId);
    if (typeof group.version !== 'number') {
      throw new Error(
        `signer group ${signerGroupId} has no version in the response, so a signed change cannot be built; pass signerGroupVersion if you know it`
      );
    }
    return group.version;
  }

  private async signAndSubmit(
    prepare: () => Promise<PreparedSignerGroupChange>,
    signers: readonly GovernanceSignerLike[],
    options?: SignedSignerGroupChangeOptions
  ): Promise<SignerGroup> {
    if (!Array.isArray(signers) || signers.length === 0) {
      throw new TypeError('a governance change needs at least one signer');
    }
    let retries = staleRetryBudget(options);
    for (;;) {
      const change = await prepare();
      const signatures = await signGovernanceIntent(utf8(change.canonical), signers);
      try {
        return await this.submitSignedChange(change, signatures, { timeout: options?.timeout });
      } catch (err) {
        if (err instanceof StaleSignerGroupVersionError && retries > 0) {
          retries--;
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Get wallets attached to a signer group.
   *
   * Returns slim references (id + name + family) for the wallets the signer group is currently attached to.
   *
   * @param signerGroupId - Signer group ID
   * @returns Array of attached wallets
   */
  async getWallets(signerGroupId: string): Promise<AttachedWallet[]> {
    return this.transport.request<AttachedWallet[]>({
      method: 'GET',
      path: `/signer-groups/${seg(signerGroupId)}/wallets`,
    });
  }

  /**
   * Attach a signer group to a wallet.
   *
   * Endorsed endpoint — `options.endorsement` must contain a signed
   * `AttachGroupToWalletIntent`. The server rejects requests without a
   * valid endorsement body.
   *
   * @param walletId - Wallet ID
   * @param signerGroupId - Signer group ID
   * @param options - Request options (must include `endorsement`)
   */
  async attachToWallet(
    walletId: string,
    signerGroupId: string,
    options?: RequestOptions
  ): Promise<void> {
    await this.transport.request<void>({
      method: 'PUT',
      path: `/wallets/${seg(walletId)}/signer-groups/${seg(signerGroupId)}`,
      body: options?.endorsement,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Detach a signer group from a wallet.
   *
   * Endorsed endpoint — `options.endorsement` must contain a signed
   * `DetachGroupFromWalletIntent`. The server rejects requests without a
   * valid endorsement body.
   *
   * @param walletId - Wallet ID
   * @param signerGroupId - Signer group ID
   * @param options - Request options (must include `endorsement`)
   */
  async detachFromWallet(
    walletId: string,
    signerGroupId: string,
    options?: RequestOptions
  ): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/wallets/${seg(walletId)}/signer-groups/${seg(signerGroupId)}`,
      body: options?.endorsement,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List signer groups attached to a wallet.
   *
   * @param walletId - Wallet ID
   * @param params - Pagination parameters
   * @returns Async iterator of signer groups
   */
  listForWallet(walletId: string, params?: ListParams): PaginatedIterator<SignerGroup> {
    return this.paginate<SignerGroup>(`/wallets/${walletId}/signer-groups`, params);
  }
}

/**
 * One id as a URL path segment. Ids are plain tokens today; encoding keeps a
 * value from elsewhere (a prepared change that went through a browser, say)
 * from reaching a different route with this client's API key.
 */
function seg(id: string): string {
  return encodeURIComponent(id);
}

/** Most stale re-signs the one-call helpers will make (each may prompt a passkey). */
const MAX_STALE_RETRIES = 5;

function staleRetryBudget(options?: SignedSignerGroupChangeOptions): number {
  const n = options?.staleRetries ?? 0;
  if (!Number.isInteger(n) || n < 0 || n > MAX_STALE_RETRIES) {
    throw new TypeError(`staleRetries must be an integer from 0 to ${MAX_STALE_RETRIES}`);
  }
  // A fixed version or key would sign the same stale intent again.
  if (
    n > 0 &&
    (options?.signerGroupVersion !== undefined || options?.idempotencyKey !== undefined)
  ) {
    throw new TypeError(
      'staleRetries cannot be combined with a fixed signerGroupVersion or idempotencyKey: a retry needs a fresh read and a fresh key'
    );
  }
  return n;
}

/**
 * The idempotency key for a new signed change: a lowercase v4 UUID from the
 * runtime's WebCrypto, else from `node:crypto` (Node 18 has no global
 * `crypto` by default).
 */
function governanceIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: unknown } }).crypto;
  return typeof c?.randomUUID === 'function' ? newIdempotencyKey() : randomUUID().toLowerCase();
}

/** A signed request carries the key inside its signed intent; it must not be generated here. */
function requireSignedKey(method: string, options?: RequestOptions): void {
  if (!options?.idempotencyKey) {
    throw new TypeError(
      `${method} with signatures needs options.idempotencyKey: the idempotency_key inside the signed intent (a generated one could never match)`
    );
  }
  assertIdempotencyKey(options.idempotencyKey);
}

/**
 * Rebuild the canonical intent a prepared change stands for. Validates its
 * fields on the way (lowercase UUID key, non-negative version, keys).
 */
function buildChangeIntent(change: PreparedSignerGroupChange): CanonicalIntent {
  const common = {
    signerGroupId: change.signerGroupId,
    signerGroupVersion: change.signerGroupVersion,
    idempotencyKey: change.idempotencyKey,
  };
  switch (change.kind) {
    case 'add_signers_to_group':
      if (!change.memberKeys || change.memberKeys.length !== 1) {
        throw new TypeError(
          'an add change carries exactly one member key (the endpoint adds one per request)'
        );
      }
      return addSignersToGroupIntent({ ...common, newMemberKeys: change.memberKeys });
    case 'remove_signers_from_group':
      return removeSignersFromGroupIntent({ ...common, membersToRemove: change.memberKeys ?? [] });
    case 'update_signer_group_governance':
      return updateSignerGroupGovernanceIntent({
        ...common,
        governanceThreshold: change.governance?.governance_threshold,
        governanceSignerGroupId: change.governance?.governance_signer_group_id,
      });
    default:
      throw new TypeError(
        `unknown signer-group change kind ${JSON.stringify((change as { kind: unknown }).kind)}`
      );
  }
}

/**
 * Signers API resource.
 */
export class SignersResource extends BaseResource {
  /**
   * Create a new signer.
   *
   * @param data - Signer creation data (name, public_key, key_type)
   * @param options - Request options
   * @returns Created signer
   */
  async create(data: SignerCreateRequest, options?: RequestOptions): Promise<Signer> {
    return this.transport.request<Signer>({
      method: 'POST',
      path: '/signers',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Delete a signer by public key.
   *
   * Soft-deletes all signers with the given public key.
   *
   * @param publicKey - Signer public key
   */
  async delete(publicKey: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/signers/${publicKey}`,
    });
  }
}
