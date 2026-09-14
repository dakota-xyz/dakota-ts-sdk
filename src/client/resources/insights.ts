/**
 * Insights resource (BETA).
 *
 * Agentic payments is a beta surface (x-beta, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import type { ClientInsightReport, ClientInsightsParams, InsightReport } from '../types.js';

/**
 * Insights API resource (BETA).
 *
 * Read-only, advisory reporting over agentic activity — one customer's, or
 * the whole client's book. Nothing here moves money or changes state.
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

  /**
   * Get the client-level portfolio insight report.
   *
   * The client-scope companion of {@link get}: one deterministic, read-only
   * report over ALL of the caller's customers' agentic activity. Items reuse
   * the customer report's shape, plus `customer_id` (omitted on
   * cross-customer aggregates) and `responsibility` (a grouping label for
   * filtering — not ownership). On top of the items the report carries
   * dashboard-shaped data: KPI `metrics` with previous-window values for
   * trend deltas, daily `series` for charts, and a per-customer roll-up in
   * `customers` sorted worst-first.
   *
   * Every filter is optional and only NARROWS the report; the response shape
   * never changes. The report scans at most 100 customers per request —
   * `snapshot.customers.scanned < total` says it was computed over a prefix
   * of the book, never silently.
   *
   * A 404 means agentic payments are not enabled for the key, or the
   * `customer_id` filter names an unknown customer.
   *
   * @param params - Optional filters and the report window
   * @returns The client's portfolio insight report
   *
   * @example
   * ```typescript
   * const report = await client.insights.getClientReport({
   *   severity: 'critical,warn',
   *   window_days: 30,
   * });
   * for (const row of report.customers) {
   *   if (row.item_counts.critical > 0) console.log(row.customer_id, row.name);
   * }
   * ```
   */
  async getClientReport(params?: ClientInsightsParams): Promise<ClientInsightReport> {
    return this.transport.request<ClientInsightReport>({
      method: 'GET',
      path: '/insights',
      query: { ...params },
    });
  }
}
