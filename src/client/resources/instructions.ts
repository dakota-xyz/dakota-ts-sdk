/**
 * Instructions resource (ALPHA).
 *
 * Agentic payments is a beta surface (x-beta, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import type {
  AgenticInstruction,
  AgenticInstructionsResult,
  CreateInstructionsRequest,
  RequestOptions,
} from '../types.js';

/**
 * Instructions API resource (ALPHA).
 *
 * Each accepted proposal becomes one persisted instruction whose action
 * series is actuated deterministically.
 */
export class InstructionsResource extends BaseResource {
  /**
   * Accept proposals — actuate them into persisted instructions.
   *
   * One optional field shapes the actuation:
   *
   * - `developer_fee` declares your fee PER PAYOUT TYPE — `swap_bps` for a
   *   crypto payout, `offramp_bps` for a bank payout. They are independent,
   *   so one conversation can charge a swap and stay silent about a bank
   *   payout in the same turn. Omit a rate (or send zero) and that payout
   *   type carries no fee: nothing is charged, nothing is added to the
   *   amount, and the agent is told nothing about a fee it could mention.
   *   Both are DEFAULTS for the auto-accounts this request creates — an
   *   action-level `fee_bps` still wins outright.
   *
   * The vocabulary the actuation is judged against comes from the policy
   * registered with `client.agenticPolicy.set()` — the same one the drafting
   * turn used, which is the point of registering it rather than sending it.
   *
   * @param data - The payment agent id and the proposals to accept
   * @returns instruction_ids + the mandates the batch drafted (in full
   * wire shape; sign the §8 approval immediately)
   */
  async create(
    data: CreateInstructionsRequest,
    options?: RequestOptions
  ): Promise<AgenticInstructionsResult> {
    return this.transport.request<AgenticInstructionsResult>({
      method: 'POST',
      path: '/instructions',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Get an accepted instruction — its action series and the per-action
   * downstream artifacts actuation produced.
   *
   * @param instructionId - Instruction ID
   */
  async get(instructionId: string): Promise<AgenticInstruction> {
    return this.transport.request<AgenticInstruction>({
      method: 'GET',
      path: `/instructions/${instructionId}`,
    });
  }
}
