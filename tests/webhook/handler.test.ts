/**
 * Webhook handler tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ed25519 from '@noble/ed25519';
import {
  WebhookHandler,
  SignatureVerificationError,
  MemoryIdempotencyStore,
} from '../../src/webhook/index.js';

// Generate test key pair
const privateKey = ed25519.utils.randomPrivateKey();
const publicKey = ed25519.getPublicKey(privateKey);
const publicKeyHex = Buffer.from(publicKey).toString('hex');

/**
 * Create a signed webhook request.
 */
async function createSignedRequest(payload: object) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = new TextEncoder().encode(`${timestamp}.${body}`);
  const signature = await ed25519.signAsync(message, privateKey);
  const signatureB64 = Buffer.from(signature).toString('base64');

  return {
    body,
    headers: {
      'x-webhook-signature': signatureB64,
      'x-webhook-timestamp': timestamp,
    },
  };
}

describe('WebhookHandler', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    handler = new WebhookHandler({ publicKey: publicKeyHex });
  });

  describe('constructor', () => {
    it('requires public key', () => {
      expect(() => new WebhookHandler({ publicKey: '' })).toThrow('Public key is required');
    });

    it('creates handler with valid public key', () => {
      const h = new WebhookHandler({ publicKey: publicKeyHex });
      expect(h).toBeInstanceOf(WebhookHandler);
    });

    it('uses default idempotency store', () => {
      const h = new WebhookHandler({ publicKey: publicKeyHex });
      expect(h).toBeInstanceOf(WebhookHandler);
    });

    it('accepts custom idempotency store', () => {
      const store = new MemoryIdempotencyStore();
      const h = new WebhookHandler({
        publicKey: publicKeyHex,
        idempotencyStore: store,
      });
      expect(h).toBeInstanceOf(WebhookHandler);
    });

    it('accepts idempotencyStore: false to disable', () => {
      const h = new WebhookHandler({
        publicKey: publicKeyHex,
        idempotencyStore: false,
      });
      expect(h).toBeInstanceOf(WebhookHandler);
    });
  });

  describe('on', () => {
    it('registers event handler', () => {
      const onCustomer = vi.fn();
      handler.on('customer.created', onCustomer);
      expect(handler).toBeInstanceOf(WebhookHandler);
    });

    it('allows chaining', () => {
      const result = handler
        .on('customer.created', vi.fn())
        .on('transaction.completed', vi.fn())
        .onDefault(vi.fn());

      expect(result).toBe(handler);
    });
  });

  describe('handleRequest', () => {
    it('verifies and dispatches valid event', async () => {
      const onCustomer = vi.fn();
      handler.on('customer.created', onCustomer);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'customer.created',
        data: { id: 'cust_abc' },
        created_at: 1234567890,
      });

      await handler.handleRequest(body, headers);

      expect(onCustomer).toHaveBeenCalledTimes(1);
      expect(onCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt_123',
          type: 'customer.created',
          data: { id: 'cust_abc' },
        })
      );
    });

    it('calls wildcard handler', async () => {
      const onTransaction = vi.fn();
      handler.on('transaction.*', onTransaction);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'transaction.completed',
        data: {},
        created_at: 123,
      });

      await handler.handleRequest(body, headers);
      expect(onTransaction).toHaveBeenCalled();
    });

    it('calls default handler for unmatched events', async () => {
      const onDefault = vi.fn();
      handler.onDefault(onDefault);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'unknown.event',
        data: {},
        created_at: 123,
      });

      await handler.handleRequest(body, headers);
      expect(onDefault).toHaveBeenCalled();
    });

    it('does not call default handler if specific handler exists', async () => {
      const onCustomer = vi.fn();
      const onDefault = vi.fn();
      handler.on('customer.created', onCustomer).onDefault(onDefault);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'customer.created',
        data: {},
        created_at: 123,
      });

      await handler.handleRequest(body, headers);
      expect(onCustomer).toHaveBeenCalled();
      expect(onDefault).not.toHaveBeenCalled();
    });

    it('rejects missing signature header', async () => {
      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      delete (headers as Record<string, string>)['x-webhook-signature'];

      await expect(handler.handleRequest(body, headers)).rejects.toThrow(
        SignatureVerificationError
      );
    });

    it('rejects missing timestamp header', async () => {
      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      delete (headers as Record<string, string>)['x-webhook-timestamp'];

      await expect(handler.handleRequest(body, headers)).rejects.toThrow(
        SignatureVerificationError
      );
    });

    it('rejects invalid signature', async () => {
      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      // Tamper with signature
      headers['x-webhook-signature'] = 'invalid-signature';

      await expect(handler.handleRequest(body, headers)).rejects.toThrow();
    });

    it('rejects tampered payload', async () => {
      const { headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      const tamperedBody = JSON.stringify({
        id: 'evt_456',
        type: 'test',
        data: {},
        created_at: 123,
      });

      await expect(handler.handleRequest(tamperedBody, headers)).rejects.toThrow(
        SignatureVerificationError
      );
    });

    it('deduplicates events with idempotency store', async () => {
      const onCustomer = vi.fn();
      handler.on('customer.created', onCustomer);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'customer.created',
        data: {},
        created_at: 123,
      });

      // First request
      await handler.handleRequest(body, headers);
      // Second request (duplicate)
      await handler.handleRequest(body, headers);

      expect(onCustomer).toHaveBeenCalledTimes(1);
    });

    it('rejects payload too large', async () => {
      const smallHandler = new WebhookHandler({
        publicKey: publicKeyHex,
        maxPayloadSize: 100,
      });

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: { large: 'x'.repeat(200) },
        created_at: 123,
      });

      await expect(smallHandler.handleRequest(body, headers)).rejects.toThrow('too large');
    });

    it('handles Buffer body', async () => {
      const onTest = vi.fn();
      handler.on('test', onTest);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      await handler.handleRequest(Buffer.from(body), headers);
      expect(onTest).toHaveBeenCalled();
    });

    it('handles Uint8Array body', async () => {
      const onTest = vi.fn();
      handler.on('test', onTest);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      await handler.handleRequest(new TextEncoder().encode(body), headers);
      expect(onTest).toHaveBeenCalled();
    });
  });

  describe('constructEvent', () => {
    it('verifies and returns event without dispatching', async () => {
      const onTest = vi.fn();
      handler.on('test', onTest);

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: { key: 'value' },
        created_at: 123,
      });

      const event = await handler.constructEvent(
        body,
        headers['x-webhook-signature'],
        headers['x-webhook-timestamp']
      );

      expect(event.id).toBe('evt_123');
      expect(event.type).toBe('test');
      expect(event.data).toEqual({ key: 'value' });
      expect(onTest).not.toHaveBeenCalled();
    });
  });

  describe('expressMiddleware', () => {
    it('returns middleware function', () => {
      const middleware = handler.expressMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('calls sendStatus(200) on success', async () => {
      const middleware = handler.expressMiddleware();

      const { body, headers } = await createSignedRequest({
        id: 'evt_123',
        type: 'test',
        data: {},
        created_at: 123,
      });

      const req = { body, headers };
      const res = {
        sendStatus: vi.fn(),
        status: vi.fn(() => ({ send: vi.fn() })),
      };
      const next = vi.fn();

      await middleware(req, res as any, next);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it('returns 401 for signature errors', async () => {
      const middleware = handler.expressMiddleware();

      const req = {
        body: '{}',
        headers: {
          'x-webhook-signature': 'invalid',
          'x-webhook-timestamp': '123',
        },
      };
      const send = vi.fn();
      const res = {
        sendStatus: vi.fn(),
        status: vi.fn(() => ({ send })),
      };
      const next = vi.fn();

      await middleware(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
