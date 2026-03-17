/**
 * Global setup file that runs BEFORE any test files are loaded.
 * This is necessary to polyfill globalThis.crypto before @noble/ed25519 is imported.
 */

import { webcrypto } from 'crypto';

export default function setup() {
  // Polyfill globalThis.crypto for CI environments without Web Crypto API
  if (!globalThis.crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.crypto = webcrypto as any;
  }
}
