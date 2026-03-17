/**
 * Webhook signature verification tests.
 */

import { describe, it, expect } from 'vitest';
import * as ed25519 from '@noble/ed25519';
import {
  verifySignature,
  parsePublicKey,
  parseSignature,
  validateTimestamp,
  SignatureVerificationError,
} from '../../src/webhook/signature.js';

// Use a fixed test key pair (deterministic for CI compatibility)
const privateKey = new Uint8Array([
  0x9d, 0x61, 0xb1, 0x9d, 0xef, 0xfd, 0x5a, 0x60, 0xba, 0x84, 0x4a, 0xf4, 0x92, 0xec, 0x2c, 0xc4,
  0x44, 0x49, 0xc5, 0x69, 0x7b, 0x32, 0x69, 0x19, 0x70, 0x3b, 0xac, 0x03, 0x1c, 0xae, 0x7f, 0x60,
]);
const publicKey = ed25519.getPublicKey(privateKey);
const publicKeyHex = Buffer.from(publicKey).toString('hex');

/**
 * Create a valid signature for testing.
 */
async function createSignature(payload: string, timestamp: string): Promise<string> {
  const message = new TextEncoder().encode(`${timestamp}.${payload}`);
  const signature = await ed25519.signAsync(message, privateKey);
  return Buffer.from(signature).toString('base64');
}

describe('Webhook Signature', () => {
  describe('parsePublicKey', () => {
    it('parses valid hex public key', () => {
      const key = parsePublicKey(publicKeyHex);
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('throws for empty key', () => {
      expect(() => parsePublicKey('')).toThrow(SignatureVerificationError);
      expect(() => parsePublicKey('')).toThrow('Public key is required');
    });

    it('throws for invalid length', () => {
      expect(() => parsePublicKey('abcd')).toThrow(SignatureVerificationError);
      expect(() => parsePublicKey('abcd')).toThrow('Invalid public key length');
    });

    it('throws for non-hex characters', () => {
      expect(() => parsePublicKey('g'.repeat(64))).toThrow(SignatureVerificationError);
      expect(() => parsePublicKey('g'.repeat(64))).toThrow('must be hex-encoded');
    });

    it('handles uppercase hex', () => {
      const key = parsePublicKey(publicKeyHex.toUpperCase());
      expect(key).toBeInstanceOf(Uint8Array);
    });

    it('trims whitespace', () => {
      const key = parsePublicKey(`  ${publicKeyHex}  `);
      expect(key).toBeInstanceOf(Uint8Array);
    });
  });

  describe('parseSignature', () => {
    it('parses valid base64 signature', async () => {
      const signatureB64 = await createSignature('test', '123456');
      const sig = parseSignature(signatureB64);
      expect(sig).toBeInstanceOf(Uint8Array);
      expect(sig.length).toBe(64);
    });

    it('throws for empty signature', () => {
      expect(() => parseSignature('')).toThrow(SignatureVerificationError);
      expect(() => parseSignature('')).toThrow('Signature is required');
    });

    it('throws for invalid base64', () => {
      expect(() => parseSignature('not-valid-base64!!!')).toThrow(SignatureVerificationError);
    });

    it('throws for wrong length', () => {
      // 32 bytes instead of 64
      const shortSig = Buffer.from(new Uint8Array(32)).toString('base64');
      expect(() => parseSignature(shortSig)).toThrow(SignatureVerificationError);
      expect(() => parseSignature(shortSig)).toThrow('Invalid signature length');
    });
  });

  describe('validateTimestamp', () => {
    it('accepts timestamp within tolerance', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(() => validateTimestamp(now.toString(), 300)).not.toThrow();
    });

    it('accepts timestamp exactly at tolerance', () => {
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
      expect(() => validateTimestamp(fiveMinutesAgo.toString(), 300)).not.toThrow();
    });

    it('rejects timestamp beyond tolerance', () => {
      const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
      expect(() => validateTimestamp(tenMinutesAgo.toString(), 300)).toThrow(
        SignatureVerificationError
      );
      expect(() => validateTimestamp(tenMinutesAgo.toString(), 300)).toThrow('expired');
    });

    it('rejects timestamp too far in future', () => {
      const tenMinutesAhead = Math.floor(Date.now() / 1000) + 600;
      expect(() => validateTimestamp(tenMinutesAhead.toString(), 300)).toThrow(
        SignatureVerificationError
      );
      expect(() => validateTimestamp(tenMinutesAhead.toString(), 300)).toThrow('future');
    });

    it('throws for empty timestamp', () => {
      expect(() => validateTimestamp('', 300)).toThrow(SignatureVerificationError);
      expect(() => validateTimestamp('', 300)).toThrow('Timestamp is required');
    });

    it('throws for non-numeric timestamp', () => {
      expect(() => validateTimestamp('not-a-number', 300)).toThrow(SignatureVerificationError);
      expect(() => validateTimestamp('not-a-number', 300)).toThrow('must be a Unix timestamp');
    });
  });

  describe('verifySignature', () => {
    it('verifies valid signature', async () => {
      const payload = '{"id":"evt_123","type":"test"}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await createSignature(payload, timestamp);

      await expect(
        verifySignature(payload, signature, timestamp, publicKeyHex)
      ).resolves.not.toThrow();
    });

    it('verifies with Uint8Array payload', async () => {
      const payload = new TextEncoder().encode('{"id":"evt_123"}');
      const payloadStr = new TextDecoder().decode(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await createSignature(payloadStr, timestamp);

      await expect(
        verifySignature(payload, signature, timestamp, publicKeyHex)
      ).resolves.not.toThrow();
    });

    it('rejects tampered payload', async () => {
      const payload = '{"id":"evt_123"}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await createSignature(payload, timestamp);

      await expect(
        verifySignature('{"id":"evt_456"}', signature, timestamp, publicKeyHex)
      ).rejects.toThrow(SignatureVerificationError);
    });

    it('rejects tampered timestamp', async () => {
      const payload = '{"id":"evt_123"}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await createSignature(payload, timestamp);
      const differentTimestamp = (parseInt(timestamp) + 1).toString();

      await expect(
        verifySignature(payload, signature, differentTimestamp, publicKeyHex)
      ).rejects.toThrow(SignatureVerificationError);
    });

    it('rejects wrong public key', async () => {
      const payload = '{"id":"evt_123"}';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await createSignature(payload, timestamp);

      // Use a different fixed key (not matching the signature key)
      const otherPrivateKey = new Uint8Array([
        0xc5, 0xaa, 0x8d, 0xf4, 0x3f, 0x9f, 0x83, 0x7b, 0xed, 0xb7, 0x44, 0x2f, 0x31, 0xdc, 0xb7,
        0xb1, 0x66, 0xd3, 0x85, 0x35, 0x07, 0x6f, 0x09, 0x4b, 0x85, 0xce, 0x3a, 0x2e, 0x0b, 0x44,
        0x58, 0xf7,
      ]);
      const otherPublicKey = ed25519.getPublicKey(otherPrivateKey);
      const otherPublicKeyHex = Buffer.from(otherPublicKey).toString('hex');

      await expect(
        verifySignature(payload, signature, timestamp, otherPublicKeyHex)
      ).rejects.toThrow(SignatureVerificationError);
    });

    it('rejects expired timestamp before verifying signature', async () => {
      const payload = '{"id":"evt_123"}';
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const signature = await createSignature(payload, oldTimestamp);

      await expect(verifySignature(payload, signature, oldTimestamp, publicKeyHex)).rejects.toThrow(
        'expired'
      );
    });

    it('uses custom tolerance', async () => {
      const payload = '{"id":"evt_123"}';
      const fourMinutesAgo = Math.floor(Date.now() / 1000) - 240;
      const timestamp = fourMinutesAgo.toString();
      const signature = await createSignature(payload, timestamp);

      // Should fail with 60 second tolerance
      await expect(
        verifySignature(payload, signature, timestamp, publicKeyHex, 60)
      ).rejects.toThrow('expired');

      // Should succeed with 300 second tolerance
      await expect(
        verifySignature(payload, signature, timestamp, publicKeyHex, 300)
      ).resolves.not.toThrow();
    });
  });
});
