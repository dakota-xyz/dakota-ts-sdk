/**
 * Reserve-management marketing-fee statements resource.
 */

import { BaseResource } from './base.js';
import type { RDMarketingFeeStatement } from '../types.js';

/**
 * RD Marketing Fee API resource.
 *
 * The reserve-management statements for the calling client. The client comes
 * from the session and is never named in a request, so there is no id to pass
 * and no other client's statements to address.
 *
 * A client who has never had a rate gets a **404** from both methods: holding a
 * rate is what being in the programme means, and there is no separate
 * entitlement record to read.
 */
export class RDMarketingFeeResource extends BaseResource {
  /**
   * The months this client has a statement for, newest first.
   *
   * Runs from the start of their contract to the running month, and the
   * RUNNING month IS included. It cannot be priced yet — the bank's interest
   * posts in the month after it is earned — but the balance is real and
   * accruing, and a client checking mid-month has to be able to see it. Its
   * fee figures come back absent rather than zero.
   *
   * An EMPTY list means the contract is real but no month has started yet.
   * That is different from a 404, which means no contract at all.
   *
   * @returns Statement months as `YYYY-MM-DD` (first day of the month, UTC)
   *
   * @example
   * ```typescript
   * const months = await client.rdMarketingFee.listMonths();
   * if (months.length === 0) {
   *   // Contract starts next month or later — "starting soon", not an error.
   * }
   * ```
   */
  async listMonths(): Promise<string[]> {
    const response = await this.transport.request<{ months?: string[] }>({
      method: 'GET',
      path: '/rd-marketing-fee/statements',
    });
    return response.months ?? [];
  }

  /**
   * One month's statement — one row per calendar day: the date, the RD
   * balance, and that day's fee.
   *
   * The rows are the STORED daily principals, read rather than recomputed, so
   * what the client reads and what Dakota priced cannot drift.
   *
   * Absent is not zero. A balance is absent when the day has not been derived
   * yet and `'0'` when the client genuinely held no RD; fees are absent for
   * every day of a month whose rate has not been derived. Neither unknown is
   * reported as a zero, so render an absent figure as unknown rather than
   * defaulting it.
   *
   * @param month - First day of the month, UTC, as `YYYY-MM-DD`
   * @returns The month's statement, one row per day
   *
   * @example
   * ```typescript
   * const statement = await client.rdMarketingFee.getStatement('2026-08-01');
   * for (const day of statement.daily) {
   *   console.log(day.date, day.balance_minor ?? 'not yet derived');
   * }
   * ```
   */
  async getStatement(month: string): Promise<RDMarketingFeeStatement> {
    return this.transport.request<RDMarketingFeeStatement>({
      method: 'GET',
      path: `/rd-marketing-fee/statements/${month}`,
    });
  }
}
