/**
 * §8 mandate-signing tests — port of go-sdk/client/agentic_sign_test.go.
 *
 * The golden mandate approval payload is captured verbatim from the
 * platform's `enc.C14nJSON`. The SDK MUST reproduce it byte-for-byte, or
 * signatures it produces will not verify server-side.
 */

import { describe, it, expect } from 'vitest';

import type { Mandate } from '../../src/client/types.js';
import {
  addPolicyRulePayload,
  attachGroupPayload,
  attachPolicyPayload,
  deletePolicyPayload,
  detachGroupPayload,
  detachPolicyPayload,
  mandateAmendSignPayload,
  mandateSignPayload,
  P256MandateSigner,
  removePolicyRulePayload,
  updatePolicyRulePayload,
  verifyMandateSignature,
} from '../../src/agentic/sign.js';

// Golden mandate approval payload: platform's authoritative JCS-canonical
// approval bytes for goldenMandate(). Must match byte-for-byte.
const GOLDEN_MANDATE_APPROVE_PAYLOAD =
  '{"action":"approve","bound_signer":"signer_2eFgHiJkLmNoPqRsTuVwXyZabcd","id":"mandate_2cDeFgHiJkLmNoPqRsTuVwXyZab","rule":{"asset":"USDC","max_count_per_target_in_window":1,"max_per_tx":"10","network_id":"base-sepolia","target_type":"recipient","targets":["recipient_2aBcDeFgHiJkLmNoPqRsTuVwXyZ"],"window":"MONTHLY"},"valid_from":0,"valid_until":1798675200}';

// Golden mandate AMEND payload (ENG-2977): the approve bytes with the verb
// swapped and ONE extra key, `version` — the version the amend creates, which
// is what stops a v2 signature from being replayed as v3. Captured verbatim
// from the platform's `MandateAmendPayload` for goldenMandate() at version 2.
const GOLDEN_MANDATE_AMEND_PAYLOAD =
  '{"action":"amend","bound_signer":"signer_2eFgHiJkLmNoPqRsTuVwXyZabcd","id":"mandate_2cDeFgHiJkLmNoPqRsTuVwXyZab","rule":{"asset":"USDC","max_count_per_target_in_window":1,"max_per_tx":"10","network_id":"base-sepolia","target_type":"recipient","targets":["recipient_2aBcDeFgHiJkLmNoPqRsTuVwXyZ"],"window":"MONTHLY"},"valid_from":0,"valid_until":1798675200,"version":2}';

function goldenMandate(): Mandate {
  return {
    id: 'mandate_2cDeFgHiJkLmNoPqRsTuVwXyZab',
    bound_signer_id: 'signer_2eFgHiJkLmNoPqRsTuVwXyZabcd',
    valid_from: 0,
    valid_until: 1798675200,
    rule: {
      target_type: 'recipient',
      targets: ['recipient_2aBcDeFgHiJkLmNoPqRsTuVwXyZ'],
      network_id: 'base-sepolia',
      asset: 'USDC',
      max_per_tx: '10',
      window: 'MONTHLY',
      max_count_per_target_in_window: 1,
    },
  };
}

const decoder = new TextDecoder();

describe('mandateSignPayload', () => {
  it('reproduces the platform golden approve payload byte-for-byte', () => {
    const bytes = mandateSignPayload(goldenMandate(), 'approve');
    expect(decoder.decode(bytes)).toBe(GOLDEN_MANDATE_APPROVE_PAYLOAD);
  });

  it('canonicalizes a missing valid_from to 0 (the wire omits zero)', () => {
    const { valid_from: _valid_from, ...rest } = goldenMandate();
    void _valid_from;
    const bytes = mandateSignPayload(rest as Mandate, 'approve');
    expect(decoder.decode(bytes)).toBe(GOLDEN_MANDATE_APPROVE_PAYLOAD);
  });

  it('rejects a mandate with no id / bound_signer / rule', () => {
    expect(() => mandateSignPayload({} as Mandate, 'approve')).toThrow();
  });
});

describe('mandateAmendSignPayload', () => {
  it('reproduces the platform golden amend payload byte-for-byte', () => {
    const m = goldenMandate();
    const bytes = mandateAmendSignPayload(m, 2, m.rule!);
    expect(decoder.decode(bytes)).toBe(GOLDEN_MANDATE_AMEND_PAYLOAD);
  });

  it('signs the NEW rule, not the mandate’s current one', () => {
    const m = goldenMandate();
    const next = { ...m.rule!, max_per_tx: '25' };
    const bytes = decoder.decode(mandateAmendSignPayload(m, 2, next));
    expect(bytes).toContain('"max_per_tx":"25"');
    expect(bytes).not.toContain('"max_per_tx":"10"');
  });

  it('commits to the version, so a v2 signature cannot be replayed as v3', () => {
    const m = goldenMandate();
    const v2 = decoder.decode(mandateAmendSignPayload(m, 2, m.rule!));
    const v3 = decoder.decode(mandateAmendSignPayload(m, 3, m.rule!));
    expect(v2).not.toBe(v3);
  });

  it('is never byte-identical to an approve or cancel over the same rule', () => {
    const m = goldenMandate();
    const amend = decoder.decode(mandateAmendSignPayload(m, 2, m.rule!));
    expect(amend).not.toBe(decoder.decode(mandateSignPayload(m, 'approve')));
    expect(amend).not.toBe(decoder.decode(mandateSignPayload(m, 'cancel')));
  });

  it('rejects a version below 2 — v1 is created, never amended', () => {
    const m = goldenMandate();
    expect(() => mandateAmendSignPayload(m, 1, m.rule!)).toThrow();
    expect(() => mandateAmendSignPayload(m, 0, m.rule!)).toThrow();
  });

  it('rejects a mandate with no id / bound_signer', () => {
    expect(() => mandateAmendSignPayload({} as Mandate, 2, goldenMandate().rule!)).toThrow();
  });
});

describe('P256MandateSigner + verifyMandateSignature', () => {
  it('signs and self-verifies an approve payload', () => {
    const signer = P256MandateSigner.generate();
    const approve = mandateSignPayload(goldenMandate(), 'approve');
    const sig = signer.sign(approve);
    expect(() => verifyMandateSignature(signer.publicKeyBase64(), approve, sig)).not.toThrow();
  });

  it('an approve signature does NOT verify a cancel payload (replay guard)', () => {
    const signer = P256MandateSigner.generate();
    const approve = mandateSignPayload(goldenMandate(), 'approve');
    const cancel = mandateSignPayload(goldenMandate(), 'cancel');
    const sig = signer.sign(approve);
    expect(() => verifyMandateSignature(signer.publicKeyBase64(), cancel, sig)).toThrow();
  });

  it('exports a valid base64 PKIX P-256 public key', () => {
    const signer = P256MandateSigner.generate();
    const b64 = signer.publicKeyBase64();
    // PKIX SPKI for P-256 is 91 bytes → 124 base64 chars.
    expect(Buffer.from(b64, 'base64').length).toBe(91);
  });
});

describe('endorsed-intent payloads (JCS byte-exact)', () => {
  it('attach_group_to_wallet', () => {
    const bytes = attachGroupPayload('wallet_W', 'group_G', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"group_id":"group_G","idempotency_key":"idem_K","type":"attach_group_to_wallet","wallet_id":"wallet_W"}'
    );
  });

  it('attach_policy_to_wallet', () => {
    const bytes = attachPolicyPayload('wallet_W', 'policy_P', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"idempotency_key":"idem_K","policy_id":"policy_P","type":"attach_policy_to_wallet","wallet_id":"wallet_W"}'
    );
  });

  it('detach_group_from_wallet', () => {
    const bytes = detachGroupPayload('wallet_W', 'group_G', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"group_id":"group_G","idempotency_key":"idem_K","type":"detach_group_from_wallet","wallet_id":"wallet_W"}'
    );
  });

  it('detach_policy_from_wallet', () => {
    const bytes = detachPolicyPayload('wallet_W', 'policy_P', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"idempotency_key":"idem_K","policy_id":"policy_P","type":"detach_policy_from_wallet","wallet_id":"wallet_W"}'
    );
  });

  it('delete_policy', () => {
    const bytes = deletePolicyPayload('policy_P', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"idempotency_key":"idem_K","policy_id":"policy_P","type":"delete_policy"}'
    );
  });

  it('remove_policy_rule', () => {
    const bytes = removePolicyRulePayload('policy_P', 'rule_R', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"idempotency_key":"idem_K","policy_id":"policy_P","rule_id":"rule_R","type":"remove_policy_rule"}'
    );
  });

  it('update_policy_rule', () => {
    const bytes = updatePolicyRulePayload('policy_P', 'rule_R', 'def_str', 'idem_K');
    expect(decoder.decode(bytes)).toBe(
      '{"idempotency_key":"idem_K","policy_id":"policy_P","rule_id":"rule_R","type":"update_policy_rule","updated_definition":"def_str"}'
    );
  });

  it('add_policy_rule', () => {
    const bytes = addPolicyRulePayload(
      'policy_P',
      'allow',
      'amount_threshold',
      { threshold: '100' },
      'idem_K'
    );
    expect(decoder.decode(bytes)).toBe(
      '{"action":"allow","definition":{"threshold":"100"},"idempotency_key":"idem_K","policy_id":"policy_P","rule_type":"amount_threshold","type":"add_policy_rule"}'
    );
  });
});
