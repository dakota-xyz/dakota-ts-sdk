/**
 * Webhook event parsing tests.
 */

import { describe, it, expect } from 'vitest';
import { parseEvent, matchesEventType, WebhookEventType } from '../../src/webhook/events.js';

describe('Webhook Events', () => {
  describe('parseEvent', () => {
    it('parses valid event from string', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.created',
        data: { id: 'cust_abc', name: 'Test' },
        created_at: 1234567890,
      });

      const event = parseEvent(payload);

      expect(event.id).toBe('evt_123');
      expect(event.type).toBe('customer.created');
      expect(event.data).toEqual({ id: 'cust_abc', name: 'Test' });
      expect(event.created_at).toBe(1234567890);
    });

    it('parses valid event from Uint8Array', () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          id: 'evt_456',
          type: 'transaction.completed',
          data: { amount: '100.00' },
          created_at: 1234567890,
        })
      );

      const event = parseEvent(payload);

      expect(event.id).toBe('evt_456');
      expect(event.type).toBe('transaction.completed');
      expect(event.data).toEqual({ amount: '100.00' });
    });

    it('throws for invalid JSON', () => {
      expect(() => parseEvent('not json')).toThrow('malformed JSON');
    });

    it('throws for missing id', () => {
      const payload = JSON.stringify({
        type: 'customer.created',
        data: {},
      });

      expect(() => parseEvent(payload)).toThrow('missing or invalid id');
    });

    it('throws for missing type', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        data: {},
      });

      expect(() => parseEvent(payload)).toThrow('missing or invalid type');
    });

    it('throws for missing data', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.created',
      });

      expect(() => parseEvent(payload)).toThrow('missing data');
    });

    it('preserves api_version if present', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
        api_version: '2024-01-01',
      });

      const event = parseEvent(payload);
      expect(event.api_version).toBe('2024-01-01');
    });
  });

  describe('matchesEventType', () => {
    it('matches exact event type', () => {
      expect(matchesEventType('customer.created', 'customer.created')).toBe(true);
      expect(matchesEventType('customer.created', 'customer.updated')).toBe(false);
    });

    it('matches wildcard pattern', () => {
      expect(matchesEventType('customer.created', 'customer.*')).toBe(true);
      expect(matchesEventType('customer.updated', 'customer.*')).toBe(true);
      expect(matchesEventType('transaction.completed', 'customer.*')).toBe(false);
    });

    it('matches global wildcard', () => {
      expect(matchesEventType('customer.created', '*')).toBe(true);
      expect(matchesEventType('transaction.completed', '*')).toBe(true);
    });

    it('does not match partial patterns', () => {
      expect(matchesEventType('customer.created', 'customer')).toBe(false);
      expect(matchesEventType('customer.created.nested', 'customer.*')).toBe(true);
    });
  });

  describe('WebhookEventType enum', () => {
    it('has customer events', () => {
      expect(WebhookEventType.CustomerCreated).toBe('customer.created');
      expect(WebhookEventType.CustomerUpdated).toBe('customer.updated');
    });

    it('has transaction events', () => {
      expect(WebhookEventType.TransactionCreated).toBe('transaction.created');
      expect(WebhookEventType.TransactionCompleted).toBe('transaction.completed');
    });

    it('has wallet events', () => {
      expect(WebhookEventType.WalletCreated).toBe('wallet.created');
    });

    it('has transaction events', () => {
      expect(WebhookEventType.TransactionAutoCreated).toBe('transaction.auto.created');
      expect(WebhookEventType.TransactionAutoUpdated).toBe('transaction.auto.updated');
      expect(WebhookEventType.TransactionOneOffCreated).toBe('transaction.one_off.created');
      expect(WebhookEventType.TransactionOneOffUpdated).toBe('transaction.one_off.updated');
    });

    it('has user and api key events', () => {
      expect(WebhookEventType.UserCreated).toBe('user.created');
      expect(WebhookEventType.UserUpdated).toBe('user.updated');
      expect(WebhookEventType.UserDeleted).toBe('user.deleted');
      expect(WebhookEventType.ApiKeyCreated).toBe('api_key.created');
      expect(WebhookEventType.ApiKeyDeleted).toBe('api_key.deleted');
    });

    it('has exception events', () => {
      expect(WebhookEventType.ExceptionCreated).toBe('exception.created');
      expect(WebhookEventType.ExceptionCleared).toBe('exception.cleared');
    });
  });
});
