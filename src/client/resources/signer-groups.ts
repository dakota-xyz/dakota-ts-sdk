/**
 * Signer Groups resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  SignerGroup,
  SignerGroupCreateRequest,
  SignerGroupGetParams,
  SignerGroupSignerAddRequest,
  Signer,
  SignerCreateRequest,
  AttachedWallet,
  ListParams,
  RequestOptions,
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
      path: `/signer-groups/${signerGroupId}`,
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
   * @param signerGroupId - Signer group ID
   * @param data - `{ member_key }` (the signer's base64 PKIX public key)
   * @returns The updated signer group
   */
  async addSigner(
    signerGroupId: string,
    data: SignerGroupSignerAddRequest,
    options?: RequestOptions
  ): Promise<SignerGroup> {
    return this.transport.request<SignerGroup>({
      method: 'POST',
      path: `/signer-groups/${signerGroupId}/signers`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Remove a signer from a group.
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
      path: `/signer-groups/${signerGroupId}/signers/${signerId}`,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
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
      path: `/signer-groups/${signerGroupId}/wallets`,
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
      path: `/wallets/${walletId}/signer-groups/${signerGroupId}`,
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
      path: `/wallets/${walletId}/signer-groups/${signerGroupId}`,
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
