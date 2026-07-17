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
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  KeyObject,
} from 'node:crypto';

import type { Mandate } from '../client/types.js';
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

/**
 * Canonical bytes a recognized wallet signer endorses to attach a policy to
 * a wallet.
 */
export function attachPolicyPayload(
  walletId: string,
  policyId: string,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'attach_policy_to_wallet',
      wallet_id: walletId,
      policy_id: policyId,
      idempotency_key: idempotencyKey,
    })
  );
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
 * from a wallet — the inverse of {@link attachPolicyPayload}.
 */
export function detachPolicyPayload(
  walletId: string,
  policyId: string,
  idempotencyKey: string
): Uint8Array {
  return textBytes(
    canonicalJSON({
      type: 'detach_policy_from_wallet',
      wallet_id: walletId,
      policy_id: policyId,
      idempotency_key: idempotencyKey,
    })
  );
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
// P256MandateSigner — default in-memory signer (sandbox / tests)
// ---------------------------------------------------------------------------

/**
 * A {@link MandateSigner} holding a P-256 (ES256) private key in memory.
 *
 * Convenient for sandbox and tests; for production, implement
 * {@link MandateSigner} over your own key custody so the private key never
 * lives in the process.
 */
export class P256MandateSigner implements MandateSigner {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  private constructor(privateKey: KeyObject, publicKey: KeyObject) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Generate a fresh P-256 keypair.
   */
  static generate(): P256MandateSigner {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    return new P256MandateSigner(privateKey, publicKey);
  }

  /**
   * Adopt an existing P-256 private key. Accepts a PKCS#8 PEM string, a
   * DER-encoded PKCS#8 buffer, or a Node {@link KeyObject}.
   */
  static fromPrivateKey(key: KeyObject | string | Uint8Array): P256MandateSigner {
    const privateKey =
      typeof key === 'string' || key instanceof Uint8Array
        ? createPrivateKey({
            key: key as string | Buffer,
            format: typeof key === 'string' ? 'pem' : 'der',
            type: 'pkcs8',
          })
        : key;
    if (privateKey.asymmetricKeyType !== 'ec') {
      throw new Error('a P-256 private key is required (ES256)');
    }
    const details = privateKey.asymmetricKeyDetails;
    if (details?.namedCurve !== 'prime256v1') {
      throw new Error('a P-256 private key is required (ES256)');
    }
    const publicKey = createPublicKey(privateKey);
    return new P256MandateSigner(privateKey, publicKey);
  }

  /**
   * base64 PKIX (SPKI) public key — pass this as the signer's registered
   * public key at agent creation / mandate approval.
   */
  publicKeyBase64(): string {
    const der = this.publicKey.export({ format: 'der', type: 'spki' });
    return Buffer.from(der).toString('base64');
  }

  /**
   * Returns base64( ASN.1 ECDSA signature over SHA-256(payload) ).
   */
  sign(payload: Uint8Array): string {
    const signer = createSign('SHA256');
    signer.update(payload);
    const sig = signer.sign({ key: this.privateKey, dsaEncoding: 'der' });
    return Buffer.from(sig).toString('base64');
  }
}

/**
 * Check a base64 ASN.1 signature over SHA-256 of the canonical payload
 * against a base64 PKIX P-256 public key — the platform's exact
 * verification. Exposed so callers (and tests) can self-check a signature
 * before submitting it.
 *
 * @throws if the public key or signature can't be parsed, or the signature
 *   does not verify against the payload.
 */
export function verifyMandateSignature(
  publicKeyBase64: string,
  payload: Uint8Array,
  signatureBase64: string
): void {
  let publicKey: KeyObject;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch (err) {
    throw new Error(`parse public key: ${(err as Error).message}`);
  }
  if (publicKey.asymmetricKeyType !== 'ec') {
    throw new Error('not a P-256 public key (ES256 requires P-256)');
  }
  if (publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('not a P-256 public key (ES256 requires P-256)');
  }
  const verifier = createVerify('SHA256');
  verifier.update(payload);
  const ok = verifier.verify(
    { key: publicKey, dsaEncoding: 'der' },
    Buffer.from(signatureBase64, 'base64')
  );
  if (!ok) {
    throw new Error('signature verification failed');
  }
}
