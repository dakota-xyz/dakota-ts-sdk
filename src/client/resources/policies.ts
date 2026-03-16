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
  ListParams,
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
  async create(data: PolicyCreateRequest): Promise<Policy> {
    return this.transport.request<Policy>({
      method: 'POST',
      path: '/policies',
      body: data,
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
   * @param policyId - Policy ID
   */
  async delete(policyId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/policies/${policyId}`,
    });
  }

  /**
   * Add a rule to a policy.
   *
   * @param policyId - Policy ID
   * @param data - Rule creation data
   * @returns Created rule
   */
  async addRule(policyId: string, data: PolicyRuleCreateRequest): Promise<PolicyRule> {
    return this.transport.request<PolicyRule>({
      method: 'POST',
      path: `/policies/${policyId}/rules`,
      body: data,
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
    data: Partial<PolicyRuleCreateRequest>
  ): Promise<PolicyRule> {
    return this.transport.request<PolicyRule>({
      method: 'PATCH',
      path: `/policies/${policyId}/rules/${ruleId}`,
      body: data,
    });
  }

  /**
   * Delete a policy rule.
   *
   * @param policyId - Policy ID
   * @param ruleId - Rule ID
   */
  async deleteRule(policyId: string, ruleId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/policies/${policyId}/rules/${ruleId}`,
    });
  }

  /**
   * Attach a policy to a wallet.
   *
   * @param policyId - Policy ID
   * @param walletId - Wallet ID
   */
  async attachToWallet(policyId: string, walletId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'PUT',
      path: `/policies/${policyId}/wallets/${walletId}`,
    });
  }

  /**
   * Detach a policy from a wallet.
   *
   * @param policyId - Policy ID
   * @param walletId - Wallet ID
   */
  async detachFromWallet(policyId: string, walletId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/policies/${policyId}/wallets/${walletId}`,
    });
  }
}
