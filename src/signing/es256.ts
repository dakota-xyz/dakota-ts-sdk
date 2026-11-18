/**
 * ES256 (ECDSA P-256 over SHA-256) key handling for the platform's signed
 * requests: signer-group governance intents and agentic mandates verify
 * exactly this form.
 */

import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  KeyObject,
} from 'node:crypto';

/**
 * An ES256 signer holding a P-256 private key in memory: base64 ASN.1 DER
 * ECDSA over SHA-256 of the payload, with the public key as base64 PKIX
 * (SPKI). It satisfies both `GovernanceSigner` (signer-group governance) and
 * `MandateSigner` (agentic mandates, where it is also exported as
 * `P256MandateSigner`).
 *
 * Convenient for servers, sandbox and tests. For production keys, implement
 * the signer interface over your own key custody (HSM/KMS) so the private key
 * never lives in the process. Node only (uses `node:crypto`); in a browser use
 * `webCryptoES256Signer`.
 */
export class ES256Signer {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  private constructor(privateKey: KeyObject, publicKey: KeyObject) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  /**
   * Generate a fresh P-256 keypair.
   */
  static generate(): ES256Signer {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    return new ES256Signer(privateKey, publicKey);
  }

  /**
   * Adopt an existing P-256 private key. Accepts a PKCS#8 PEM string, a
   * DER-encoded PKCS#8 buffer, or a Node {@link KeyObject}.
   */
  static fromPrivateKey(key: KeyObject | string | Uint8Array): ES256Signer {
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
    return new ES256Signer(privateKey, publicKey);
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
export function verifyES256Signature(
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
