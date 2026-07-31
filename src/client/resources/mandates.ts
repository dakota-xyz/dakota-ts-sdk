/**
 * Mandates resource (ALPHA).
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  AmendMandateRequest,
  ApproveMandateRequest,
  CancelMandateRequest,
  CreateMandateRequest,
  Mandate,
  MandateBudget,
  MandateListParams,
  MandateResponse,
  MandateVersion,
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
      timeout: options?.timeout,
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
      timeout: options?.timeout,
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
      timeout: options?.timeout,
    });
  }

  /**
   * Amend a mandate — append a new signed version of its rule.
   *
   * Carries a changed rule into force with ONE signature and WITHOUT resetting
   * the spend already made in the current window: usage accrues to the
   * MANDATE, so an agent that has spent 9,000 of a 10,000 monthly limit and is
   * amended to 20,000 has 11,000 left, not 20,000.
   *
   * The `rule` is stored and verified VERBATIM — this endpoint does not
   * normalize it. It must already be canonical: `window` present and non-empty
   * (send `'NONE'` for a lifetime window), `targets` as recipient ids rather
   * than payee names, and `asset` uppercase. `target_type`, `window`, `asset`
   * and `network_id` must also match the current version exactly; only the
   * amount fields and `targets` may differ. Anything else is a 400 naming the
   * offending field.
   *
   * Build `signature` from `mandateAmendSignPayload(mandate, version, rule)` —
   * the amend payload commits to the version being created, so a signature for
   * v2 can never be replayed to append v3.
   *
   * @param mandateId - Mandate ID
   * @param data - Amending signer public key + signature + the complete NEW rule
   * @returns The mandate at its new current version
   *
   * @example
   * ```typescript
   * const mandate = await client.mandates.get(mandateId);
   * const nextVersion = (mandate.version ?? 1) + 1;
   * const rule = { ...mandate.rule, max_amount_in_window: '20000' };
   * const payload = mandateAmendSignPayload(mandate, nextVersion, rule);
   *
   * const amended = await client.mandates.amend(mandateId, {
   *   signer_public_key: signer.publicKeyBase64(),
   *   signature: await signer.sign(payload),
   *   rule,
   * });
   * ```
   */
  async amend(
    mandateId: string,
    data: AmendMandateRequest,
    options?: RequestOptions
  ): Promise<Mandate> {
    return this.transport.request<Mandate>({
      method: 'POST',
      path: `/mandates/${mandateId}/amend`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List a mandate's versions, oldest first.
   *
   * The append-only history of every rule that was ever in force under this
   * mandate, and the §8 signer that put each one there. Versions are
   * immutable, so a rule listed here never changes — this is what makes an
   * executed payment's `mandate_version` audit stamp legible.
   *
   * @param mandateId - Mandate ID
   * @returns Every version, oldest first
   */
  async listVersions(mandateId: string): Promise<MandateVersion[]> {
    return this.transport.request<MandateVersion[]>({
      method: 'GET',
      path: `/mandates/${mandateId}/versions`,
    });
  }

  /**
   * Get a mandate's remaining budget right now.
   *
   * The mandate's `rule` gives the ceilings; this gives the CONSUMPTION — what
   * has already been spent, what is earmarked by scheduled payments that have
   * not fired yet, and therefore what is left. Read it before scheduling:
   * otherwise an over-budget payment is only discovered when the gate denies
   * it at its due date, days later, with the payee unpaid.
   *
   * Advisory — nothing here reserves budget, and the gate remains the
   * authority at fire time. Two things to honour when reading a line:
   * an ABSENT `remaining_amount` / `remaining_count` means "not capped", never
   * "nothing left"; a `remaining_amount` of `'?'` means the figure could not
   * be summed and MUST be treated as no headroom (the gate fails closed on the
   * same data).
   *
   * @param mandateId - Mandate ID
   * @returns Per-target and aggregate budget lines, as of a stated instant
   *
   * @example
   * ```typescript
   * const budget = await client.mandates.getBudget(mandateId);
   * for (const line of budget.aggregate) {
   *   console.log(line.bucket, line.remaining_amount ?? 'uncapped');
   * }
   * ```
   */
  async getBudget(mandateId: string): Promise<MandateBudget> {
    return this.transport.request<MandateBudget>({
      method: 'GET',
      path: `/mandates/${mandateId}/budget`,
    });
  }
}
