/**
 * Mandates resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  ApproveMandateRequest,
  CancelMandateRequest,
  CreateMandateRequest,
  Mandate,
  MandateListParams,
  MandateResponse,
  RequestOptions,
} from '../types.js';

/**
 * Mandates API resource (ALPHA).
 */
export class MandatesResource extends BaseResource {
  /**
   * List mandates (newest first), with the EFFECTIVE status — a pending or
   * active mandate past its valid_until reads "expired". Filter with
   * customer_id / signer_id / status; omit them all for the full collection.
   *
   * @param params - Optional pagination + filter parameters
   * @returns Async iterator of mandates
   */
  list(params?: MandateListParams): PaginatedIterator<Mandate> {
    return this.paginate<Mandate>('/mandates', params);
  }

  /**
   * Get a mandate — the signer it binds, its rule exactly as the customer
   * approves it, validity, and status.
   *
   * @param mandateId - Mandate ID
   */
  async get(mandateId: string): Promise<Mandate> {
    return this.transport.request<Mandate>({
      method: 'GET',
      path: `/mandates/${mandateId}`,
    });
  }

  /**
   * Create a mandate directly.
   *
   * Drafts a PENDING mandate from a direct user interaction — no instruction
   * back-link. Exactly one binding form names the signer the mandate binds:
   * `payment_agent_id` (hosted convenience — binds that agent's signer and
   * anchors to the agent's customer), or `signer_id` together with
   * `customer_id` (any of the client's signers, BYO keys included). The rule
   * is the one the customer will approve (via `approve`, a recognized signer
   * other than the bound one, §8).
   *
   * @param data - One binding form + rule + optional validity window
   * @returns The drafted (pending) mandate
   */
  async create(data: CreateMandateRequest, options?: RequestOptions): Promise<Mandate> {
    return this.transport.request<Mandate>({
      method: 'POST',
      path: '/mandates',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Approve a mandate.
   *
   * A recognized signer OTHER than the bound one signs the mandate payload
   * (see `mandateSignPayload` + `MandateSigner`) to activate it; arms its
   * scheduled payments.
   *
   * @param mandateId - Mandate ID
   * @param data - Approver public key (base64 PKIX) + base64 ASN.1 signature
   */
  async approve(
    mandateId: string,
    data: ApproveMandateRequest,
    options?: RequestOptions
  ): Promise<MandateResponse> {
    return this.transport.request<MandateResponse>({
      method: 'POST',
      path: `/mandates/${mandateId}/approve`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Cancel a mandate.
   *
   * Revokes a pending or active mandate. The canceller must be a recognized
   * signer OTHER than the bound one, with a valid signature over the mandate
   * payload — the bound signer can never mutate its own mandate.
   *
   * @param mandateId - Mandate ID
   * @param data - Signer public key (base64 PKIX) + base64 ASN.1 signature
   */
  async cancel(
    mandateId: string,
    data: CancelMandateRequest,
    options?: RequestOptions
  ): Promise<MandateResponse> {
    return this.transport.request<MandateResponse>({
      method: 'POST',
      path: `/mandates/${mandateId}/cancel`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
