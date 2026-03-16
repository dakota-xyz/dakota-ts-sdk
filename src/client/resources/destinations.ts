/**
 * Destinations resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type { Destination, DestinationRequest, ListParams } from '../types.js';

/**
 * Destinations API resource.
 */
export class DestinationsResource extends BaseResource {
  /**
   * Create a new destination for a recipient.
   *
   * Destinations can be bank accounts (fiat_us) or crypto wallets (crypto).
   *
   * @param recipientId - Recipient ID
   * @param data - Destination creation data
   * @returns Created destination
   *
   * @example
   * ```typescript
   * // Create a bank destination (for off-ramp)
   * const bankDest = await client.destinations.create(recipientId, {
   *   destination_type: 'fiat_us',
   *   bank_name: 'Chase Bank',
   *   account_holder_name: 'Acme Corp',
   *   account_number: '123456789',
   *   routing_number: '021000021',
   *   account_type: 'checking',
   * });
   *
   * // Create a crypto destination (for on-ramp)
   * const cryptoDest = await client.destinations.create(recipientId, {
   *   destination_type: 'crypto',
   *   crypto_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
   *   network_id: 'ethereum-mainnet',
   * });
   * ```
   */
  async create(recipientId: string, data: DestinationRequest): Promise<Destination> {
    return this.transport.request<Destination>({
      method: 'POST',
      path: `/recipients/${recipientId}/destinations`,
      body: data,
    });
  }

  /**
   * List destinations for a recipient.
   *
   * @param recipientId - Recipient ID
   * @param params - Pagination parameters
   * @returns Async iterator of destinations
   *
   * @example
   * ```typescript
   * for await (const dest of client.destinations.list(recipientId)) {
   *   console.log(dest);
   * }
   * ```
   */
  list(recipientId: string, params?: ListParams): PaginatedIterator<Destination> {
    return this.paginate<Destination>(
      `/recipients/${recipientId}/destinations`,
      params,
      (item) => item.destination_id
    );
  }
}
