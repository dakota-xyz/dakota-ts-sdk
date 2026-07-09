/**
 * Payment Agents resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import type {
  PaymentAgent,
  PaymentAgentCreateRequest,
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
    });
  }
}
