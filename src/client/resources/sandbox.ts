/**
 * Sandbox resource for testing simulations.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  SimulateInboundRequest,
  SimulationResponse,
  SimulateOnboardingRequest,
  SandboxScenario,
  ListParams,
} from '../types.js';

/**
 * Sandbox API resource for testing simulations.
 *
 * These endpoints are only available in the Sandbox environment.
 */
export class SandboxResource extends BaseResource {
  /**
   * Simulate an inbound transaction (deposit).
   *
   * Simulates receiving funds at a Dakota-managed address.
   *
   * @param data - Simulation data
   * @returns Simulation response
   *
   * @example
   * ```typescript
   * const result = await client.sandbox.simulateInbound({
   *   account_id: accountId,
   *   amount: '1000.00',
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
   * Simulate onboarding completion.
   *
   * Simulates completing KYB verification for a customer.
   *
   * @param data - Simulation data
   * @returns Simulation response
   *
   * @example
   * ```typescript
   * const result = await client.sandbox.simulateOnboarding({
   *   type: 'kyb_approve',  // or 'kyb_reject', 'applicant_activate'
   *   applicant_id: applicationId,
   *   simulation_id: 'sim_' + Date.now(),
   * });
   * ```
   */
  async simulateOnboarding(data: SimulateOnboardingRequest): Promise<SimulationResponse> {
    return this.transport.request<SimulationResponse>({
      method: 'POST',
      path: '/sandbox/simulate/onboarding',
      body: data,
    });
  }

  /**
   * Get a simulation by ID.
   *
   * @param simulationId - Simulation ID
   * @returns Simulation response
   */
  async getSimulation(simulationId: string): Promise<SimulationResponse> {
    return this.transport.request<SimulationResponse>({
      method: 'GET',
      path: `/sandbox/simulations/${simulationId}`,
    });
  }

  /**
   * Advance a simulation to the next state.
   *
   * @param simulationId - Simulation ID
   * @returns Updated simulation
   */
  async advanceSimulation(simulationId: string): Promise<SimulationResponse> {
    return this.transport.request<SimulationResponse>({
      method: 'POST',
      path: `/sandbox/simulations/${simulationId}/advance`,
    });
  }

  /**
   * List available sandbox scenarios.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of scenarios
   */
  listScenarios(params?: ListParams): PaginatedIterator<SandboxScenario> {
    return this.paginate<SandboxScenario>('/sandbox/scenarios', params);
  }
}
