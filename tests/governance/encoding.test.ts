/**
 * The governance entry's own base64 / byte helpers (it cannot use Buffer).
 * Expected values come from Node's Buffer, an independent implementation.
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import {
  base64ToBytes,
  bytesToBase64,
  bytesToBase64url,
  toBytes,
} from '../../src/governance/encoding.js';

describe('governance encoding helpers', () => {
  it('match Buffer for every length mod 3, in both alphabets', () => {
    for (let n = 0; n < 40; n++) {
      const b = randomBytes(n);
      expect(bytesToBase64(b)).toBe(b.toString('base64'));
      expect(bytesToBase64url(b)).toBe(b.toString('base64url'));
      expect(Buffer.from(base64ToBytes(b.toString('base64'))).equals(b)).toBe(true);
      expect(Buffer.from(base64ToBytes(b.toString('base64url'))).equals(b)).toBe(true);
    }
  });

  it('refuses characters outside both alphabets and impossible lengths', () => {
    expect(() => base64ToBytes('ab$d')).toThrow(/base64/);
    expect(() => base64ToBytes('abcde')).toThrow(/base64/);
  });

  it('copies a view without its neighbours in the backing buffer', () => {
    const backing = new Uint8Array([9, 1, 2, 3, 9]);
    const view = new Uint8Array(backing.buffer, 1, 3);
    const copy = toBytes(view);
    expect([...copy]).toEqual([1, 2, 3]);
    backing[1] = 7;
    expect(copy[0]).toBe(1);
    expect([...toBytes(backing.buffer)]).toEqual([9, 7, 2, 3, 9]);
  });
});
