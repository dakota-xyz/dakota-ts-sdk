/**
 * Agentic Client Policy resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import type {
  AgenticClientPolicy,
  RegisteredAgenticClientPolicy,
  RequestOptions,
} from '../types.js';

/**
 * Agentic Client Policy API resource (ALPHA).
 *
 * The policy is per CLIENT — it belongs to the `client_id` behind your API
 * key, never to a key, since API keys are N:1 to clients and a per-key policy
 * would fragment for anyone running one service key per deployment.
 *
 * You may read and write your OWN policy; another client's is a 403.
 */
export class AgenticPolicyResource extends BaseResource {
  /**
   * Get the policy registered for this client.
   *
   * A 404 here is the DEFAULT, not an error condition: with no registration
   * and no per-request policy the agent drafts on platform defaults, exactly
   * as it did before registration existed.
   *
   * @param clientId - Your client ID
   * @returns The normalized registered policy + its timestamps
   *
   * @example
   * ```typescript
   * try {
   *   const { policy } = await client.agenticPolicy.get(clientId);
   *   console.log(policy.labels);
   * } catch (e) {
   *   if (e instanceof APIError && e.statusCode === 404) {
   *     // No registration — platform defaults apply.
   *   }
   * }
   * ```
   */
  async get(clientId: string): Promise<RegisteredAgenticClientPolicy> {
    return this.transport.request<RegisteredAgenticClientPolicy>({
      method: 'GET',
      path: `/clients/${clientId}/agentic-policy`,
    });
  }

  /**
   * Register — or fully replace — this client's agentic policy.
   *
   * Declaring the vocabulary once removes a silent failure mode. Sending
   * `client_policy` in each proposals request still works and still wins, but
   * FORGETTING to send it fails silently: the agent just narrates in the
   * platform's nouns again ("destination", "mandate") and nothing errors
   * anywhere. A registration makes that impossible.
   *
   * FULL REPLACE, not a merge — the registration IS your declared vocabulary,
   * so an omitted field means you no longer want it, and an empty body (`{}`)
   * clears the registration back to platform defaults.
   *
   * Validated exactly like the per-request copy, so an unknown key, an
   * unsupported value, or a label for an unimplemented concept is a 400 HERE,
   * at registration — not a surprise on a customer's first conversation.
   *
   * @param clientId - Your client ID
   * @param policy - The complete policy (`{}` clears it)
   * @param options - Request options (e.g., custom idempotency key)
   * @returns The normalized stored policy + its timestamps
   *
   * @example
   * ```typescript
   * await client.agenticPolicy.set(clientId, {
   *   payee_model: 'flat',
   *   payout_assets: ['USDC', 'USDT'],
   *   labels: { limit: 'spending limit', payee: 'recipient', limit_unit: 'USD' },
   *   payout_route: 'conversion_account_only',
   *   mandate_strategy: 'external_only',
   * });
   * ```
   */
  async set(
    clientId: string,
    policy: AgenticClientPolicy,
    options?: RequestOptions
  ): Promise<RegisteredAgenticClientPolicy> {
    return this.transport.request<RegisteredAgenticClientPolicy>({
      method: 'PUT',
      path: `/clients/${clientId}/agentic-policy`,
      body: policy,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }
}
