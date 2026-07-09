/**
 * Scheduled Payments resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  CreateScheduledPaymentRequest,
  RequestOptions,
  ScheduledPayment,
  ScheduledPaymentListParams,
} from '../types.js';

/**
 * Scheduled Payments API resource (ALPHA).
 */
export class ScheduledPaymentsResource extends BaseResource {
  /**
   * List scheduled payments (oldest due first).
   *
   * Narrow the collection with the optional customer_id, signer_id,
   * wallet_id, mandate_id, and status filters; omit them all for the full
   * client collection.
   *
   * @param params - Optional pagination + filter parameters
   * @returns Async iterator of scheduled payments
   */
  list(params?: ScheduledPaymentListParams): PaginatedIterator<ScheduledPayment> {
    return this.paginate<ScheduledPayment>('/scheduled-payments', params);
  }

  /**
   * Schedule payments directly — bypass the proposal flow.
   *
   * Creates one or more scheduled payments for a signer under an existing
   * active mandate (coverage is matched at fire time, so no new signature
   * is needed here). The schedule is explicit `dates` OR `count` ×
   * `interval_seconds` from `start_at`.
   *
   * @param data - Signer + wallet + destination (or address+network_id) + schedule
   * @returns The rows that were created (one per date)
   */
  async create(
    data: CreateScheduledPaymentRequest,
    options?: RequestOptions
  ): Promise<ScheduledPayment[]> {
    return this.transport.request<ScheduledPayment[]>({
      method: 'POST',
      path: '/scheduled-payments',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Cancel one still-scheduled payment.
   *
   * Finalizes the row as cancelled. No signature is required — schedule rows
   * are bookkeeping, not authorization; the signed grant is the MANDATE,
   * which this does not touch.
   *
   * @param scheduledPaymentId - Scheduled payment ID
   */
  async cancel(scheduledPaymentId: string, options?: RequestOptions): Promise<void> {
    await this.transport.request<void>({
      method: 'POST',
      path: `/scheduled-payments/${scheduledPaymentId}/cancel`,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
