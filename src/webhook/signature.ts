/**
 * Webhook signature verification using Ed25519.
 */

import * as ed25519 from '@noble/ed25519';

/** Default timestamp tolerance in seconds (5 minutes) */
export const DEFAULT_TIMESTAMP_TOLERANCE = 300;

/** Webhook signature header name */
export const SIGNATURE_HEADER = 'x-webhook-signature';

/** Webhook timestamp header name */
export const TIMESTAMP_HEADER = 'x-webhook-timestamp';

/**
 * Error thrown when signature verification fails.
 */
export class SignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureVerificationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SignatureVerificationError);
    }
  }
}

/**
 * Parse a hex-encoded Ed25519 public key.
 *
 * @param hexKey - Hex-encoded public key (64 characters)
 * @returns Parsed public key as Uint8Array
 * @throws SignatureVerificationError if the key is invalid
 */
export function parsePublicKey(hexKey: string): Uint8Array {
  if (!hexKey || typeof hexKey !== 'string') {
    throw new SignatureVerificationError('Public key is required');
  }

  // Remove any whitespace and convert to lowercase
  const cleanKey = hexKey.trim().toLowerCase();

  // Ed25519 public keys are 32 bytes = 64 hex characters
  if (cleanKey.length !== 64) {
    throw new SignatureVerificationError(
      `Invalid public key length: expected 64 hex characters, got ${cleanKey.length}`
    );
  }

  // Validate hex format
  if (!/^[0-9a-f]+$/.test(cleanKey)) {
    throw new SignatureVerificationError('Invalid public key: must be hex-encoded');
  }

  // Convert hex to Uint8Array
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanKey.substring(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

/**
 * Parse a base64-encoded Ed25519 signature.
 *
 * @param signatureB64 - Base64-encoded signature
 * @returns Parsed signature as Uint8Array
 * @throws SignatureVerificationError if the signature is invalid
 */
export function parseSignature(signatureB64: string): Uint8Array {
  if (!signatureB64 || typeof signatureB64 !== 'string') {
    throw new SignatureVerificationError('Signature is required');
  }

  try {
    // Handle both standard and URL-safe base64
    const normalized = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(normalized);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Ed25519 signatures are 64 bytes
    if (bytes.length !== 64) {
      throw new SignatureVerificationError(
        `Invalid signature length: expected 64 bytes, got ${bytes.length}`
      );
    }

    return bytes;
  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      throw error;
    }
    throw new SignatureVerificationError('Invalid signature: must be base64-encoded');
  }
}

/**
 * Validate the timestamp is within tolerance.
 *
 * @param timestampStr - Unix timestamp as string
 * @param toleranceSeconds - Maximum age in seconds
 * @throws SignatureVerificationError if timestamp is invalid or expired
 */
export function validateTimestamp(timestampStr: string, toleranceSeconds: number): void {
  if (!timestampStr || typeof timestampStr !== 'string') {
    throw new SignatureVerificationError('Timestamp is required');
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    throw new SignatureVerificationError('Invalid timestamp: must be a Unix timestamp');
  }

  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  if (age > toleranceSeconds) {
    throw new SignatureVerificationError(
      `Timestamp expired: ${age} seconds old (tolerance: ${toleranceSeconds}s)`
    );
  }

  // Also reject timestamps too far in the future (clock skew protection)
  if (age < -toleranceSeconds) {
    throw new SignatureVerificationError(
      `Timestamp is in the future: ${-age} seconds ahead (tolerance: ${toleranceSeconds}s)`
    );
  }
}

/**
 * Build the message to verify.
 *
 * The signed message is the raw concatenation `timestamp || payload` with
 * no separator. Earlier versions used `timestamp + '.' + payload`, which
 * silently rejected every webhook because the platform signer at
 * platform/internal/security/webhook_signer.go:73-78 concatenates without
 * a separator.
 */
function buildSignedMessage(payload: Uint8Array | string, timestamp: string): Uint8Array {
  const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
  const timestampBytes = new TextEncoder().encode(timestamp);

  const message = new Uint8Array(timestampBytes.length + payloadBytes.length);
  message.set(timestampBytes);
  message.set(payloadBytes, timestampBytes.length);

  return message;
}

/**
 * Verify a webhook signature.
 *
 * @param payload - The raw request body
 * @param signatureB64 - The X-Webhook-Signature header value (base64)
 * @param timestampStr - The X-Webhook-Timestamp header value
 * @param publicKeyHex - Your webhook public key (hex-encoded)
 * @param toleranceSeconds - Maximum timestamp age (default: 300 seconds)
 * @returns Promise that resolves if verification succeeds
 * @throws SignatureVerificationError if verification fails
 *
 * @example
 * ```typescript
 * await verifySignature(
 *   requestBody,
 *   request.headers['x-webhook-signature'],
 *   request.headers['x-webhook-timestamp'],
 *   process.env.DAKOTA_WEBHOOK_PUBLIC_KEY
 * );
 * ```
 */
export async function verifySignature(
  payload: Uint8Array | string,
  signatureB64: string,
  timestampStr: string,
  publicKeyHex: string,
  toleranceSeconds: number = DEFAULT_TIMESTAMP_TOLERANCE
): Promise<void> {
  // Validate timestamp first (fast path rejection)
  validateTimestamp(timestampStr, toleranceSeconds);

  // Parse public key and signature
  const publicKey = parsePublicKey(publicKeyHex);
  const signature = parseSignature(signatureB64);

  // Build the signed message
  const message = buildSignedMessage(payload, timestampStr);

  // Verify the signature
  const isValid = await ed25519.verifyAsync(signature, message, publicKey);

  if (!isValid) {
    throw new SignatureVerificationError('Signature verification failed');
  }
}

/**
 * Synchronous signature verification (if available).
 *
 * Note: This may not work in all environments. Use verifySignature for
 * guaranteed compatibility.
 */
export function verifySignatureSync(
  payload: Uint8Array | string,
  signatureB64: string,
  timestampStr: string,
  publicKeyHex: string,
  toleranceSeconds: number = DEFAULT_TIMESTAMP_TOLERANCE
): void {
  // Validate timestamp first (fast path rejection)
  validateTimestamp(timestampStr, toleranceSeconds);

  // Parse public key and signature
  const publicKey = parsePublicKey(publicKeyHex);
  const signature = parseSignature(signatureB64);

  // Build the signed message
  const message = buildSignedMessage(payload, timestampStr);

  // Verify the signature synchronously
  const isValid = ed25519.verify(signature, message, publicKey);

  if (!isValid) {
    throw new SignatureVerificationError('Signature verification failed');
  }
}

// ---------------------------------------------------------------------------
// Several trusted keys: X-Dakota-Webhook-Signatures (ENG-6686)
// ---------------------------------------------------------------------------

/**
 * Header carrying one signature per Dakota signing key, as comma-separated
 * `<key id>:<base64 signature>` entries:
 *
 * ```http
 * X-Dakota-Webhook-Signatures: 65b797d6:<base64>, 9c41e0aa:<base64>
 * ```
 *
 * It usually carries one entry, and two while Dakota rotates its signing key.
 * Every entry signs the same message as {@link SIGNATURE_HEADER}: the
 * timestamp followed by the body. Prefer it: {@link SIGNATURE_HEADER} carries
 * only the current key, so it switches keys at cutover with no overlap.
 */
export const SIGNATURES_HEADER = 'x-dakota-webhook-signatures';

/** Number of hex characters of a public key that name it in {@link SIGNATURES_HEADER}. */
const KEY_ID_LENGTH = 8;

/** @internal Lowercase hex of raw bytes. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * The id that names a public key in {@link SIGNATURES_HEADER}: the first 8 hex
 * characters of the key, in lowercase. Key ids are safe to log.
 *
 * @param publicKey - Hex-encoded public key, or its 32 raw bytes
 */
export function keyId(publicKey: Uint8Array | string): string {
  const bytes = typeof publicKey === 'string' ? parsePublicKey(publicKey) : publicKey;
  return toHex(bytes).slice(0, KEY_ID_LENGTH);
}

/**
 * Parse hex-encoded Ed25519 public keys. Each argument may be one key, a
 * comma-separated list (such as a `DAKOTA_WEBHOOK_PUBLIC_KEYS` environment
 * variable) or an array of either. Spaces around a key and empty list items
 * are ignored, case does not matter, and a key given twice is kept once.
 *
 * @returns The keys, in the order given
 * @throws SignatureVerificationError if a key is not 64 hex characters, or if
 *   no key is given. The message names the key's position, never its value,
 *   so a private key pasted by mistake does not reach a log.
 */
export function parsePublicKeys(
  ...lists: Array<string | readonly string[] | null | undefined>
): Uint8Array[] {
  const keys = parsePublicKeyList(lists);
  if (keys.length === 0) {
    throw new SignatureVerificationError('At least one webhook public key is required');
  }
  return keys;
}

/**
 * {@link parsePublicKeys} without the "at least one key" check. Unset values
 * (`undefined`, `null`) count as empty.
 *
 * @internal
 */
export function parsePublicKeyList(
  lists: ReadonlyArray<string | readonly string[] | null | undefined>
): Uint8Array[] {
  const keys: Uint8Array[] = [];
  const seen = new Set<string>();
  let position = 0;

  for (const list of lists) {
    if (list === undefined || list === null) {
      continue;
    }
    if (typeof list !== 'string' && !Array.isArray(list)) {
      throw new SignatureVerificationError('Webhook public keys must be strings');
    }
    const items: readonly unknown[] = typeof list === 'string' ? [list] : list;
    for (const item of items) {
      if (typeof item !== 'string') {
        throw new SignatureVerificationError('Webhook public keys must be strings');
      }
      for (const raw of item.split(',')) {
        const value = raw.trim().toLowerCase();
        if (value === '') {
          continue;
        }
        position++;
        if (!/^[0-9a-f]{64}$/.test(value)) {
          throw new SignatureVerificationError(
            `Webhook public key ${position} is not 64 hex characters (a hex-encoded Ed25519 public key)`
          );
        }
        if (seen.has(value)) {
          continue;
        }
        seen.add(value);
        keys.push(parsePublicKey(value));
      }
    }
  }
  return keys;
}

/**
 * Trusted keys, indexed by key id. Two keys share an id only by a 1-in-2^32
 * chance; both are then checked.
 *
 * @internal
 */
export interface TrustedKeys {
  readonly keys: readonly Uint8Array[];
  readonly byId: ReadonlyMap<string, readonly Uint8Array[]>;
}

/** @internal */
export function trustedKeys(keys: readonly Uint8Array[]): TrustedKeys {
  const byId = new Map<string, Uint8Array[]>();
  for (const key of keys) {
    const id = keyId(key);
    const list = byId.get(id);
    if (list) {
      list.push(key);
    } else {
      byId.set(id, [key]);
    }
  }
  return { keys, byId };
}

/** A raw header value, as Node and most frameworks hand it over. */
export type WebhookHeaderValue = string | readonly string[] | null | undefined;

/**
 * Signature header values of one delivery. Pass the raw header values: blank
 * or missing values count as missing, and a list header split over several
 * values is joined back.
 */
export interface WebhookSignatureHeaders {
  /** `X-Webhook-Timestamp` */
  timestamp: WebhookHeaderValue;
  /** `X-Dakota-Webhook-Signatures`, the list header (preferred) */
  signatures?: WebhookHeaderValue;
  /** `X-Webhook-Signature`, the legacy single-signature header (fallback) */
  signature?: WebhookHeaderValue;
}

/** Normalized header values: strings, or undefined when missing or blank. */
interface NormalizedHeaders {
  timestamp: string | undefined;
  signatures: string | undefined;
  signature: string | undefined;
}

function firstValue(value: unknown): string | undefined {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() !== '' ? first : undefined;
}

/**
 * Normalize header values. Anything that is not a string counts as missing. A
 * list header split over several values is joined with ",", dropping blank
 * values, so an all-blank list still falls back to the legacy header.
 *
 * @internal
 */
export function normalizeSignatureHeaders(headers: WebhookSignatureHeaders): NormalizedHeaders {
  const raw: unknown = headers.signatures;
  const parts = (Array.isArray(raw) ? raw : [raw]).filter(
    (part): part is string => typeof part === 'string' && part.trim() !== ''
  );
  return {
    timestamp: firstValue(headers.timestamp),
    signatures: parts.length > 0 ? parts.join(',') : undefined,
    signature: firstValue(headers.signature),
  };
}

interface Check {
  key: Uint8Array;
  signature: Uint8Array;
}

/**
 * The signature checks a delivery needs, at most one per trusted key.
 *
 * With a non-blank list header: split on ",", trim each entry, split it at the
 * first ":" into a key id and a base64 signature, skip ids that are not
 * trusted (compared in lowercase). The first entry naming a trusted id checks
 * every trusted key with that id; later entries naming it are skipped, so a
 * request costs at most one check per trusted key however many entries it
 * carries. A malformed signature in an entry fails that entry only. The legacy
 * header is NOT consulted, even if no entry verifies.
 *
 * Only when the list header is missing or blank: the legacy header, against
 * every trusted key.
 */
function planChecks(trusted: TrustedKeys, headers: NormalizedHeaders): Check[] {
  const list = headers.signatures;
  if (list !== undefined) {
    const checks: Check[] = [];
    const checked = new Set<string>();
    for (const rawEntry of list.split(',')) {
      const item = rawEntry.trim();
      const colon = item.indexOf(':');
      if (colon < 0) {
        continue;
      }
      const id = item.slice(0, colon).trim().toLowerCase();
      const keys = trusted.byId.get(id);
      if (!keys || checked.has(id)) {
        continue;
      }
      checked.add(id);
      let signature: Uint8Array;
      try {
        signature = parseSignature(item.slice(colon + 1));
      } catch {
        continue; // this entry fails; the others are still checked
      }
      for (const key of keys) {
        checks.push({ key, signature });
      }
    }
    return checks;
  }

  const legacy = headers.signature;
  if (legacy === undefined) {
    throw new SignatureVerificationError(
      `Missing ${SIGNATURES_HEADER} and ${SIGNATURE_HEADER} headers`
    );
  }
  // A malformed legacy signature throws, as verifySignature always has.
  const signature = parseSignature(legacy.trim());
  return trusted.keys.map((key) => ({ key, signature }));
}

// The same text as verifySignature's: expressMiddleware sends error messages
// back to the sender, so it must stay as generic as before (no key ids).
const NO_TRUSTED_KEY = 'Signature verification failed';

/**
 * A known-good signature (platform's golden vector,
 * `internal/security/webhook_signer_rotation_test.go`). When a check throws,
 * verifying this tells the two causes apart without depending on the
 * library's error wording: if it verifies, the runtime is fine and the
 * delivery's signature was malformed (that check fails); if it does not, the
 * runtime cannot verify at all (for example no SHA-512), and the error is
 * rethrown, so a misconfigured runtime is never mistaken for a forged webhook.
 */
const SELF_TEST = {
  publicKey: '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664',
  timestamp: '1795430000',
  body: '{"id":"evt_golden"}',
  signature:
    'kIhEmnAagqhecIiFrM89I6C2n8J4m6VS8GI8Rf7R1EROAtsC1clJef+0BE9nTNwzB3OmR8wkVpBqGcEcpXZuAA==',
};

function selfTestInputs(): [Uint8Array, Uint8Array, Uint8Array] {
  return [
    parseSignature(SELF_TEST.signature),
    buildSignedMessage(SELF_TEST.body, SELF_TEST.timestamp),
    parsePublicKey(SELF_TEST.publicKey),
  ];
}

/** Rethrows `error` unless the runtime verifies the known-good signature. */
async function assertRuntimeCanVerify(error: unknown): Promise<void> {
  let ok = false;
  try {
    ok = await ed25519.verifyAsync(...selfTestInputs());
  } catch {
    ok = false;
  }
  if (!ok) {
    throw error;
  }
}

/** Synchronous {@link assertRuntimeCanVerify}. */
function assertRuntimeCanVerifySync(error: unknown): void {
  let ok = false;
  try {
    ok = ed25519.verify(...selfTestInputs());
  } catch {
    ok = false;
  }
  if (!ok) {
    throw error;
  }
}

function prepare(
  payload: Uint8Array | string,
  headers: WebhookSignatureHeaders,
  trusted: TrustedKeys,
  toleranceSeconds: number
): { checks: Check[]; message: Uint8Array } {
  const normalized = normalizeSignatureHeaders(headers);
  validateTimestamp(normalized.timestamp as string, toleranceSeconds);
  const checks = planChecks(trusted, normalized);
  return { checks, message: buildSignedMessage(payload, normalized.timestamp as string) };
}

/** @internal Verify against a prepared key set (used by WebhookHandler). */
export async function verifyWithTrustedKeys(
  payload: Uint8Array | string,
  headers: WebhookSignatureHeaders,
  trusted: TrustedKeys,
  toleranceSeconds: number
): Promise<void> {
  const { checks, message } = prepare(payload, headers, trusted, toleranceSeconds);
  let runtimeChecked = false;
  for (const { key, signature } of checks) {
    try {
      if (await ed25519.verifyAsync(signature, message, key)) {
        return;
      }
    } catch (error) {
      // A malformed signature fails this check; a runtime that cannot verify
      // rethrows. The self-test runs at most once per delivery.
      if (!runtimeChecked) {
        await assertRuntimeCanVerify(error);
        runtimeChecked = true;
      }
    }
  }
  throw new SignatureVerificationError(NO_TRUSTED_KEY);
}

/** @internal Synchronous {@link verifyWithTrustedKeys}. */
export function verifyWithTrustedKeysSync(
  payload: Uint8Array | string,
  headers: WebhookSignatureHeaders,
  trusted: TrustedKeys,
  toleranceSeconds: number
): void {
  if (typeof ed25519.etc.sha512Sync !== 'function') {
    throw new Error(
      'Synchronous webhook verification needs @noble/ed25519 etc.sha512Sync to be set; ' +
        'use verifyWebhookSignatures (async) instead'
    );
  }
  const { checks, message } = prepare(payload, headers, trusted, toleranceSeconds);
  let runtimeChecked = false;
  for (const { key, signature } of checks) {
    try {
      if (ed25519.verify(signature, message, key)) {
        return;
      }
    } catch (error) {
      if (!runtimeChecked) {
        assertRuntimeCanVerifySync(error);
        runtimeChecked = true;
      }
    }
  }
  throw new SignatureVerificationError(NO_TRUSTED_KEY);
}

/**
 * Verify a webhook against several trusted Dakota public keys, so verification
 * keeps working while Dakota rotates its signing key: trust the current key
 * and, once Dakota publishes it, the next one; remove the old key when Dakota
 * retires it.
 *
 * Checks, in order: the timestamp is within tolerance; then
 * `X-Dakota-Webhook-Signatures` (see {@link SIGNATURES_HEADER}) if it is
 * present and not blank, accepting if any entry from a trusted key verifies;
 * otherwise `X-Webhook-Signature` against every trusted key. A list header
 * that is present but fails is rejected without falling back.
 *
 * @param payload - The raw request body, exactly as received
 * @param headers - The timestamp and signature header values
 * @param publicKeys - Trusted hex public keys: an array, or a comma-separated
 *   list such as `process.env.DAKOTA_WEBHOOK_PUBLIC_KEYS`
 * @param toleranceSeconds - Maximum timestamp age (default: 300 seconds)
 * @throws SignatureVerificationError if the delivery is not verified, or a key
 *   is malformed or missing
 *
 * @example
 * ```typescript
 * await verifyWebhookSignatures(
 *   rawBody,
 *   {
 *     timestamp: req.headers['x-webhook-timestamp'],
 *     signatures: req.headers['x-dakota-webhook-signatures'],
 *     signature: req.headers['x-webhook-signature'],
 *   },
 *   process.env.DAKOTA_WEBHOOK_PUBLIC_KEYS!
 * );
 * ```
 */
export async function verifyWebhookSignatures(
  payload: Uint8Array | string,
  headers: WebhookSignatureHeaders,
  publicKeys: string | readonly string[] | undefined,
  toleranceSeconds: number = DEFAULT_TIMESTAMP_TOLERANCE
): Promise<void> {
  await verifyWithTrustedKeys(
    payload,
    headers,
    trustedKeys(parsePublicKeys(publicKeys)),
    toleranceSeconds
  );
}

/**
 * Synchronous {@link verifyWebhookSignatures}. Needs `etc.sha512Sync` set on
 * `@noble/ed25519` (it throws a plain `Error` saying so otherwise); prefer the
 * async version.
 */
export function verifyWebhookSignaturesSync(
  payload: Uint8Array | string,
  headers: WebhookSignatureHeaders,
  publicKeys: string | readonly string[] | undefined,
  toleranceSeconds: number = DEFAULT_TIMESTAMP_TOLERANCE
): void {
  verifyWithTrustedKeysSync(
    payload,
    headers,
    trustedKeys(parsePublicKeys(publicKeys)),
    toleranceSeconds
  );
}
