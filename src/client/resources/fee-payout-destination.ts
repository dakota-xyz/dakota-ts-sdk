/**
 * Fee Payout Destination resource.
 *
 * Where Dakota pays your accrued developer fees. Exactly ONE destination
 * exists per organization, and it is crypto-only — a USDC wallet on any
 * supported chain.
 */

import { BaseResource } from './base.js';
import type {
  FeePayoutDestination,
  PutFeePayoutDestinationRequest,
  RequestOptions,
} from '../types.js';

/**
 * Fee Payout Destination API resource.
 */
export class FeePayoutDestinationResource extends BaseResource {
  /**
   * Get the destination registered to receive your developer-fee payouts.
   *
   * @returns The registered destination
   *
   * @example
   * ```typescript
   * const dest = await client.feePayoutDestination.get();
   * console.log(dest.chain, dest.wallet_address);
   * ```
   */
  async get(): Promise<FeePayoutDestination> {
    return this.transport.request<FeePayoutDestination>({
      method: 'GET',
      path: '/fee-payout-destination',
    });
  }

  /**
   * Register or replace your fee payout destination.
   *
   * There is exactly one destination per organization, so this REPLACES any
   * existing one. Emits `fee_payout_destination.updated`.
   *
   * `chain` is a CAIP-2 chain id (e.g. `eip155:8453`) from the supported
   * networks list — see `client.info.getNetworks()`.
   *
   * @param data - The USDC wallet to pay fees to
   * @param options - Request options (e.g., custom idempotency key)
   * @returns The stored destination
   *
   * @example
   * ```typescript
   * const dest = await client.feePayoutDestination.set({
   *   usdc_wallet: {
   *     chain: 'eip155:8453',
   *     address: '0x1234567890123456789012345678901234567890',
   *   },
   * });
   * ```
   */
  async set(
    data: PutFeePayoutDestinationRequest,
    options?: RequestOptions
  ): Promise<FeePayoutDestination> {
    return this.transport.request<FeePayoutDestination>({
      method: 'PUT',
      path: '/fee-payout-destination',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Remove the registered fee payout destination, if one exists.
   *
   * Emits `fee_payout_destination.deleted`.
   *
   * @example
   * ```typescript
   * await client.feePayoutDestination.delete();
   * ```
   */
  async delete(): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: '/fee-payout-destination',
    });
  }
}
