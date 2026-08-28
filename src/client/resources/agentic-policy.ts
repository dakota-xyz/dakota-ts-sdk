/**
 * Agentic Client Policy resource (ALPHA).
 *
 * Agentic payments is a beta surface (x-beta, flag-gated on the platform)
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
 * The policy is per CLIENT — it belongs to the client behind your API key,
 * never to a key, since API keys are N:1 to clients and a per-key policy
 * would fragment for anyone running one service key per deployment.
 *
 * There is no client id to pass. The route resolves the client from the API
 * key, so you cannot address another client's policy even to be refused.
 */
export class AgenticPolicyResource extends BaseResource {
  /**
   * Get the policy registered for the client behind your API key.
   *
   * A 404 here is the DEFAULT, not an error condition: with no registration
   * and no per-request policy the agent drafts on platform defaults, exactly
   * as it did before registration existed.
   *
   * @returns The normalized registered policy + its timestamps
   *
   * @example
   * ```typescript
   * try {
   *   const { policy } = await client.agenticPolicy.get();
   *   console.log(policy.labels);
   * } catch (e) {
   *   if (e instanceof APIError && e.statusCode === 404) {
   *     // No registration — platform defaults apply.
   *   }
   * }
   * ```
   */
  async get(): Promise<RegisteredAgenticClientPolicy> {
    return this.transport.request<RegisteredAgenticClientPolicy>({
      method: 'GET',
      path: '/agentic-policy',
    });
  }

  /**
   * Register — or fully replace — this client's agentic policy.
   *
   * Registration is the ONLY way to set a policy. A policy is a property of
   * the CLIENT, not of a request: carried per request, a drafting turn and
   * the accept that followed it could be judged by different rules. The
   * platform accordingly stopped reading `client_policy` from request bodies,
   * and one sent there is now ignored — silently, since the agent simply
   * narrates in the platform's nouns again ("destination", "mandate") with no
   * error anywhere. Registering once removes that failure mode.
   *
   * FULL REPLACE, not a merge — the registration IS your declared vocabulary,
   * so an omitted field means you no longer want it, and an empty body (`{}`)
   * clears the registration back to platform defaults.
   *
   * Validated exactly like the per-request copy, so an unknown key, an
   * unsupported value, or a label for an unimplemented concept is a 400 HERE,
   * at registration — not a surprise on a customer's first conversation.
   *
   * The client comes from your API key; there is no id to pass.
   *
   * @param policy - The complete policy (`{}` clears it)
   * @param options - Request options (e.g., custom idempotency key)
   * @returns The normalized stored policy + its timestamps
   *
   * @example
   * ```typescript
   * await client.agenticPolicy.set({
   *   payee_model: 'flat',
   *   payout_assets: ['USDC', 'USDT'],
   *   labels: { limit: 'spending limit', payee: 'recipient', limit_unit: 'USD' },
   *   payout_route: 'conversion_account_only',
   *   mandate_strategy: 'external_only',
   * });
   * ```
   */
  async set(
    policy: AgenticClientPolicy,
    options?: RequestOptions
  ): Promise<RegisteredAgenticClientPolicy> {
    return this.transport.request<RegisteredAgenticClientPolicy>({
      method: 'PUT',
      path: '/agentic-policy',
      body: policy,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }
}
