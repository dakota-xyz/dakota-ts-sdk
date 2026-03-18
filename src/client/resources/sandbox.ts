/**
 * Sandbox resource for testing simulations.
 *
 * @remarks
 * These endpoints are only available in the Sandbox environment.
 * In sandbox, Dakota does NOT monitor testnet blockchains - you must
 * use these simulation endpoints to trigger payment events.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  SimulateInboundRequest,
  SimulationResponse,
  SimulateOnboardingRequest,
  SimulateOnboardingResponse,
  AdvanceSimulationRequest,
  AdvanceSimulationResult,
  SimulationInspection,
  SandboxScenario,
  ListParams,
} from '../types.js';

/**
 * Sandbox API resource for testing simulations.
 *
 * These endpoints are only available in the Sandbox environment.
 *
 * @remarks
 * **Important:** In sandbox, Dakota does NOT monitor testnet blockchains.
 * You must use these simulation endpoints to trigger payment events.
 *
 * @example
 * ```typescript
 * // Simulate ACH deposit to on-ramp account
 * await client.sandbox.simulateInbound({
 *   simulation_id: `sim_${Date.now()}`,
 *   type: 'ach_inbound',
 *   account_id: 'acc_123',
 *   amount: '1000.00',
 *   currency: 'USD',
 * });
 *
 * // Simulate off-ramp ACH settlement
 * await client.sandbox.simulateInbound({
 *   simulation_id: `sim_${Date.now()}`,
 *   type: 'ach_outbound_settled',
 *   movement_id: 'tx_456',
 *   amount: '500.00',
 *   currency: 'USD',
 * });
 * ```
 */
export class SandboxResource extends BaseResource {
  /**
   * Simulate an inbound payment event.
   *
   * Triggers a simulated payment event through the mock banking provider.
   * The required fields depend on the simulation `type`:
   *
   * | Type | Required Fields |
   * |------|-----------------|
   * | `ach_inbound`, `wire_inbound` | `account_id` |
   * | `crypto_inbound` | `wallet_id` |
   * | `*_outbound_*`, `*_reversal` | `movement_id` |
   *
   * @param data - Simulation request data
   * @returns Simulation response with ID and state
   *
   * @example Simulate ACH deposit to on-ramp
   * ```typescript
   * const result = await client.sandbox.simulateInbound({
   *   simulation_id: `sim_${Date.now()}`,
   *   type: 'ach_inbound',
   *   account_id: 'acc_123',
   *   amount: '1000.00',
   *   currency: 'USD',
   * });
   * ```
   *
   * @example Simulate off-ramp ACH settlement
   * ```typescript
   * // After creating a one-off transaction for off-ramp testing
   * const tx = await client.transactions.create({
   *   customer_id: 'cust_123',
   *   amount: '100.00',
   *   source_asset: 'USDC',
   *   source_network_id: 'ethereum-sepolia',
   *   destination_id: 'dest_456',
   *   destination_asset: 'USD',
   *   destination_payment_rail: 'ach',
   * });
   *
   * // Simulate the ACH settlement
   * await client.sandbox.simulateInbound({
   *   simulation_id: `sim_${Date.now()}`,
   *   type: 'ach_outbound_settled',
   *   movement_id: tx.id,
   *   amount: '100.00',
   *   currency: 'USD',
   * });
   * ```
   *
   * @example Simulate crypto deposit to wallet
   * ```typescript
   * const result = await client.sandbox.simulateInbound({
   *   simulation_id: `sim_${Date.now()}`,
   *   type: 'crypto_inbound',
   *   wallet_id: 'wallet_789',
   *   amount: '500.00',
   *   currency: 'USDC',
   * });
   * ```
   */
  async simulateInbound(data: SimulateInboundRequest): Promise<SimulationResponse> {
    return this.transport.request<SimulationResponse>({
      method: 'POST',
      path: '/sandbox/simulate/inbound',
      body: data,
    });
  }

  /**
   * Simulate an onboarding state transition.
   *
   * Drives KYB, KYC, or applicant account status through a sandbox transition
   * without waiting for real compliance review.
   *
   * **Important:** For full activation, you typically need TWO calls:
   * 1. `kyb_approve` - Approves the KYB application
   * 2. `applicant_activate` - Activates the applicant (triggers provisioning)
   *
   * @param data - Simulation request data
   * @returns Simulation response with previous and new state
   *
   * @example Approve KYB and activate applicant
   * ```typescript
   * // Step 1: Approve the KYB application
   * await client.sandbox.simulateOnboarding({
   *   type: 'kyb_approve',
   *   applicant_id: customer.application_id,
   *   simulation_id: `sim_kyb_${Date.now()}`,
   * });
   *
   * // Step 2: Activate the applicant (triggers provisioning)
   * await client.sandbox.simulateOnboarding({
   *   type: 'applicant_activate',
   *   applicant_id: customer.application_id,
   *   simulation_id: `sim_activate_${Date.now()}`,
   * });
   * ```
   *
   * @example Reject a KYB application
   * ```typescript
   * await client.sandbox.simulateOnboarding({
   *   type: 'kyb_reject',
   *   applicant_id: applicationId,
   *   simulation_id: `sim_${Date.now()}`,
   *   reason_code: 'MISSING_DOCUMENTS',
   * });
   * ```
   */
  async simulateOnboarding(data: SimulateOnboardingRequest): Promise<SimulateOnboardingResponse> {
    return this.transport.request<SimulateOnboardingResponse>({
      method: 'POST',
      path: '/sandbox/simulate/onboarding',
      body: data,
    });
  }

  /**
   * Get detailed simulation status and callback history.
   *
   * Returns the current state and callback delivery history for a sandbox simulation.
   * Use this to debug async flows and see whether callbacks have been delivered.
   *
   * @param simulationId - Simulation ID returned from simulateInbound/simulateOnboarding
   * @returns Full simulation inspection including state and callbacks
   *
   * @example
   * ```typescript
   * const inspection = await client.sandbox.getSimulation('sim_123');
   * console.log('State:', inspection.state);
   * console.log('Callbacks:', inspection.callbacks);
   * ```
   */
  async getSimulation(simulationId: string): Promise<SimulationInspection> {
    return this.transport.request<SimulationInspection>({
      method: 'GET',
      path: `/sandbox/simulations/${simulationId}`,
    });
  }

  /**
   * Advance a stateful simulation to the next state.
   *
   * Some scenarios pause and wait for explicit advancement. Use this method
   * to continue a paused simulation with a specific action.
   *
   * @param simulationId - Simulation ID
   * @param data - Action to take (e.g., 'release', 'reject', 'confirm', 'expire')
   * @returns Updated simulation state
   *
   * @example
   * ```typescript
   * const result = await client.sandbox.advanceSimulation('sim_123', {
   *   action: 'release',
   * });
   * console.log('New state:', result.new_state);
   * ```
   */
  async advanceSimulation(
    simulationId: string,
    data?: AdvanceSimulationRequest
  ): Promise<AdvanceSimulationResult> {
    return this.transport.request<AdvanceSimulationResult>({
      method: 'POST',
      path: `/sandbox/simulations/${simulationId}/advance`,
      body: data,
    });
  }

  /**
   * List available sandbox scenarios.
   *
   * Returns all simulation scenarios supported by the platform.
   * Use these scenario names in the `scenario` field of simulateInbound.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of scenarios
   *
   * @example
   * ```typescript
   * const scenarios = await client.sandbox.listScenarios().toArray();
   * for (const scenario of scenarios) {
   *   console.log(`${scenario.name}: ${scenario.description}`);
   * }
   * ```
   */
  listScenarios(params?: ListParams): PaginatedIterator<SandboxScenario> {
    return this.paginate<SandboxScenario>('/sandbox/scenarios', params);
  }
}
