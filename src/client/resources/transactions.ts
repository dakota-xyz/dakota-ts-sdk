/**
 * Transactions resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import { APIError } from '../errors.js';
import type {
  OneOffTransaction,
  OneOffTransactionRequest,
  AutoTransaction,
  TransactionListParams,
  TransactionResourceType,
  WalletTransaction,
  ListParams,
  RequestOptions,
} from '../types.js';

/**
 * The row shape `GET /transactions` yields for a given set of filters.
 *
 * The family decides the shape, so the filters decide the element type: name
 * `wallet` or `auto_account` and you get that family's rows, anything else is
 * the `one_off` family this endpoint defaults to.
 */
export type TransactionRowFor<P extends TransactionListParams | undefined> = P extends {
  transaction_type: 'wallet';
}
  ? WalletTransaction
  : P extends { transaction_type: 'auto_account' }
    ? AutoTransaction
    : OneOffTransaction;

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
  async create(
    data: OneOffTransactionRequest,
    options?: RequestOptions
  ): Promise<OneOffTransaction> {
    return this.transport.request<OneOffTransaction>({
      method: 'POST',
      path: '/transactions',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List transactions.
   *
   * `GET /transactions` serves three resource families from one path, and the
   * family decides the row shape — so the family you ask for decides what this
   * iterator yields:
   *
   * | `transaction_type` | Yields |
   * |--------------------|--------|
   * | omitted or `'one_off'` | {@link OneOffTransaction} |
   * | `'wallet'` | {@link WalletTransaction} |
   * | `'auto_account'` | {@link AutoTransaction} (requires `customer_id`) |
   *
   * **The family is always named on the wire.** Left to the server, it is
   * INFERRED from the other filters, and `customer_id` on its own infers
   * `auto_account` — so `list({ customer_id })` would return that customer's
   * auto-account transactions while this method's type promised one-off ones.
   * Those rows parse into `OneOffTransaction` with missing fields rather than
   * failing, so nothing surfaced the substitution. Omitting the family here
   * therefore sends `transaction_type=one_off` rather than leaving it open.
   *
   * The family the server reports back (`meta.transaction_type`) is checked
   * against the one requested, and a mismatch throws instead of yielding rows
   * of the wrong shape.
   *
   * @param params - Filter and pagination parameters
   * @returns Async iterator over the requested family
   *
   * @example
   * ```typescript
   * // One-off transactions (the default family)
   * for await (const tx of client.transactions.list()) {
   *   console.log(tx.id, tx.status);
   * }
   *
   * // This customer's ONE-OFF transactions
   * const completed = client.transactions.list({
   *   customer_id: customerId,
   *   status: 'completed',
   * });
   *
   * // This customer's AUTO-ACCOUNT transactions — a different family,
   * // and a different row shape
   * for await (const tx of client.transactions.list({
   *   transaction_type: 'auto_account',
   *   customer_id: customerId,
   * })) {
   *   console.log(tx.id);
   * }
   *
   * // Wallet transactions
   * const sent = client.transactions.list({
   *   transaction_type: 'wallet',
   *   wallet_id: walletId,
   *   direction: 'out',
   * });
   * ```
   */
  list<P extends TransactionListParams | undefined = undefined>(
    params?: P
  ): PaginatedIterator<TransactionRowFor<P>> {
    // Name the family rather than letting the server infer one. See the doc
    // comment: an inferred family is how `{ customer_id }` came back as
    // auto-account rows typed as one-off ones.
    const requested: TransactionResourceType = params?.transaction_type ?? 'one_off';

    return this.paginate<TransactionRowFor<P>>(
      '/transactions',
      { ...params, transaction_type: requested },
      undefined,
      (meta) => assertFamily(meta, requested)
    );
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
      timeout: options?.timeout,
    });
  }
}

/**
 * Fail a page whose family is not the one asked for.
 *
 * A POSITIVE mismatch only. An absent `transaction_type` means the response
 * made no claim about its family — older servers and the bare-array list
 * shapes do not send one — and treating silence as a mismatch would turn a
 * backstop into a new way for a working call to fail.
 */
function assertFamily(
  meta: Record<string, unknown> | undefined,
  requested: TransactionResourceType
): void {
  const served = meta?.transaction_type;
  if (typeof served !== 'string' || served === requested) return;

  throw new APIError(
    200,
    'transaction_family_mismatch',
    `Asked for ${requested} transactions but the server listed ${served}. ` +
      'The rows in this page are not the shape this iterator yields, so they ' +
      'are not returned.',
    { details: { requested, served } }
  );
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
