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
  async create(data: WalletCreateRequest): Promise<Wallet> {
    return this.transport.request<Wallet>({
      method: 'POST',
      path: '/wallets',
      body: data,
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
  async createTransaction(walletId: string, data: WalletTransactionRequest): Promise<WalletTransaction> {
    return this.transport.request<WalletTransaction>({
      method: 'POST',
      path: `/wallets/${walletId}/transactions`,
      body: data,
    });
  }
}
