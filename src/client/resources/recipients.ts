/**
 * Recipients resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  Recipient,
  RecipientRequest,
  RecipientUpdateRequest,
  RecipientListParams,
  RequestOptions,
} from '../types.js';

/**
 * Recipients API resource.
 */
export class RecipientsResource extends BaseResource {
  /**
   * Create a new recipient for a customer.
   *
   * Recipients represent entities that can receive payments.
   *
   * @param customerId - Customer ID
   * @param data - Recipient creation data
   * @returns Created recipient
   *
   * @example
   * ```typescript
   * const recipient = await client.recipients.create(customerId, {
   *   name: 'Treasury Account',
   *   external_id: 'vendor-1177', // optional: your own label, not unique
   * });
   * ```
   */
  async create(
    customerId: string,
    data: RecipientRequest,
    options?: RequestOptions
  ): Promise<Recipient> {
    return this.transport.request<Recipient>({
      method: 'POST',
      path: `/customers/${customerId}/recipients`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List recipients for a customer.
   *
   * @param customerId - Customer ID
   * @param params - Pagination parameters and an optional `external_id` filter
   * @returns Async iterator of recipients
   *
   * @example
   * ```typescript
   * for await (const recipient of client.recipients.list(customerId)) {
   *   console.log(recipient.name);
   * }
   *
   * // Look up recipients by your own label
   * const matches = await client.recipients
   *   .list(customerId, { external_id: 'vendor-1177' })
   *   .toArray();
   * ```
   */
  list(customerId: string, params?: RecipientListParams): PaginatedIterator<Recipient> {
    return this.paginate<Recipient>(`/customers/${customerId}/recipients`, params);
  }

  /**
   * Get a recipient by ID.
   *
   * @param recipientId - Recipient ID
   * @returns Recipient record
   *
   * @example
   * ```typescript
   * const recipient = await client.recipients.get(recipientId);
   * ```
   */
  async get(recipientId: string): Promise<Recipient> {
    return this.transport.request<Recipient>({
      method: 'GET',
      path: `/recipients/${recipientId}`,
    });
  }

  /**
   * Update a recipient.
   *
   * @param recipientId - Recipient ID
   * @param data - Update data
   * @returns Updated recipient
   *
   * @example
   * ```typescript
   * const recipient = await client.recipients.update(recipientId, {
   *   name: 'Updated Name',
   * });
   * ```
   */
  async update(
    recipientId: string,
    data: RecipientUpdateRequest,
    options?: RequestOptions
  ): Promise<Recipient> {
    return this.transport.request<Recipient>({
      method: 'PUT',
      path: `/recipients/${recipientId}`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Delete a recipient.
   *
   * @param recipientId - Recipient ID
   *
   * @example
   * ```typescript
   * await client.recipients.delete(recipientId);
   * ```
   */
  async delete(recipientId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/recipients/${recipientId}`,
    });
  }
}
