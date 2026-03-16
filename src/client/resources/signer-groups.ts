/**
 * Signer Groups resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  SignerGroup,
  SignerGroupCreateRequest,
  Signer,
  SignerCreateRequest,
  ListParams,
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
  async create(data: SignerGroupCreateRequest): Promise<SignerGroup> {
    return this.transport.request<SignerGroup>({
      method: 'POST',
      path: '/signer-groups',
      body: data,
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
   * @param signerGroupId - Signer group ID
   * @returns Signer group record
   */
  async get(signerGroupId: string): Promise<SignerGroup> {
    return this.transport.request<SignerGroup>({
      method: 'GET',
      path: `/signer-groups/${signerGroupId}`,
    });
  }

  /**
   * Add a signer to a group.
   *
   * @param signerGroupId - Signer group ID
   * @param data - Signer creation data
   * @returns Created signer
   */
  async addSigner(signerGroupId: string, data: SignerCreateRequest): Promise<Signer> {
    return this.transport.request<Signer>({
      method: 'POST',
      path: `/signer-groups/${signerGroupId}/signers`,
      body: data,
    });
  }

  /**
   * Remove a signer from a group.
   *
   * @param signerGroupId - Signer group ID
   * @param signerId - Signer ID
   */
  async removeSigner(signerGroupId: string, signerId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/signer-groups/${signerGroupId}/signers/${signerId}`,
    });
  }

  /**
   * Attach a signer group to a wallet.
   *
   * @param walletId - Wallet ID
   * @param signerGroupId - Signer group ID
   */
  async attachToWallet(walletId: string, signerGroupId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'PUT',
      path: `/wallets/${walletId}/signer-groups/${signerGroupId}`,
    });
  }

  /**
   * Detach a signer group from a wallet.
   *
   * @param walletId - Wallet ID
   * @param signerGroupId - Signer group ID
   */
  async detachFromWallet(walletId: string, signerGroupId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/wallets/${walletId}/signer-groups/${signerGroupId}`,
    });
  }
}

/**
 * Signers API resource.
 */
export class SignersResource extends BaseResource {
  /**
   * List all signers.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of signers
   */
  list(params?: ListParams): PaginatedIterator<Signer> {
    return this.paginate<Signer>('/signers', params);
  }

  /**
   * Get a signer by public key.
   *
   * @param publicKey - Signer public key
   * @returns Signer record
   */
  async getByPublicKey(publicKey: string): Promise<Signer> {
    return this.transport.request<Signer>({
      method: 'GET',
      path: `/signers/${publicKey}`,
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
