/**
 * Webhook event parsing tests.
 */

import { describe, it, expect } from 'vitest';
import {
  parseEvent,
  matchesEventType,
  WebhookEventType,
  type ScheduledPaymentFailedData,
} from '../../src/webhook/events.js';

describe('Webhook Events', () => {
  describe('parseEvent', () => {
    it('parses valid event from string', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.created',
        created: 1234567890,
        data: { object: { id: 'cust_abc', name: 'Test' } },
      });

      const event = parseEvent(payload);

      expect(event.id).toBe('evt_123');
      expect(event.type).toBe('customer.created');
      expect(event.data.object).toEqual({ id: 'cust_abc', name: 'Test' });
      expect(event.created).toBe(1234567890);
    });

    it('parses valid event from Uint8Array', () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          id: 'evt_456',
          type: 'transaction.completed',
          created: 1234567890,
          data: { object: { amount: '100.00' } },
        })
      );

      const event = parseEvent(payload);

      expect(event.id).toBe('evt_456');
      expect(event.type).toBe('transaction.completed');
      expect(event.data.object).toEqual({ amount: '100.00' });
    });

    it('parses the full platform envelope', () => {
      const payload = JSON.stringify({
        id: 'evt_789',
        type: 'customer.updated',
        created: 1705315500,
        api_version: '1.0.0',
        request: { id: 'req_1', idempotency_key: 'idem_1' },
        data: {
          object: { id: 'cust_abc', name: 'New Name' },
          previous_attributes: { name: 'Old Name' },
        },
        metadata: { source: 'dashboard' },
      });

      const event = parseEvent(payload);

      expect(event.api_version).toBe('1.0.0');
      expect(event.request).toEqual({ id: 'req_1', idempotency_key: 'idem_1' });
      expect(event.data.object).toEqual({ id: 'cust_abc', name: 'New Name' });
      expect(event.data.previous_attributes).toEqual({ name: 'Old Name' });
      expect(event.metadata).toEqual({ source: 'dashboard' });
    });

    it('throws for invalid JSON', () => {
      expect(() => parseEvent('not json')).toThrow('malformed JSON');
    });

    it('throws for missing id', () => {
      const payload = JSON.stringify({
        type: 'customer.created',
        data: { object: {} },
      });

      expect(() => parseEvent(payload)).toThrow('missing or invalid id');
    });

    it('throws for missing type', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        data: { object: {} },
      });

      expect(() => parseEvent(payload)).toThrow('missing or invalid type');
    });

    it('yields an empty object for missing data', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.created',
        created: 123,
      });

      const event = parseEvent(payload);
      expect(event.data.object).toEqual({});
    });

    it('yields an empty object for missing data.object', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'customer.created',
        created: 123,
        data: {},
      });

      const event = parseEvent(payload);
      expect(event.data.object).toEqual({});
    });

    it('preserves api_version if present', () => {
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'test',
        created: 123,
        data: { object: {} },
        api_version: '1.0.0',
      });

      const event = parseEvent(payload);
      expect(event.api_version).toBe('1.0.0');
    });
  });

  describe('scheduled_payment.failed payload', () => {
    it('decodes a full agent-bound payload', () => {
      const payload = JSON.stringify({
        id: 'evt_spf_1',
        type: 'scheduled_payment.failed',
        created: 1705315500,
        data: {
          object: {
            scheduled_payment_id: 'sp_1',
            signer_id: 'sgn_1',
            wallet_id: 'wlt_1',
            address: '0xabc',
            amount: '25.00',
            asset: 'USDC',
            network_id: 'base',
            scheduled_at: 1705315000,
            failure_code: 'mandate_expired',
            failure_reason: 'The mandate backing this schedule has expired.',
            payment_agent_id: 'pa_1',
            recipient_id: 'rcp_1',
            destination_id: 'dst_1',
          },
        },
      });

      const event = parseEvent<ScheduledPaymentFailedData>(payload);

      expect(event.type).toBe(WebhookEventType.ScheduledPaymentFailed);
      expect(event.data.object.scheduled_payment_id).toBe('sp_1');
      expect(event.data.object.failure_code).toBe('mandate_expired');
      expect(event.data.object.payment_agent_id).toBe('pa_1');
    });

    it('decodes a bare-address payload (no agent/recipient/destination linkage)', () => {
      const payload = JSON.stringify({
        id: 'evt_spf_2',
        type: 'scheduled_payment.failed',
        created: 1705315500,
        data: {
          object: {
            scheduled_payment_id: 'sp_2',
            signer_id: 'sgn_2',
            wallet_id: 'wlt_2',
            address: '0xdef',
            amount: '10.00',
            asset: 'USDC',
            network_id: 'base',
            scheduled_at: 1705315000,
            failure_code: 'insufficient_funds',
            failure_reason: 'The wallet balance does not cover this payment.',
          },
        },
      });

      const event = parseEvent<ScheduledPaymentFailedData>(payload);

      expect(event.data.object.payment_agent_id).toBeUndefined();
      expect(event.data.object.recipient_id).toBeUndefined();
      expect(event.data.object.destination_id).toBeUndefined();
      expect(event.data.object.failure_code).toBe('insufficient_funds');
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

    it('has scheduled payment events', () => {
      expect(WebhookEventType.ScheduledPaymentFailed).toBe('scheduled_payment.failed');
    });
  });
});
