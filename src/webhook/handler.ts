/**
 * Webhook handler for processing incoming webhooks.
 */

import {
  verifySignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  DEFAULT_TIMESTAMP_TOLERANCE,
  SignatureVerificationError,
} from './signature.js';
import { parseEvent, WebhookEvent, matchesEventType } from './events.js';
import { IdempotencyStore, MemoryIdempotencyStore } from './idempotency.js';

/** Default maximum payload size (64 KB) */
const DEFAULT_MAX_PAYLOAD_SIZE = 64 * 1024;

/**
 * Webhook event handler function.
 */
export type WebhookEventHandler<T = unknown> = (event: WebhookEvent<T>) => Promise<void> | void;

/**
 * Webhook handler configuration.
 */
export interface WebhookHandlerConfig {
  /** Hex-encoded Ed25519 public key for signature verification */
  publicKey: string;
  /** Timestamp tolerance in seconds (default: 300) */
  timestampTolerance?: number;
  /** Maximum payload size in bytes (default: 65536) */
  maxPayloadSize?: number;
  /** Idempotency store for deduplication (default: in-memory) */
  idempotencyStore?: IdempotencyStore | false;
}

/**
 * Headers object type (works with various HTTP frameworks).
 */
export interface WebhookHeaders {
  [key: string]: string | string[] | undefined;
}

/**
 * Webhook handler for verifying and processing incoming webhooks.
 *
 * @example
 * ```typescript
 * import { WebhookHandler, WebhookEventType } from 'dakota-ts-sdk/webhook';
 *
 * const handler = new WebhookHandler({
 *   publicKey: process.env.WEBHOOK_PUBLIC_KEY!,
 * });
 *
 * // Register event handlers
 * handler.on(WebhookEventType.CustomerCreated, async (event) => {
 *   console.log('Customer created:', event.data);
 * });
 *
 * handler.on('transaction.*', async (event) => {
 *   console.log('Transaction event:', event.type, event.data);
 * });
 *
 * handler.onDefault(async (event) => {
 *   console.log('Unhandled event:', event.type);
 * });
 *
 * // In your HTTP handler
 * app.post('/webhooks/dakota', async (req, res) => {
 *   try {
 *     await handler.handleRequest(req.body, req.headers);
 *     res.status(200).send('OK');
 *   } catch (error) {
 *     console.error('Webhook error:', error);
 *     res.status(400).send(error.message);
 *   }
 * });
 * ```
 */
export class WebhookHandler {
  private readonly publicKey: string;
  private readonly timestampTolerance: number;
  private readonly maxPayloadSize: number;
  private readonly idempotencyStore: IdempotencyStore | null;
  private readonly handlers: Map<string, WebhookEventHandler[]> = new Map();
  private defaultHandler: WebhookEventHandler | null = null;

  /**
   * Create a new webhook handler.
   *
   * @param config - Handler configuration
   */
  constructor(config: WebhookHandlerConfig) {
    if (!config.publicKey) {
      throw new Error('Public key is required');
    }

    this.publicKey = config.publicKey;
    this.timestampTolerance = config.timestampTolerance ?? DEFAULT_TIMESTAMP_TOLERANCE;
    this.maxPayloadSize = config.maxPayloadSize ?? DEFAULT_MAX_PAYLOAD_SIZE;

    // Set up idempotency store
    if (config.idempotencyStore === false) {
      this.idempotencyStore = null;
    } else if (config.idempotencyStore) {
      this.idempotencyStore = config.idempotencyStore;
    } else {
      this.idempotencyStore = new MemoryIdempotencyStore();
    }
  }

  /**
   * Register a handler for specific event types.
   *
   * Supports wildcards: 'customer.*' matches all customer events.
   *
   * @param eventType - Event type or pattern to handle
   * @param handler - Handler function
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * handler
   *   .on('customer.created', handleCustomerCreated)
   *   .on('transaction.*', handleTransactionEvents)
   *   .on('*', logAllEvents);
   * ```
   */
  on<T = unknown>(eventType: string, handler: WebhookEventHandler<T>): this {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler as WebhookEventHandler);
    this.handlers.set(eventType, handlers);
    return this;
  }

  /**
   * Register a default handler for unmatched events.
   *
   * @param handler - Handler function
   * @returns this for chaining
   */
  onDefault<T = unknown>(handler: WebhookEventHandler<T>): this {
    this.defaultHandler = handler as WebhookEventHandler;
    return this;
  }

  /**
   * Handle an incoming webhook request.
   *
   * @param body - Raw request body (string or Buffer)
   * @param headers - Request headers
   * @throws SignatureVerificationError if signature is invalid
   * @throws Error if payload is invalid or too large
   *
   * @example
   * ```typescript
   * // Express with raw body parser
   * app.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
   *   try {
   *     await handler.handleRequest(req.body, req.headers);
   *     res.sendStatus(200);
   *   } catch (error) {
   *     res.status(400).send(error.message);
   *   }
   * });
   * ```
   */
  async handleRequest(
    body: string | Uint8Array | Buffer,
    headers: WebhookHeaders
  ): Promise<WebhookEvent> {
    // Convert body to Uint8Array
    let payload: Uint8Array;
    if (typeof body === 'string') {
      payload = new TextEncoder().encode(body);
    } else if (body instanceof Uint8Array) {
      payload = body;
    } else if (Buffer.isBuffer(body)) {
      payload = new Uint8Array(body);
    } else {
      throw new Error('Invalid body: must be string, Uint8Array, or Buffer');
    }

    // Check payload size
    if (payload.length > this.maxPayloadSize) {
      throw new Error(`Payload too large: ${payload.length} bytes (max: ${this.maxPayloadSize})`);
    }

    // Extract headers (case-insensitive)
    const signature = this.getHeader(headers, SIGNATURE_HEADER);
    const timestamp = this.getHeader(headers, TIMESTAMP_HEADER);

    if (!signature) {
      throw new SignatureVerificationError(`Missing ${SIGNATURE_HEADER} header`);
    }
    if (!timestamp) {
      throw new SignatureVerificationError(`Missing ${TIMESTAMP_HEADER} header`);
    }

    // Verify signature
    await verifySignature(payload, signature, timestamp, this.publicKey, this.timestampTolerance);

    // Parse event
    const event = parseEvent(payload);

    // Check idempotency
    if (this.idempotencyStore) {
      if (await this.idempotencyStore.has(event.id)) {
        // Already processed, return early
        return event;
      }
    }

    // Dispatch to handlers
    await this.dispatch(event);

    // Mark as processed
    if (this.idempotencyStore) {
      await this.idempotencyStore.add(event.id);
    }

    return event;
  }

  /**
   * Construct a webhook event from payload and verify signature.
   *
   * Use this when you need to verify and parse without dispatching.
   *
   * @param payload - Raw request body
   * @param signature - X-Webhook-Signature header value
   * @param timestamp - X-Webhook-Timestamp header value
   * @returns Parsed and verified event
   */
  async constructEvent<T = unknown>(
    payload: string | Uint8Array,
    signature: string,
    timestamp: string
  ): Promise<WebhookEvent<T>> {
    await verifySignature(payload, signature, timestamp, this.publicKey, this.timestampTolerance);
    return parseEvent<T>(payload);
  }

  /**
   * Create Express-compatible middleware.
   *
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * import express from 'express';
   *
   * const app = express();
   *
   * app.post(
   *   '/webhooks/dakota',
   *   express.raw({ type: 'application/json' }),
   *   handler.expressMiddleware()
   * );
   * ```
   */
  expressMiddleware(): (
    req: { body: Buffer | string; headers: WebhookHeaders },
    res: { status: (code: number) => { send: (body: string) => void }; sendStatus: (code: number) => void },
    next: (error?: Error) => void
  ) => Promise<void> {
    return async (req, res, next) => {
      try {
        await this.handleRequest(req.body, req.headers);
        res.sendStatus(200);
      } catch (error) {
        if (error instanceof SignatureVerificationError) {
          res.status(401).send(error.message);
        } else if (error instanceof Error) {
          res.status(400).send(error.message);
        } else {
          next(error as Error);
        }
      }
    };
  }

  /**
   * Dispatch an event to registered handlers.
   */
  private async dispatch(event: WebhookEvent): Promise<void> {
    let handled = false;

    // Find matching handlers
    for (const [pattern, handlers] of this.handlers) {
      if (matchesEventType(event.type, pattern)) {
        for (const handler of handlers) {
          await handler(event);
          handled = true;
        }
      }
    }

    // Call default handler if no specific handlers matched
    if (!handled && this.defaultHandler) {
      await this.defaultHandler(event);
    }
  }

  /**
   * Get a header value (case-insensitive).
   */
  private getHeader(headers: WebhookHeaders, name: string): string | undefined {
    // Try exact match first
    const value = headers[name] ?? headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }
}
