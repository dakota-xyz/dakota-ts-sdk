/**
 * Canonical JSON (RFC 8785 / JCS) tests. Each case is what the platform's
 * `enc.C14nJSON` produces for the same input, so if these pass the SDK's
 * canonicalization matches the platform byte-for-byte.
 */

import { describe, it, expect } from 'vitest';
import { canonicalJSON } from '../../src/agentic/canonicalize.js';

describe('canonicalJSON', () => {
  it('sorts object keys lexicographically', () => {
    expect(canonicalJSON({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it('preserves array order', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]');
  });

  it('produces no whitespace', () => {
    expect(canonicalJSON({ a: [1, 2] })).toBe('{"a":[1,2]}');
  });

  it('encodes primitives', () => {
    expect(canonicalJSON(null)).toBe('null');
    expect(canonicalJSON(true)).toBe('true');
    expect(canonicalJSON(false)).toBe('false');
    expect(canonicalJSON('hi')).toBe('"hi"');
    expect(canonicalJSON(0)).toBe('0');
    expect(canonicalJSON(1798675200)).toBe('1798675200');
  });

  it('escapes strings per JSON', () => {
    expect(canonicalJSON('a"b\nc')).toBe('"a\\"b\\nc"');
  });

  it('sorts nested object keys too', () => {
    expect(canonicalJSON({ b: { z: 1, y: 2 }, a: 0 })).toBe('{"a":0,"b":{"y":2,"z":1}}');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalJSON(Number.NaN)).toThrow();
    expect(() => canonicalJSON(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('rejects bigints', () => {
    expect(() => canonicalJSON({ n: 1n })).toThrow();
  });
});
