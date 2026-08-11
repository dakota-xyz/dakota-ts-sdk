/**
 * Insights resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import type { InsightReport } from '../types.js';

/**
 * Insights API resource (ALPHA).
 *
 * Read-only, advisory reporting over a customer's agentic activity. Nothing
 * here moves money or changes state.
 */
export class InsightsResource extends BaseResource {
  /**
   * Get the customer's account insight report.
   *
   * A deterministic, read-only report: a snapshot of typed facts
   * (funding-wallet balances, upcoming totals, open payments, active
   * mandates), observations (`insights`), and advisory recommendations
   * (`suggestions`). Every item carries `evidence` — typed references to
   * the platform objects it was computed from. `kind` is an OPEN set;
   * ignore kinds you do not recognize.
   *
   * @param customerId - Customer ID
   * @returns The customer's insight report
   */
  async get(customerId: string): Promise<InsightReport> {
    return this.transport.request<InsightReport>({
      method: 'GET',
      path: `/customers/${customerId}/insights`,
    });
  }
}
