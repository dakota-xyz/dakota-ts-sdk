/**
 * Instructions resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
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
