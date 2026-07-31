/**
 * Insights resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import { AGENTIC_MODEL_TIMEOUT_MS } from '../config.js';
import type {
  InsightReport,
  InsightChatRequest,
  InsightChatResponse,
  RequestOptions,
} from '../types.js';

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

  /**
   * Ask about the customer's account.
   *
   * A read-only, advisory conversation. Stateless: send the conversation so
   * far in `messages` on each call; the response is the assistant's next
   * plain-text `reply`. The assistant narrates the same deterministic report
   * {@link get} returns — it never originates a number, never proposes, and
   * never moves money. Rate-limited per customer (hourly burst + daily
   * window) — a 429 means back off and retry later.
   *
   * Model-backed, so it defaults to {@link AGENTIC_MODEL_TIMEOUT_MS} rather
   * than the client's ordinary deadline. Pass `{ timeout }` to change it for
   * one call; an explicit client-wide `timeout` still wins.
   *
   * @param customerId - Customer ID
   * @param data - The conversation so far (1–40 messages)
   * @returns The assistant's reply (+ how the boundary screen treated the turn)
   */
  async chat(
    customerId: string,
    data: InsightChatRequest,
    options?: RequestOptions
  ): Promise<InsightChatResponse> {
    return this.transport.request<InsightChatResponse>({
      method: 'POST',
      path: `/customers/${customerId}/insights/chat`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
      endpointTimeout: AGENTIC_MODEL_TIMEOUT_MS,
    });
  }
}
