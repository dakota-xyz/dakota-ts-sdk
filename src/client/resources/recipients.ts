/**
 * Recipients resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type { Recipient, RecipientRequest, RecipientUpdateRequest, ListParams } from '../types.js';

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
   * });
   * ```
   */
  async create(customerId: string, data: RecipientRequest): Promise<Recipient> {
    return this.transport.request<Recipient>({
      method: 'POST',
      path: `/customers/${customerId}/recipients`,
      body: data,
    });
  }

  /**
   * List recipients for a customer.
   *
   * @param customerId - Customer ID
   * @param params - Pagination parameters
   * @returns Async iterator of recipients
   *
   * @example
   * ```typescript
   * for await (const recipient of client.recipients.list(customerId)) {
   *   console.log(recipient.name);
   * }
   * ```
   */
  list(customerId: string, params?: ListParams): PaginatedIterator<Recipient> {
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
  async update(recipientId: string, data: RecipientUpdateRequest): Promise<Recipient> {
    return this.transport.request<Recipient>({
      method: 'PUT',
      path: `/recipients/${recipientId}`,
      body: data,
    });
  }
}
