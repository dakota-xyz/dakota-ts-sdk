/**
 * Transactions resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  OneOffTransaction,
  OneOffTransactionRequest,
  AutoTransaction,
  TransactionListParams,
  ListParams,
  RequestOptions,
} from '../types.js';

/**
 * Transactions API resource.
 */
export class TransactionsResource extends BaseResource {
  /**
   * Create a one-off transaction.
   *
   * One-off transactions allow single transfers without setting up accounts.
   *
   * @param data - Transaction creation data
   * @param options - Request options (e.g., custom idempotency key)
   * @returns Created transaction
   *
   * @example
   * ```typescript
   * const tx = await client.transactions.create({
   *   customer_id: customerId,
   *   amount: '1000.00',
   *   source_asset: 'USDC',
   *   source_network_id: 'ethereum-mainnet',
   *   destination_id: destinationId,
   *   destination_asset: 'USD',
   *   destination_payment_rail: 'ach',
   *   payment_reference: 'Invoice #12345',
   * });
   *
   * // With custom idempotency key
   * const tx = await client.transactions.create(
   *   { customer_id: customerId, amount: '1000.00', ... },
   *   { idempotencyKey: 'invoice-12345-payment' }
   * );
   *
   * console.log(tx.crypto_address); // Send USDC here
   * console.log(tx.status); // Transaction status
   * ```
   */
  async create(data: OneOffTransactionRequest, options?: RequestOptions): Promise<OneOffTransaction> {
    return this.transport.request<OneOffTransaction>({
      method: 'POST',
      path: '/transactions',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * List one-off transactions.
   *
   * @param params - Filter and pagination parameters
   * @returns Async iterator of transactions
   *
   * @example
   * ```typescript
   * // List all transactions
   * for await (const tx of client.transactions.list()) {
   *   console.log(tx.id, tx.status);
   * }
   *
   * // Filter by customer and status
   * const completed = client.transactions.list({
   *   customer_id: customerId,
   *   status: 'completed',
   * });
   * ```
   */
  list(params?: TransactionListParams): PaginatedIterator<OneOffTransaction> {
    return this.paginate<OneOffTransaction>('/transactions', params);
  }

  /**
   * Get a transaction by ID.
   *
   * @param transactionId - Transaction ID
   * @returns Transaction record
   *
   * @example
   * ```typescript
   * const tx = await client.transactions.get(transactionId);
   * console.log(tx.status);
   * ```
   */
  async get(transactionId: string): Promise<OneOffTransaction> {
    return this.transport.request<OneOffTransaction>({
      method: 'GET',
      path: `/transactions/${transactionId}`,
    });
  }

  /**
   * Cancel a transaction.
   *
   * Only pending transactions can be cancelled.
   *
   * @param transactionId - Transaction ID
   * @param options - Request options (e.g., custom idempotency key)
   * @returns Cancelled transaction
   *
   * @example
   * ```typescript
   * const tx = await client.transactions.cancel(transactionId);
   * console.log(tx.status); // 'cancelled'
   * ```
   */
  async cancel(transactionId: string, options?: RequestOptions): Promise<OneOffTransaction> {
    return this.transport.request<OneOffTransaction>({
      method: 'POST',
      path: `/transactions/${transactionId}/cancellations`,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}

/**
 * Auto Transactions API resource.
 */
export class AutoTransactionsResource extends BaseResource {
  /**
   * List auto transactions.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of auto transactions
   */
  list(params?: ListParams): PaginatedIterator<AutoTransaction> {
    return this.paginate<AutoTransaction>('/auto-transactions', params);
  }

  /**
   * Get an auto transaction by ID.
   *
   * @param transactionId - Auto transaction ID
   * @returns Auto transaction record
   */
  async get(transactionId: string): Promise<AutoTransaction> {
    return this.transport.request<AutoTransaction>({
      method: 'GET',
      path: `/auto-transactions/${transactionId}`,
    });
  }
}
