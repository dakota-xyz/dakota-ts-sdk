/**
 * §8 mandate signing. Approving (or cancelling) a mandate is not a bare API
 * call: it requires a cryptographic signature over the mandate's canonical
 * bytes, proving the action came from a holder of the registered key. This
 * file reproduces the platform's exact signed payload (RFC 8785 / JCS
 * canonical JSON) and a P-256 signing/verification path, so partners never
 * hand-roll JCS + ECDSA.
 *
 * The canonical bytes a signature covers — matched byte-for-byte with the
 * platform's MandatePayload — are JCS JSON of:
 *
 *     {action, id, bound_signer, rule, valid_from, valid_until}
 *
 * signed as base64( ASN.1( ECDSA-P256( SHA-256(payload) ))), with the public
 * key as base64 PKIX (SPKI).
 *
 * Agentic payments is a beta surface (x-beta, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import type { Mandate, MandateRule } from '../client/types.js';
import { canonicalJSON } from './canonicalize.js';

/**
 * The §8 verb a signature authorizes. It is part of the signed payload so
 * an approval and a cancellation can never be each other's replay: a signed
 * cancel must not be byte-identical to a signed approve.
 */
export type MandateAction = 'approve' | 'cancel';

/**
 * Produces the §8 signature the platform verifies for a mandate
 * approve/cancel. The caller holds the private key; the SDK never sees it.
 *
 * Implement this over your own key custody (HSM/KMS) for production. For
 * sandbox and tests, `P256MandateSigner` is a ready in-memory implementation.
 */
export interface MandateSigner {
  /**
   * The base64 PKIX (SPKI) P-256 public key — the exact form the platform
   * registered for this signer and verifies signatures against.
   */
  publicKeyBase64(): string;

  /**
   * Returns a base64 ASN.1 ECDSA signature over SHA-256(payload).
   */
  sign(payload: Uint8Array): Promise<string> | string;
}

/**
 * Reproduces, byte-for-byte, the canonical bytes the platform signs for one
 * §8 action on a mandate. Build it straight from the mandate as returned by
 * `mandates.get` / `mandates.list` — no server state is needed, and field
 * order is irrelevant (JCS sorts).
 *
 * `valid_from` / `valid_until` are always present in the signed payload
 * (even when zero); the wire omits a zero value, so a missing field
 * canonicalizes to 0 — matching the platform, which signs the int64
 * directly.
 */
export function mandateSignPayload(mandate: Mandate, action: MandateAction): Uint8Array {
  if (!mandate.id) {
    throw new Error('mandate has no id');
  }
  if (!mandate.bound_signer_id) {
    throw new Error('mandate has no bound_signer_id');
  }
  if (!mandate.rule) {
    throw new Error('mandate has no rule');
  }
  const encoded = canonicalJSON({
    action,
    id: mandate.id,
    bound_signer: mandate.bound_signer_id,
    rule: mandate.rule,
    valid_from: mandate.valid_from ?? 0,
    valid_until: mandate.valid_until ?? 0,
  });
  return new TextEncoder().encode(encoded);
}

/**
 * Reproduces, byte-for-byte, the canonical bytes the platform verifies for an
 * AMEND — appending version `version`, carrying `rule`, to `mandate`.
 *
 * The approve/cancel bytes are frozen, so amend gets its own payload rather
 * than an extra key on `mandateSignPayload`. It is the same JCS JSON plus one
 * key, `version`:
 *
 *     {action: 'amend', id, bound_signer, rule, valid_from, valid_until, version}
 *
 * **`version` is what stops cross-version replay.** Without it, a signature
 * over `{amend, rule R}` would authorize "make the current rule R" forever: a
 * customer who signs v2 raising a limit to 20,000 and then v3 lowering it to
 * 5,000 could have the v2 signature replayed as a v4 — a rollback of their own
 * reduction, using their own signature. Binding the exact version number makes
 * each amend signature usable once, at one point in the mandate's history.
 *
 * `rule` is the NEW rule (what the signer is agreeing to), not the outgoing
 * one, and is taken verbatim — the amend endpoint never normalizes it, so the
 * bytes signed here are the bytes the server verifies. Pass the SAME rule
 * object to `mandates.amend`.
 *
 * @param mandate - The mandate as it is NOW (the amend is a compare-and-set on
 *   its current version)
 * @param version - The version this amend creates — the mandate's current
 *   `version` + 1
 * @param rule - The complete new rule, in canonical form
 */
export function mandateAmendSignPayload(
  mandate: Mandate,
  version: number,
  rule: MandateRule
): Uint8Array {
  if (!mandate.id) {
    throw new Error('mandate has no id');
  }
  if (!mandate.bound_signer_id) {
    throw new Error('mandate has no bound_signer_id');
  }
  if (!Number.isInteger(version) || version < 2) {
    throw new Error('amend version must be an integer >= 2 (the version being created)');
  }
  const encoded = canonicalJSON({
    action: 'amend',
    id: mandate.id,
    bound_signer: mandate.bound_signer_id,
    rule,
    valid_from: mandate.valid_from ?? 0,
    valid_until: mandate.valid_until ?? 0,
    version,
  });
  return new TextEncoder().encode(encoded);
}

// ---------------------------------------------------------------------------
// Endorsed-intent payload helpers.
// ---------------------------------------------------------------------------
//
// Each reproduces, byte-for-byte, the canonical map the platform's policy
// engine rebuilds to verify the endorsement (its intent reconstruction).
// The idempotency_key is part of the signed bytes — reuse the SAME key on
// the corresponding request.

/**
 * Canonical bytes a recognized wallet signer endorses to attach a signer
 * group to a wallet.
 */
export function attachGroupPayload(
  walletId: string,
  groupId: string,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'attach_group_to_wallet',
      wallet_id: walletId,
      group_id: groupId,
      idempotency_key: idempotencyKey,
    })
  );
}

/** Optional fields of {@link attachPolicyPayload} and {@link detachPolicyPayload}. */
export interface PolicyPayloadOptions {
  /**
   * The policy's current `version` (read it with `client.policies.get`), so
   * the signatures approve the rules the signers saw. It is part of the
   * signed bytes: send the same value as the intent's `policy_version`.
   *
   * If the policy changes after the signatures are made (a rule added,
   * changed or removed, or its signer group, endorser scope or client
   * changed), the request is refused with 409 `stale_policy_version`
   * ({@link StalePolicyVersionError}) and nothing changes: read the policy
   * again, and sign again under a new idempotency key. Without it, the
   * payload is the one signed before policy versions existed, and the
   * attach or detach does not check the version.
   *
   * A whole number of 1 or more (versions start at 1); anything else throws.
   */
  policyVersion?: number;
}

const MAX_INT32 = 2 ** 31 - 1;

/**
 * Attach/detach canonical bytes. `policy_version` is added only when given,
 * matching the policy engine's reconstruction: an intent without it signs
 * exactly the bytes it always has.
 */
function policyPayload(
  type: 'attach_policy_to_wallet' | 'detach_policy_from_wallet',
  walletId: string,
  policyId: string,
  idempotencyKey: string,
  options?: PolicyPayloadOptions
): Uint8Array {
  const intent: Record<string, unknown> = {
    type,
    wallet_id: walletId,
    policy_id: policyId,
    idempotency_key: idempotencyKey,
  };
  const version = options?.policyVersion;
  if (version !== undefined) {
    if (!Number.isInteger(version) || version < 1 || version > MAX_INT32) {
      throw new RangeError(
        `policy version must be a whole number from 1 to ${MAX_INT32}, got ${version}`
      );
    }
    intent.policy_version = version;
  }
  return textBytes(canonicalJSON(intent));
}

/**
 * Canonical bytes a recognized wallet signer endorses to attach a policy to
 * a wallet: JCS JSON of `{type, wallet_id, policy_id, idempotency_key}`, plus
 * `policy_version` when `options.policyVersion` is given.
 */
export function attachPolicyPayload(
  walletId: string,
  policyId: string,
  idempotencyKey: string,
  options?: PolicyPayloadOptions
): Uint8Array {
  return policyPayload('attach_policy_to_wallet', walletId, policyId, idempotencyKey, options);
}

/**
 * Canonical bytes a recognized wallet signer endorses to remove a signer
 * group from a wallet — the inverse of {@link attachGroupPayload}.
 */
export function detachGroupPayload(
  walletId: string,
  groupId: string,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'detach_group_from_wallet',
      wallet_id: walletId,
      group_id: groupId,
      idempotency_key: idempotencyKey,
    })
  );
}

/**
 * Canonical bytes a recognized wallet signer endorses to remove a policy
 * from a wallet — the inverse of {@link attachPolicyPayload}. Takes the same
 * optional `policyVersion`.
 */
export function detachPolicyPayload(
  walletId: string,
  policyId: string,
  idempotencyKey: string,
  options?: PolicyPayloadOptions
): Uint8Array {
  return policyPayload('detach_policy_from_wallet', walletId, policyId, idempotencyKey, options);
}

/**
 * Canonical bytes a member of the policy's governing signer group endorses
 * to delete a policy.
 */
export function deletePolicyPayload(policyId: string, idempotencyKey: string): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'delete_policy',
      policy_id: policyId,
      idempotency_key: idempotencyKey,
    })
  );
}

/**
 * Canonical bytes a member of the policy's governing signer group endorses
 * to remove a rule from a policy.
 */
export function removePolicyRulePayload(
  policyId: string,
  ruleId: string,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'remove_policy_rule',
      policy_id: policyId,
      rule_id: ruleId,
      idempotency_key: idempotencyKey,
    })
  );
}

/**
 * Canonical bytes a member of the policy's governing signer group endorses
 * to update a rule's definition. `updatedDefinition` is the rule definition
 * as a JSON STRING; it is signed opaquely, exactly as sent on the update
 * request.
 */
export function updatePolicyRulePayload(
  policyId: string,
  ruleId: string,
  updatedDefinition: string,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'update_policy_rule',
      policy_id: policyId,
      rule_id: ruleId,
      updated_definition: updatedDefinition,
      idempotency_key: idempotencyKey,
    })
  );
}

/**
 * Canonical bytes a member of the policy's governing signer group endorses
 * to add a rule to a policy. `action` (e.g. `"allow"`), `ruleType` (e.g.
 * `"amount_threshold"`), and `definition` (the rule-type-specific config,
 * in API format) must match the values sent on the add request, or the
 * endorsement won't verify against it.
 */
export function addPolicyRulePayload(
  policyId: string,
  action: string,
  ruleType: string,
  definition: Record<string, unknown>,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'add_policy_rule',
      action,
      rule_type: ruleType,
      policy_id: policyId,
      definition,
      idempotency_key: idempotencyKey,
    })
  );
}

function textBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ---------------------------------------------------------------------------
// ES256 key handling lives in ../signing/es256.ts (shared with signer-group
// governance, which is not a beta surface). Re-exported here under the
// names this module has always used.
// ---------------------------------------------------------------------------

export {
  ES256Signer as P256MandateSigner,
  verifyES256Signature as verifyMandateSignature,
} from '../signing/es256.js';
