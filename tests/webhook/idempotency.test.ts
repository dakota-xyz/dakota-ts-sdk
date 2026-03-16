/**
 * Idempotency store tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryIdempotencyStore } from '../../src/webhook/idempotency.js';

describe('MemoryIdempotencyStore', () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
  });

  describe('has and add', () => {
    it('returns false for unseen event', () => {
      expect(store.has('evt_123')).toBe(false);
    });

    it('returns true for seen event', () => {
      store.add('evt_123');
      expect(store.has('evt_123')).toBe(true);
    });

    it('tracks multiple events', () => {
      store.add('evt_1');
      store.add('evt_2');
      store.add('evt_3');

      expect(store.has('evt_1')).toBe(true);
      expect(store.has('evt_2')).toBe(true);
      expect(store.has('evt_3')).toBe(true);
      expect(store.has('evt_4')).toBe(false);
    });
  });

  describe('size', () => {
    it('returns 0 for empty store', () => {
      expect(store.size).toBe(0);
    });

    it('returns correct size', () => {
      store.add('evt_1');
      store.add('evt_2');
      expect(store.size).toBe(2);
    });

    it('does not count duplicates', () => {
      store.add('evt_1');
      store.add('evt_1');
      expect(store.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all events', () => {
      store.add('evt_1');
      store.add('evt_2');
      store.clear();

      expect(store.has('evt_1')).toBe(false);
      expect(store.has('evt_2')).toBe(false);
      expect(store.size).toBe(0);
    });
  });

  describe('maxSize', () => {
    it('evicts oldest entries when at capacity', () => {
      const smallStore = new MemoryIdempotencyStore({ maxSize: 3 });

      smallStore.add('evt_1');
      smallStore.add('evt_2');
      smallStore.add('evt_3');
      smallStore.add('evt_4'); // Should evict evt_1

      expect(smallStore.has('evt_1')).toBe(false);
      expect(smallStore.has('evt_2')).toBe(true);
      expect(smallStore.has('evt_3')).toBe(true);
      expect(smallStore.has('evt_4')).toBe(true);
      expect(smallStore.size).toBe(3);
    });
  });

  describe('TTL', () => {
    it('expires old entries', async () => {
      const shortTTLStore = new MemoryIdempotencyStore({ ttlMs: 50 });

      shortTTLStore.add('evt_1');
      expect(shortTTLStore.has('evt_1')).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(shortTTLStore.has('evt_1')).toBe(false);
    });
  });
});
