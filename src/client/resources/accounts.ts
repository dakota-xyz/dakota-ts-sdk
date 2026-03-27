/**
 * Accounts resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type { Account, AccountCreateRequest, AccountUpdateRequest, ListParams, RequestOptions } from '../types.js';

/** Account list parameters */
export interface AccountListParams extends ListParams {
  customer_id?: string;
  account_type?: 'onramp' | 'offramp' | 'swap';
}

/**
 * Accounts API resource.
 */
export class AccountsResource extends BaseResource {
  /**
   * Create a new account.
   *
   * Accounts define the flow of funds:
   * - **onramp**: USD → crypto (customer sends USD, receives stablecoin)
   * - **offramp**: crypto → USD (customer sends stablecoin, receives USD)
   * - **swap**: crypto → crypto (stablecoin conversion)
   *
   * @param data - Account creation data
   * @returns Created account
   *
   * @example
   * ```typescript
   * // Create an off-ramp account (crypto → USD)
   * const offramp = await client.accounts.create({
   *   account_type: 'offramp',
   *   customer_id: customerId,
   *   fiat_destination_id: bankDestinationId,
   *   asset: 'USDC',
   *   network_id: 'ethereum-mainnet',
   *   rail: 'ach',
   *   capabilities: ['ach'],
   * });
   * // Returns: { crypto_address: '0x...' } - customer sends USDC here
   *
   * // Create an on-ramp account (USD → crypto)
   * const onramp = await client.accounts.create({
   *   account_type: 'onramp',
   *   customer_id: customerId,
   *   crypto_destination_id: cryptoDestinationId,
   *   asset: 'USDC',
   *   network_id: 'ethereum-mainnet',
   *   rail: 'ach',
   *   capabilities: ['ach'],
   * });
   * // Returns: { bank_account: { bank_name, aba_routing_number, account_number } } - customer sends USD here
   * ```
   */
  async create(data: AccountCreateRequest, options?: RequestOptions): Promise<Account> {
    return this.transport.request<Account>({
      method: 'POST',
      path: '/accounts',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * List accounts.
   *
   * @param params - Filter and pagination parameters
   * @returns Async iterator of accounts
   *
   * @example
   * ```typescript
   * // List all accounts
   * for await (const account of client.accounts.list()) {
   *   console.log(account);
   * }
   *
   * // Filter by customer
   * const customerAccounts = client.accounts.list({ customer_id: customerId });
   * ```
   */
  list(params?: AccountListParams): PaginatedIterator<Account> {
    return this.paginate<Account>('/accounts', params);
  }

  /**
   * Get an account by ID.
   *
   * @param accountId - Account ID
   * @returns Account record
   *
   * @example
   * ```typescript
   * const account = await client.accounts.get(accountId);
   * ```
   */
  async get(accountId: string): Promise<Account> {
    return this.transport.request<Account>({
      method: 'GET',
      path: `/accounts/${accountId}`,
    });
  }

  /**
   * Update an account.
   *
   * @param accountId - Account ID
   * @param data - Update data
   * @returns Updated account
   *
   * @example
   * ```typescript
   * const account = await client.accounts.update(accountId, {
   *   status: 'inactive',
   * });
   * ```
   */
  async update(accountId: string, data: AccountUpdateRequest, options?: RequestOptions): Promise<Account> {
    return this.transport.request<Account>({
      method: 'PATCH',
      path: `/accounts/${accountId}`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
