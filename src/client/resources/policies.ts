/**
 * Policies resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  Policy,
  PolicyCreateRequest,
  PolicyRule,
  PolicyRuleCreateRequest,
  AttachedWallet,
  ListParams,
  RequestOptions,
} from '../types.js';

/**
 * Policies API resource.
 */
export class PoliciesResource extends BaseResource {
  /**
   * Create a new policy.
   *
   * @param data - Policy creation data
   * @returns Created policy
   */
  async create(data: PolicyCreateRequest, options?: RequestOptions): Promise<Policy> {
    return this.transport.request<Policy>({
      method: 'POST',
      path: '/policies',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List policies.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of policies
   */
  list(params?: ListParams): PaginatedIterator<Policy> {
    return this.paginate<Policy>('/policies', params);
  }

  /**
   * Get a policy by ID.
   *
   * @param policyId - Policy ID
   * @returns Policy record
   */
  async get(policyId: string): Promise<Policy> {
    return this.transport.request<Policy>({
      method: 'GET',
      path: `/policies/${policyId}`,
    });
  }

  /**
   * Delete a policy.
   *
   * Endorsed endpoint — `options.endorsement` must contain a signed
   * `DeletePolicyIntent`. The server rejects requests without a valid
   * endorsement body.
   *
   * @param policyId - Policy ID
   * @param options - Request options (must include `endorsement`)
   */
  async delete(policyId: string, options?: RequestOptions): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/policies/${policyId}`,
      body: options?.endorsement,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Add a rule to a policy.
   *
   * @param policyId - Policy ID
   * @param data - Rule creation data
   * @returns Created rule
   */
  async addRule(
    policyId: string,
    data: PolicyRuleCreateRequest,
    options?: RequestOptions
  ): Promise<PolicyRule> {
    return this.transport.request<PolicyRule>({
      method: 'POST',
      path: `/policies/${policyId}/rules`,
      body: options?.endorsement ?? data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Update a policy rule.
   *
   * @param policyId - Policy ID
   * @param ruleId - Rule ID
   * @param data - Update data
   * @returns Updated rule
   */
  async updateRule(
    policyId: string,
    ruleId: string,
    data: Partial<PolicyRuleCreateRequest>,
    options?: RequestOptions
  ): Promise<PolicyRule> {
    return this.transport.request<PolicyRule>({
      method: 'PATCH',
      path: `/policies/${policyId}/rules/${ruleId}`,
      body: options?.endorsement ?? data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Delete a policy rule.
   *
   * Endorsed endpoint — `options.endorsement` must contain a signed
   * `RemovePolicyRuleIntent`. The server rejects requests without a valid
   * endorsement body.
   *
   * @param policyId - Policy ID
   * @param ruleId - Rule ID
   * @param options - Request options (must include `endorsement`)
   */
  async deleteRule(policyId: string, ruleId: string, options?: RequestOptions): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/policies/${policyId}/rules/${ruleId}`,
      body: options?.endorsement,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Get wallets attached to a policy.
   *
   * Returns slim references (id + name + family) for the wallets the policy is currently attached to.
   *
   * @param policyId - Policy ID
   * @returns Array of attached wallets
   */
  async getWallets(policyId: string): Promise<AttachedWallet[]> {
    return this.transport.request<AttachedWallet[]>({
      method: 'GET',
      path: `/policies/${policyId}/wallets`,
    });
  }

  /**
   * Attach a policy to a wallet.
   *
   * Endorsed endpoint — `options.endorsement` must contain a signed
   * `AttachPolicyToWalletIntent`. The server rejects requests without a
   * valid endorsement body.
   *
   * The intent may carry the policy's `policy_version` (sign it with
   * `attachPolicyPayload(walletId, policyId, key, { policyVersion })`). If
   * the policy changed after the signatures were made, the request fails
   * with `StalePolicyVersionError` (409 `stale_policy_version`) and nothing
   * changes: read the policy again and sign again under a new key.
   *
   * @param policyId - Policy ID
   * @param walletId - Wallet ID
   * @param options - Request options (must include `endorsement`)
   */
  async attachToWallet(
    policyId: string,
    walletId: string,
    options?: RequestOptions
  ): Promise<void> {
    await this.transport.request<void>({
      method: 'PUT',
      path: `/policies/${policyId}/wallets/${walletId}`,
      body: options?.endorsement,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Detach a policy from a wallet.
   *
   * Endorsed endpoint — `options.endorsement` must contain a signed
   * `DetachPolicyFromWalletIntent`. The server rejects requests without a
   * valid endorsement body.
   *
   * Takes the same optional `policy_version` as {@link attachToWallet}
   * (sign it with `detachPolicyPayload(..., { policyVersion })`).
   *
   * @param policyId - Policy ID
   * @param walletId - Wallet ID
   * @param options - Request options (must include `endorsement`)
   */
  async detachFromWallet(
    policyId: string,
    walletId: string,
    options?: RequestOptions
  ): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/policies/${policyId}/wallets/${walletId}`,
      body: options?.endorsement,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }
}
