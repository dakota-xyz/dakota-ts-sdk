/**
 * Wallets resource.
 */

import { BaseResource } from './base.js';
import type {
  Wallet,
  WalletCreateRequest,
  WalletBalance,
  WalletTransactionRequest,
  WalletTransaction,
  AttachedPolicy,
  RequestOptions,
} from '../types.js';

/**
 * Wallets API resource.
 */
export class WalletsResource extends BaseResource {
  /**
   * Create a new wallet.
   *
   * Creates a non-custodial multi-sig wallet for a customer.
   *
   * @param data - Wallet creation data
   * @returns Created wallet
   *
   * @example
   * ```typescript
   * const wallet = await client.wallets.create({
   *   customer_id: customerId,
   *   family: 'evm',
   *   name: 'Treasury Wallet',
   * });
   * console.log(wallet.address);
   * ```
   */
  async create(data: WalletCreateRequest, options?: RequestOptions): Promise<Wallet> {
    return this.transport.request<Wallet>({
      method: 'POST',
      path: '/wallets',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Get a single wallet by ID.
   *
   * @param walletId - Wallet ID
   * @returns Wallet record (includes `customer_name` and `created_at`)
   *
   * @example
   * ```typescript
   * const wallet = await client.wallets.get(walletId);
   * console.log(wallet.address, wallet.customer_name);
   * ```
   */
  async get(walletId: string): Promise<Wallet> {
    return this.transport.request<Wallet>({
      method: 'GET',
      path: `/wallets/${walletId}`,
    });
  }

  /**
   * Get policies attached to a wallet.
   *
   * Returns slim references (id + name) for the policies currently attached to the wallet.
   *
   * @param walletId - Wallet ID
   * @returns Array of attached policies
   *
   * @example
   * ```typescript
   * const policies = await client.wallets.getPolicies(walletId);
   * for (const policy of policies) {
   *   console.log(policy.id, policy.name);
   * }
   * ```
   */
  async getPolicies(walletId: string): Promise<AttachedPolicy[]> {
    return this.transport.request<AttachedPolicy[]>({
      method: 'GET',
      path: `/wallets/${walletId}/policies`,
    });
  }

  /**
   * Get wallet balances.
   *
   * @param walletId - Wallet ID
   * @returns Array of balances
   *
   * @example
   * ```typescript
   * const balances = await client.wallets.getBalances(walletId);
   * for (const balance of balances) {
   *   console.log(balance.asset, balance.amount);
   * }
   * ```
   */
  async getBalances(walletId: string): Promise<WalletBalance[]> {
    const response = await this.transport.request<{ data: WalletBalance[] }>({
      method: 'GET',
      path: `/wallets/${walletId}/balances`,
    });
    return response.data;
  }

  /**
   * Create a wallet transaction.
   *
   * @param walletId - Wallet ID
   * @param data - Transaction data
   * @returns Created transaction
   *
   * @example
   * ```typescript
   * const tx = await client.wallets.createTransaction(walletId, {
   *   to: '0x...',
   *   amount: '100.00',
   *   asset: 'USDC',
   *   network_id: 'ethereum-mainnet',
   * });
   * ```
   */
  async createTransaction(
    walletId: string,
    data: WalletTransactionRequest,
    options?: RequestOptions
  ): Promise<WalletTransaction> {
    return this.transport.request<WalletTransaction>({
      method: 'POST',
      path: `/wallets/${walletId}/transactions`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
