/**
 * Payment Agents resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import { AGENTIC_MODEL_TIMEOUT_MS } from '../config.js';
import type {
  PaymentAgent,
  PaymentAgentCreateRequest,
  AgenticProposalsProgress,
  AgenticProposalsResult,
  CreateProposalsRequest,
  RequestOptions,
} from '../types.js';

/**
 * Payment Agents API resource (ALPHA).
 */
export class PaymentAgentsResource extends BaseResource {
  /**
   * Create a hosted payment agent.
   *
   * @param data - Payment agent creation data (customer_id, name, hosted)
   * @returns The created payment agent (id, signer_id, signer_public_key, state)
   */
  async create(data: PaymentAgentCreateRequest, options?: RequestOptions): Promise<PaymentAgent> {
    return this.transport.request<PaymentAgent>({
      method: 'POST',
      path: '/payment-agents',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Get a hosted payment agent.
   *
   * Returns the agent together with the wallets it can currently spend
   * from. `wallet_ids` are DERIVED at query time from the agent signer's
   * live signer-group membership, so they reflect the agent's access
   * right now — not just at creation time.
   *
   * @param paymentAgentId - Payment agent ID
   */
  async get(paymentAgentId: string): Promise<PaymentAgent> {
    return this.transport.request<PaymentAgent>({
      method: 'GET',
      path: `/payment-agents/${paymentAgentId}`,
    });
  }

  /**
   * Revoke a hosted payment agent.
   *
   * The agent can no longer be used, and its signing key is destroyed
   * in the isolated signer service (best-effort — the revoked state is
   * authoritative). Idempotent.
   *
   * The response's `signer_group_cleanup` names the signer groups the
   * (now-revoked) agent's signer still belongs to. A revoked signer can't
   * sign, but its group membership lingers — remove it with
   * `client.signerGroups.removeSigner(signer_group_id, signer_id)` to
   * finish de-provisioning.
   *
   * @param paymentAgentId - Payment agent ID
   * @returns The revoked payment agent (state=revoked, signer_group_cleanup?)
   */
  async revoke(paymentAgentId: string, options?: RequestOptions): Promise<PaymentAgent> {
    return this.transport.request<PaymentAgent>({
      method: 'POST',
      path: `/payment-agents/${paymentAgentId}/revoke`,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Draft payment proposals from a conversation.
   *
   * Pure cognition, no side effects: turn a customer's natural-language
   * request into reviewable proposals. Stateless — send the whole
   * conversation so far in `messages` on each call. Prefer
   * `AgentConversation` for multi-turn chat; use this directly only for
   * one-shot proposals.
   *
   * SLOW BY NATURE. A turn is a sequence of model calls — read the payees,
   * check balances, draft, revise — so a multi-payee request legitimately
   * runs minutes. It therefore defaults to {@link AGENTIC_MODEL_TIMEOUT_MS}
   * rather than the client's ordinary deadline. Pass `{ timeout }` to
   * change it for one call; an explicit client-wide `timeout` still wins.
   *
   * The result may carry `blockers` ALONGSIDE proposals — they are not
   * alternatives. Branch on `blocker.code`, not on `reply`, and ignore codes
   * you do not recognize.
   *
   * The vocabulary the agent drafts under is the one registered with
   * `client.agenticPolicy.set()`. It is not a property of this request —
   * a policy sent here is ignored, which is why the option to send one is
   * gone.
   *
   * @param paymentAgentId - Payment agent ID
   * @param data - Prompt and/or messages
   * @returns Proposals (at high confidence) and/or a conversational reply
   */
  async createProposals(
    paymentAgentId: string,
    data: CreateProposalsRequest,
    options?: RequestOptions
  ): Promise<AgenticProposalsResult> {
    return this.transport.request<AgenticProposalsResult>({
      method: 'POST',
      path: `/payment-agents/${paymentAgentId}/proposals`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
      endpointTimeout: AGENTIC_MODEL_TIMEOUT_MS,
    });
  }

  /**
   * Live progress of an in-flight drafting turn.
   *
   * A multi-payee drafting turn legitimately runs minutes (several sequential
   * model calls). While a `createProposals` call is in flight, poll this every
   * few seconds to show the customer what the agent is doing right now.
   *
   * Advisory display only. `active: false` means no turn is currently
   * publishing progress for this agent — idle, just finished, or served by
   * another instance — so fall back to a generic spinner. Never gate any
   * behaviour on this endpoint.
   *
   * The snapshot is coarse and customer-safe: a phase enum, one human
   * sentence, and the model round. Tool counts only — never payee names,
   * amounts, or addresses.
   *
   * @param paymentAgentId - Payment agent ID
   * @returns The current progress snapshot
   *
   * @example
   * ```typescript
   * const pending = client.paymentAgents.createProposals(agentId, { prompt });
   * const poll = setInterval(async () => {
   *   const p = await client.paymentAgents.getProposalsProgress(agentId);
   *   if (p.active) console.log(p.detail);
   * }, 3000);
   * const result = await pending.finally(() => clearInterval(poll));
   * ```
   */
  async getProposalsProgress(paymentAgentId: string): Promise<AgenticProposalsProgress> {
    return this.transport.request<AgenticProposalsProgress>({
      method: 'GET',
      path: `/payment-agents/${paymentAgentId}/proposals/progress`,
    });
  }
}
