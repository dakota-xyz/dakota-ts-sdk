/**
 * Passkey (WebAuthn) packaging and the ES256 signers.
 *
 * The passkey here is synthetic: a P-256 key in this process plays the
 * authenticator, building `authenticatorData` and `clientDataJSON` the way a
 * browser would (the same recipe that passed policy-engine in the
 * 2026-11-17 sandbox run). That checks what the SDK owns — the challenge it
 * hands the authenticator and the envelope it packs — and the signature
 * check below mirrors the policy engine's: ECDSA over
 * authenticatorData || SHA-256(clientDataJSON).
 */

import { createHash, createSign, createVerify, generateKeyPairSync, webcrypto } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import {
  addSignersToGroupIntent,
  assertionChallengeMatches,
  buildChallenge,
  packAssertion,
  signGovernanceIntent,
  webauthnSigner,
  webCryptoES256Signer,
  type AssertionCredential,
  type SubtleCryptoLike,
} from '../../src/governance/index.js';
import { P256MandateSigner, verifyMandateSignature } from '../../src/agentic/sign.js';

const intent = addSignersToGroupIntent({
  signerGroupId: '3MF5pRlAIRFYkOAd3TstqUKMOpp',
  newMemberKeys: ['MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMbuCXgirK7R0SD7rp7e/YLTY'],
  signerGroupVersion: 0,
  idempotencyKey: '047caa77-8cec-4e96-994c-a12b655231de',
});

const b64url = (b: Uint8Array | Buffer) => Buffer.from(b).toString('base64url');
const sha256 = (b: Uint8Array | Buffer) => createHash('sha256').update(b).digest();

/** A software authenticator: answers `navigator.credentials.get()` for one key. */
function syntheticPasskey() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const rawId = Buffer.from('synthetic-credential-id-0001');
  const get = (challenge: ArrayBuffer | Uint8Array): AssertionCredential => {
    const authenticatorData = Buffer.concat([
      sha256(Buffer.from('passkey-test.dakota.xyz')),
      Buffer.from([0x05]), // UP + UV
      Buffer.from([0, 0, 0, 1]),
    ]);
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: b64url(new Uint8Array(challenge)),
        origin: 'https://passkey-test.dakota.xyz',
        crossOrigin: false,
      })
    );
    const s = createSign('SHA256');
    s.update(Buffer.concat([authenticatorData, sha256(clientDataJSON)]));
    const signature = s.sign({ key: privateKey, dsaEncoding: 'der' });
    const ab = (b: Buffer) =>
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    return {
      id: b64url(rawId),
      rawId: ab(rawId),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: ab(clientDataJSON),
        authenticatorData: ab(authenticatorData),
        signature: ab(signature),
        userHandle: null,
      },
    };
  };
  return { publicKey, get };
}

function decodePacked(packed: string) {
  return JSON.parse(Buffer.from(packed, 'base64url').toString('utf8')) as {
    id: string;
    rawId: string;
    type: string;
    authenticatorAttachment?: string;
    clientExtensionResults: Record<string, unknown>;
    response: Record<string, string>;
  };
}

describe('buildChallenge', () => {
  it('is the raw canonical bytes, not a hash', () => {
    const c = buildChallenge(intent);
    expect(Buffer.from(c).toString('utf8')).toBe(intent.canonical);
    expect(c).not.toBe(intent.bytes); // a copy the caller may hand to the browser
  });

  it('accepts the canonical string or bytes too', () => {
    expect(Buffer.from(buildChallenge(intent.canonical)).equals(Buffer.from(intent.bytes))).toBe(
      true
    );
    expect(Buffer.from(buildChallenge(intent.bytes)).equals(Buffer.from(intent.bytes))).toBe(true);
  });
});

describe('packAssertion', () => {
  it('packs base64url of the CredentialAssertionResponse JSON, which verifies over the intent', () => {
    const pk = syntheticPasskey();
    const packed = packAssertion(pk.get(buildChallenge(intent)));

    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/);
    const env = decodePacked(packed);
    expect(env.type).toBe('public-key');
    expect(env.id).toBe(env.rawId);
    expect(env.authenticatorAttachment).toBe('platform');
    expect(env.clientExtensionResults).toEqual({});
    for (const f of ['clientDataJSON', 'authenticatorData', 'signature']) {
      expect(env.response[f]).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    expect(env.response).not.toHaveProperty('userHandle');

    const clientData = Buffer.from(env.response.clientDataJSON!, 'base64url');
    expect(JSON.parse(clientData.toString('utf8')).challenge).toBe(b64url(intent.bytes));

    const v = createVerify('SHA256');
    v.update(
      Buffer.concat([Buffer.from(env.response.authenticatorData!, 'base64url'), sha256(clientData)])
    );
    expect(
      v.verify(
        { key: pk.publicKey, dsaEncoding: 'der' },
        Buffer.from(env.response.signature!, 'base64url')
      )
    ).toBe(true);
    expect(assertionChallengeMatches(packed, intent)).toBe(true);
  });

  it('normalizes string fields from mobile passkey libraries to base64url', () => {
    const pk = syntheticPasskey();
    const cred = pk.get(buildChallenge(intent));
    const std = (b: unknown) => Buffer.from(b as ArrayBuffer).toString('base64');
    const fromNative = {
      ...cred,
      rawId: cred.id,
      response: {
        clientDataJSON: std(cred.response.clientDataJSON),
        authenticatorData: std(cred.response.authenticatorData),
        signature: std(cred.response.signature),
        userHandle: 'dXNlcg',
      },
    };
    const a = decodePacked(packAssertion(cred));
    const b = decodePacked(packAssertion(fromNative));
    expect(b.response.clientDataJSON).toBe(a.response.clientDataJSON);
    expect(b.response.signature).toBe(a.response.signature);
    expect(b.response.userHandle).toBe('dXNlcg');
    expect(b.rawId).toBe(a.rawId);
  });

  it('refuses something that is not a passkey assertion', () => {
    const cred = syntheticPasskey().get(buildChallenge(intent));
    expect(() => packAssertion({ ...cred, type: 'password' })).toThrow(/public-key/);
    expect(() => packAssertion({ ...cred, id: '' })).toThrow(/id/);
    expect(() =>
      packAssertion({ ...cred, response: { ...cred.response, signature: undefined as never } })
    ).toThrow(/signature/);
  });

  it('assertionChallengeMatches is false for another intent', () => {
    const packed = packAssertion(syntheticPasskey().get(buildChallenge(intent)));
    const other = addSignersToGroupIntent({
      signerGroupId: '3MF5pRlAIRFYkOAd3TstqUKMOpp',
      newMemberKeys: ['other'],
      signerGroupVersion: 1,
      idempotencyKey: '047caa77-8cec-4e96-994c-a12b655231de',
    });
    expect(assertionChallengeMatches(packed, other)).toBe(false);
    expect(assertionChallengeMatches('not base64 json', intent)).toBe(false);
  });
});

describe('packAssertion id handling', () => {
  it('normalizes a standard-base64 id (the verifier requires base64url)', () => {
    const cred = syntheticPasskey().get(buildChallenge(intent));
    const raw = Buffer.from([0xfb, 0xff, 0xbf]);
    const env = decodePacked(
      packAssertion({ ...cred, id: raw.toString('base64'), rawId: raw.toString('base64') })
    );
    expect(env.id).toBe(raw.toString('base64url'));
    expect(env.rawId).toBe(raw.toString('base64url'));
  });
});

describe('webauthnSigner', () => {
  it('hands the raw intent bytes to the authenticator and packs its answer', async () => {
    const pk = syntheticPasskey();
    const seen: ArrayBuffer[] = [];
    const signer = webauthnSigner(async (challenge) => {
      seen.push(challenge);
      return pk.get(challenge);
    });
    const [packed] = await signGovernanceIntent(intent, [signer]);
    expect(Buffer.from(seen[0]!).toString('utf8')).toBe(intent.canonical);
    expect(assertionChallengeMatches(packed!, intent)).toBe(true);
  });
});

describe('ES256 signers', () => {
  it('webCryptoES256Signer produces DER signatures the platform check accepts', async () => {
    const { privateKey, publicKey } = await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const spki = Buffer.from(await webcrypto.subtle.exportKey('spki', publicKey)).toString(
      'base64'
    );
    const signer = webCryptoES256Signer(
      privateKey,
      webcrypto.subtle as unknown as SubtleCryptoLike
    );
    // Many signatures, so r and s with a high bit or a leading zero byte are
    // exercised by the P1363 -> DER conversion.
    for (let i = 0; i < 64; i++) {
      const sig = await signer.sign(intent.bytes);
      expect(() => verifyMandateSignature(spki, intent.bytes, sig)).not.toThrow();
    }
  });

  it('webCryptoES256Signer DER-encodes edge values exactly', async () => {
    // r has a leading zero byte (trimmed); s has its high bit set (0x00 pad).
    const r = Buffer.concat([Buffer.from([0x00, 0x00, 0x7f]), Buffer.alloc(29, 0x11)]);
    const s = Buffer.concat([Buffer.from([0x80]), Buffer.alloc(31, 0x22)]);
    const fake: SubtleCryptoLike = {
      async sign() {
        const raw = Buffer.concat([r, s]);
        return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
      },
    };
    const der = Buffer.from(await webCryptoES256Signer({}, fake).sign(intent.bytes), 'base64');
    const rBody = r.subarray(2); // 30 bytes, high bit clear
    const sBody = Buffer.concat([Buffer.from([0x00]), s]); // 33 bytes
    expect(
      der.equals(
        Buffer.concat([
          Buffer.from([0x30, 2 + rBody.length + 2 + sBody.length]),
          Buffer.from([0x02, rBody.length]),
          rBody,
          Buffer.from([0x02, sBody.length]),
          sBody,
        ])
      )
    ).toBe(true);
  });

  it('signGovernanceIntent accepts signer objects and plain functions, in order', async () => {
    const a = P256MandateSigner.generate();
    const b = P256MandateSigner.generate();
    const sigs = await signGovernanceIntent(intent, [a, (bytes) => b.sign(bytes)]);
    expect(sigs).toHaveLength(2);
    expect(() => verifyMandateSignature(a.publicKeyBase64(), intent.bytes, sigs[0]!)).not.toThrow();
    expect(() => verifyMandateSignature(b.publicKeyBase64(), intent.bytes, sigs[1]!)).not.toThrow();
  });

  it('signGovernanceIntent refuses an empty signer list and an empty signature', async () => {
    await expect(signGovernanceIntent(intent, [])).rejects.toThrow(/at least one signer/);
    await expect(signGovernanceIntent(intent, [() => ''])).rejects.toThrow(/empty signature/);
  });
});
