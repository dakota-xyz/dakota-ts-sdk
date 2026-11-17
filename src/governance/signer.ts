/**
 * Pluggable signers for governance intents.
 *
 * A signer turns the intent's canonical bytes into one `signatures[]` entry.
 * The SDK ships three:
 * - ES256 on a server: `ES256Signer` (also exported as `P256MandateSigner`) in the
 *   main entry, or your own HSM/KMS behind this interface.
 * - ES256 in a browser: {@link webCryptoES256Signer} over a WebCrypto key.
 * - Passkey: `webauthnSigner` from this entry point.
 */

import { bytesToBase64, toBytes } from './encoding.js';
import type { CanonicalIntent } from './intents.js';

/**
 * Produces one `signatures[]` entry over a governance intent's canonical
 * bytes. For ES256 that is base64 of the ASN.1 DER ECDSA signature over
 * SHA-256(payload); for a passkey it is the packed assertion.
 */
export interface GovernanceSigner {
  sign(payload: Uint8Array): Promise<string> | string;
}

/** A {@link GovernanceSigner} or a bare signing function. */
export type GovernanceSignerLike =
  | GovernanceSigner
  | ((payload: Uint8Array) => Promise<string> | string);

/**
 * Sign an intent with each signer, one after another (passkey prompts must
 * not overlap), and return the signatures in signer order.
 *
 * @throws when `signers` is empty or a signer returns an empty signature
 */
export async function signGovernanceIntent(
  intent: CanonicalIntent | Uint8Array,
  signers: readonly GovernanceSignerLike[]
): Promise<string[]> {
  if (!Array.isArray(signers) || signers.length === 0) {
    throw new TypeError('a governance change needs at least one signer');
  }
  const bytes = ArrayBuffer.isView(intent) ? toBytes(intent) : intent.bytes;
  const out: string[] = [];
  for (const s of signers) {
    // Each signer gets its own copy, so one cannot alter what the next signs.
    const sig = typeof s === 'function' ? await s(bytes.slice()) : await s.sign(bytes.slice());
    if (typeof sig !== 'string' || sig === '') {
      throw new Error('a governance signer returned an empty signature');
    }
    out.push(sig);
  }
  return out;
}

/**
 * The part of WebCrypto's `SubtleCrypto` the ES256 signer uses. Declared
 * structurally so the SDK does not need the DOM type library; a real
 * `crypto.subtle` (browser, Deno, Node's `webcrypto.subtle`) satisfies it.
 */
export interface SubtleCryptoLike {
  sign(
    algorithm: { name: 'ECDSA'; hash: 'SHA-256' },
    key: never,
    data: ArrayBuffer
  ): Promise<ArrayBuffer>;
}

/**
 * An ES256 {@link GovernanceSigner} over a WebCrypto P-256 private key, for
 * browsers and other runtimes without `node:crypto`. The key can be
 * non-extractable. WebCrypto returns raw `r || s`; this converts it to the
 * ASN.1 DER form the platform verifies.
 *
 * @param privateKey - an ECDSA P-256 `CryptoKey` with the `sign` usage
 *   (typed loosely so the SDK does not require the DOM type library)
 * @param subtle - the SubtleCrypto to use (defaults to `globalThis.crypto.subtle`)
 */
export function webCryptoES256Signer(
  privateKey: object,
  subtle?: SubtleCryptoLike
): GovernanceSigner {
  return {
    async sign(payload: Uint8Array): Promise<string> {
      const s = subtle ?? (globalThis as { crypto?: { subtle?: SubtleCryptoLike } }).crypto?.subtle;
      if (!s) {
        throw new Error(
          'WebCrypto is not available: pass a SubtleCrypto or use ES256Signer on Node'
        );
      }
      const raw = new Uint8Array(
        await s.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          privateKey as never,
          toArrayBuffer(payload)
        )
      );
      return bytesToBase64(p1363ToDer(raw));
    },
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.length);
  new Uint8Array(out).set(bytes);
  return out;
}

/** IEEE P1363 `r || s` (64 bytes for P-256) to an ASN.1 DER ECDSA signature. */
function p1363ToDer(sig: Uint8Array): Uint8Array {
  if (sig.length !== 64) {
    throw new Error(`expected a 64-byte P-256 signature, got ${sig.length} bytes`);
  }
  const int = (bytes: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    const trimmed = bytes.slice(i);
    // A leading 1 bit would make the INTEGER negative: prefix a zero byte.
    const body = trimmed[0]! & 0x80 ? Uint8Array.of(0, ...trimmed) : trimmed;
    return Uint8Array.of(0x02, body.length, ...body);
  };
  const r = int(sig.slice(0, 32));
  const s = int(sig.slice(32));
  return Uint8Array.of(0x30, r.length + s.length, ...r, ...s);
}
