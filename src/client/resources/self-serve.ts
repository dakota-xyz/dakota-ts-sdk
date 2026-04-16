/**
 * Self-Serve Credits resource for managing prepaid transfer credits.
 */

import { BaseResource } from './base.js';
import type {
  SelfServeCreditsPurchaseRequest,
  SelfServeCreditsPurchaseResponse,
  SelfServeCreditsBalanceResponse,
  SelfServeCreditsLedgerResponse,
  SelfServeCreditsLedgerParams,
  SelfServeCreditTiersResponse,
  RequestOptions,
} from '../types.js';

/**
 * Self-Serve Credits API resource.
 *
 * Manage prepaid credits for self-serve transfer capacity.
 */
export class SelfServeResource extends BaseResource {
  /**
   * Purchase self-serve credits.
   *
   * Creates a Stripe checkout session for purchasing credits at the specified tier.
   *
   * @param data - Purchase request with the tier price
   * @param options - Optional request options (e.g., idempotency key)
   * @returns Response containing the Stripe checkout URL
   *
   * @example
   * ```typescript
   * const { checkout_url } = await client.selfServe.purchaseCredits({
   *   tier_price_cents: 10000,
   * });
   * // Redirect user to checkout_url
   * ```
   */
  async purchaseCredits(
    data: SelfServeCreditsPurchaseRequest,
    options?: RequestOptions
  ): Promise<SelfServeCreditsPurchaseResponse> {
    return this.transport.request<SelfServeCreditsPurchaseResponse>({
      method: 'POST',
      path: '/self-serve/credits/purchase',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Get current credits balance.
   *
   * @returns The current balance and transfer capacity in cents
   *
   * @example
   * ```typescript
   * const balance = await client.selfServe.getBalance();
   * console.log(`Balance: $${balance.balance_cents / 100}`);
   * console.log(`Transfer capacity: $${balance.transfer_capacity_cents / 100}`);
   * ```
   */
  async getBalance(): Promise<SelfServeCreditsBalanceResponse> {
    return this.transport.request<SelfServeCreditsBalanceResponse>({
      method: 'GET',
      path: '/self-serve/credits/balance',
    });
  }

  /**
   * List credits ledger entries.
   *
   * Returns a cursor-paginated list of ledger entries (purchases, deductions, refunds).
   *
   * @param params - Optional query parameters for filtering and pagination
   * @returns Ledger response with entries and has_more flag
   *
   * @example
   * ```typescript
   * // Get recent ledger entries
   * const ledger = await client.selfServe.listLedger();
   * for (const entry of ledger.entries) {
   *   console.log(entry.entry_type, entry.amount_cents, entry.description);
   * }
   *
   * // Filter by type with pagination
   * const purchases = await client.selfServe.listLedger({
   *   type: 'purchase',
   *   limit: 50,
   * });
   * ```
   */
  async listLedger(params?: SelfServeCreditsLedgerParams): Promise<SelfServeCreditsLedgerResponse> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params?.cursor !== undefined) query.cursor = params.cursor;
    if (params?.limit !== undefined) query.limit = params.limit;
    if (params?.type !== undefined) query.type = params.type;

    return this.transport.request<SelfServeCreditsLedgerResponse>({
      method: 'GET',
      path: '/self-serve/credits/ledger',
      query,
    });
  }

  /**
   * List available credit tiers.
   *
   * Returns all available pricing tiers for purchasing credits.
   *
   * @returns Response containing the list of available tiers
   *
   * @example
   * ```typescript
   * const { tiers } = await client.selfServe.listTiers();
   * for (const tier of tiers) {
   *   console.log(`$${tier.price_cents / 100} → $${tier.transfer_capacity_cents / 100} capacity`);
   * }
   * ```
   */
  async listTiers(): Promise<SelfServeCreditTiersResponse> {
    return this.transport.request<SelfServeCreditTiersResponse>({
      method: 'GET',
      path: '/self-serve/credits/tiers',
    });
  }
}
