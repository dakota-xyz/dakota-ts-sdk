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
 * The signed message format is: `timestamp.payload`
 */
function buildSignedMessage(payload: Uint8Array | string, timestamp: string): Uint8Array {
  const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
  const timestampBytes = new TextEncoder().encode(timestamp + '.');

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
 *   process.env.WEBHOOK_PUBLIC_KEY
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
