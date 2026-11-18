/**
 * Passkey (WebAuthn) signatures for governance intents.
 *
 * The platform verifies a passkey signature like this: the assertion's
 * `clientDataJSON.challenge` must decode to the intent's canonical JSON
 * itself (NOT a hash of it), and the authenticator's signature over
 * `authenticatorData || SHA-256(clientDataJSON)` must verify against the
 * signer's registered COSE key. The `signatures[]` entry is base64url of the
 * `CredentialAssertionResponse` JSON.
 *
 * So the SDK does two small things and never touches the credential:
 * - {@link buildChallenge} gives you the bytes to pass as
 *   `navigator.credentials.get({ publicKey: { challenge } })`.
 * - {@link packAssertion} turns the returned credential into the
 *   `signatures[]` entry.
 */

import { base64ToBytes, bytesToBase64url, toBytes, utf8 } from './encoding.js';
import type { CanonicalIntent } from './intents.js';
import type { GovernanceSigner } from './signer.js';

/**
 * Binary data as WebAuthn APIs hand it out: an ArrayBuffer or typed array
 * (browsers), or a base64 / base64url string (most React Native passkey
 * libraries, and `PublicKeyCredential.toJSON()`).
 */
export type BinaryOrBase64 = ArrayBuffer | ArrayBufferView | string;

/**
 * The parts of a `PublicKeyCredential` (with an `AuthenticatorAssertionResponse`)
 * that the platform reads. A browser's `navigator.credentials.get()` result
 * satisfies it as-is: the DOM types its `response` as the base
 * `AuthenticatorResponse`, so `authenticatorData` and `signature` are
 * optional here and checked at run time by {@link packAssertion}.
 */
export interface AssertionCredential {
  readonly id: string;
  readonly rawId: BinaryOrBase64;
  readonly type: string;
  readonly authenticatorAttachment?: string | null;
  readonly response: {
    readonly clientDataJSON: BinaryOrBase64;
    readonly authenticatorData?: BinaryOrBase64;
    readonly signature?: BinaryOrBase64;
    readonly userHandle?: BinaryOrBase64 | null;
  };
}

/**
 * What a challenge can be built from: a built intent, anything else that
 * carries the `canonical` string (such as a `PreparedSignerGroupChange`),
 * the `canonical` string itself (what a server would send to the browser),
 * or its bytes.
 */
export type ChallengeSource =
  | CanonicalIntent
  | { readonly canonical: string }
  | string
  | Uint8Array
  | ArrayBuffer;

/**
 * The WebAuthn challenge for an intent: its raw canonical JSON bytes, as a
 * fresh `ArrayBuffer`. Pass it as `publicKey.challenge`; the browser
 * base64url-encodes it into `clientDataJSON`, which is exactly what the
 * platform expects. (An `ArrayBuffer` is a `BufferSource` under every
 * TypeScript version, unlike a `Uint8Array` on TypeScript 5.7+.)
 *
 * @throws TypeError when `intent` is none of the {@link ChallengeSource} forms
 */
export function buildChallenge(intent: ChallengeSource): ArrayBuffer {
  const bytes = challengeBytes(intent);
  const out = new ArrayBuffer(bytes.length);
  new Uint8Array(out).set(bytes);
  return out;
}

function challengeBytes(intent: ChallengeSource): Uint8Array {
  if (typeof intent === 'string') {
    return utf8(intent);
  }
  if (isBinary(intent)) {
    return toBytes(intent);
  }
  if (intent && typeof intent === 'object') {
    // `canonical` first: it is the one field every source carries, and a
    // built intent's `bytes` are its UTF-8 encoding anyway.
    const canonical = (intent as { canonical?: unknown }).canonical;
    if (typeof canonical === 'string') {
      return utf8(canonical);
    }
  }
  throw new TypeError(
    'expected a built intent, a prepared change, its canonical string, or its bytes'
  );
}

function isBinary(v: unknown): v is ArrayBuffer | ArrayBufferView {
  return ArrayBuffer.isView(v) || Object.prototype.toString.call(v) === '[object ArrayBuffer]';
}

function b64urlField(name: string, value: BinaryOrBase64 | null | undefined): string {
  if (value === undefined || value === null || value === '') {
    throw new TypeError(`passkey assertion is missing ${name}`);
  }
  if (typeof value === 'string') {
    // Normalize either base64 alphabet to unpadded base64url.
    return bytesToBase64url(base64ToBytes(value));
  }
  return bytesToBase64url(toBytes(value));
}

/**
 * Package a passkey assertion as a `signatures[]` entry: base64url of the
 * `CredentialAssertionResponse` JSON
 * (`{id, rawId, type, authenticatorAttachment?, clientExtensionResults, response: {clientDataJSON, authenticatorData, signature, userHandle?}}`,
 * every binary field base64url).
 *
 * @param credential - what `navigator.credentials.get()` returned (or a
 *   mobile passkey library's equivalent)
 * @throws TypeError when it is not a public-key assertion or a field is
 *   missing
 */
export function packAssertion(credential: AssertionCredential): string {
  if (!credential || credential.type !== 'public-key') {
    throw new TypeError('expected a WebAuthn assertion with type "public-key"');
  }
  if (typeof credential.id !== 'string' || credential.id === '') {
    throw new TypeError('passkey assertion is missing id');
  }
  const r = credential.response;
  if (!r) {
    throw new TypeError('passkey assertion is missing response');
  }
  const response: Record<string, string> = {
    clientDataJSON: b64urlField('clientDataJSON', r.clientDataJSON),
    authenticatorData: b64urlField('authenticatorData', r.authenticatorData),
    signature: b64urlField('signature', r.signature),
  };
  if (r.userHandle !== undefined && r.userHandle !== null && r.userHandle !== '') {
    response.userHandle = b64urlField('userHandle', r.userHandle);
  }
  const envelope: Record<string, unknown> = {
    // The verifier requires `id` to be base64url; some mobile libraries hand
    // out standard base64, so normalize it like the binary fields.
    id: b64urlField('id', credential.id),
    rawId: b64urlField('rawId', credential.rawId),
    type: 'public-key',
    clientExtensionResults: {},
    response,
  };
  if (credential.authenticatorAttachment) {
    envelope.authenticatorAttachment = credential.authenticatorAttachment;
  }
  return bytesToBase64url(utf8(JSON.stringify(envelope)));
}

/** Longest packed assertion {@link assertionChallengeMatches} will decode. */
const MAX_PACKED_ASSERTION_LENGTH = 64 * 1024;

/**
 * Whether a packed passkey signature was made over `intent` — its challenge
 * equals the intent's canonical bytes. A cheap server-side check of what a
 * browser sent back before you submit it. It does NOT verify the signature
 * itself; the platform does that. Returns false for anything that is not a
 * packed assertion, including one longer than 64 KiB.
 */
export function assertionChallengeMatches(packed: string, intent: ChallengeSource): boolean {
  // `packed` usually comes from a browser, so bound the work it can cause
  // before decoding it. A real assertion is a few kilobytes.
  if (typeof packed !== 'string' || packed.length > MAX_PACKED_ASSERTION_LENGTH) {
    return false;
  }
  try {
    const envelope = JSON.parse(new TextDecoder().decode(base64ToBytes(packed))) as {
      response?: { clientDataJSON?: string };
    };
    const clientDataB64 = envelope.response?.clientDataJSON;
    if (typeof clientDataB64 !== 'string') {
      return false;
    }
    const clientData = JSON.parse(new TextDecoder().decode(base64ToBytes(clientDataB64))) as {
      challenge?: string;
    };
    if (typeof clientData.challenge !== 'string') {
      return false;
    }
    const got = base64ToBytes(clientData.challenge);
    const want = new Uint8Array(buildChallenge(intent));
    return got.length === want.length && got.every((b, i) => b === want[i]);
  } catch {
    return false;
  }
}

/**
 * A {@link GovernanceSigner} backed by a passkey. `getAssertion` receives
 * the challenge and returns the credential; in a browser:
 *
 * ```typescript
 * const signer = webauthnSigner((challenge) =>
 *   navigator.credentials.get({
 *     publicKey: { challenge, rpId: 'app.example.com', userVerification: 'required' },
 *   }) as Promise<PublicKeyCredential>
 * );
 * ```
 *
 * Every call prompts the user, so do not use it with automatic stale-version
 * retries unless a second prompt is acceptable.
 */
export function webauthnSigner(
  getAssertion: (challenge: ArrayBuffer) => Promise<AssertionCredential> | AssertionCredential
): GovernanceSigner {
  return {
    async sign(payload: Uint8Array): Promise<string> {
      const credential = await getAssertion(buildChallenge(payload));
      return packAssertion(credential);
    },
  };
}
