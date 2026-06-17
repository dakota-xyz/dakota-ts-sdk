/**
 * Destinations resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  Destination,
  DestinationCreateResponse,
  DestinationRequest,
  ListParams,
  RequestOptions,
} from '../types.js';

/**
 * Destinations API resource.
 */
export class DestinationsResource extends BaseResource {
  /**
   * Create a new destination for a recipient.
   *
   * Destinations can be bank accounts (fiat_us / fiat_iban) or crypto
   * wallets (crypto).
   *
   * The platform returns just `{ id }` here (per `IDResponse`), not the
   * full destination object. Call `destinations.list(recipientId)` if
   * you need the rest of the fields.
   *
   * @param recipientId - Recipient ID
   * @param data - Destination creation data
   * @returns `{ id }` of the newly-created destination
   *
   * @example
   * ```typescript
   * // Crypto destination (for on-ramp)
   * const cryptoDest = await client.destinations.create(recipientId, {
   *   destination_type: 'crypto',
   *   name: 'Treasury USDC',
   *   crypto_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
   *   network_id: 'ethereum-mainnet',
   * });
   * // → cryptoDest.id
   *
   * // Fiat US destination (for off-ramp)
   * const bankDest = await client.destinations.create(recipientId, {
   *   destination_type: 'fiat_us',
   *   name: 'Acme Chase Checking',
   *   bank_name: 'JPMorgan Chase',
   *   account_holder_name: 'Acme Corp',
   *   account_number: '000123456789',
   *   aba_routing_number: '021000021',
   *   account_type: 'checking',
   * });
   * // → bankDest.id
   * ```
   */
  async create(
    recipientId: string,
    data: DestinationRequest,
    options?: RequestOptions
  ): Promise<DestinationCreateResponse> {
    return this.transport.request<DestinationCreateResponse>({
      method: 'POST',
      path: `/recipients/${recipientId}/destinations`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
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

  /**
   * Delete a destination.
   *
   * @param recipientId - Recipient ID
   * @param destinationId - Destination ID
   *
   * @example
   * ```typescript
   * await client.destinations.delete(recipientId, destinationId);
   * ```
   */
  async delete(recipientId: string, destinationId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/recipients/${recipientId}/destinations/${destinationId}`,
    });
  }
}
