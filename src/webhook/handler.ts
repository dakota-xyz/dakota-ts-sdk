/**
 * Webhook handler for processing incoming webhooks.
 */

import {
  SIGNATURE_HEADER,
  SIGNATURES_HEADER,
  TIMESTAMP_HEADER,
  DEFAULT_TIMESTAMP_TOLERANCE,
  SignatureVerificationError,
  parsePublicKey,
  parsePublicKeyList,
  keyId,
  toHex,
  trustedKeys,
  normalizeSignatureHeaders,
  verifyWithTrustedKeys,
  validateTimestamp,
  type TrustedKeys,
  type WebhookSignatureHeaders,
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
export interface WebhookHandlerConfig extends WebhookHandlerOptions {
  /**
   * Hex-encoded Ed25519 public key for signature verification (one key).
   *
   * Kept for existing integrations: prefer `publicKeys`
   * ({@link MultiKeyWebhookHandlerConfig}), which lets Dakota rotate its
   * signing key without breaking you. A malformed `publicKey` does not throw
   * here; every request fails verification instead, as in earlier versions.
   */
  publicKey: string;
  /**
   * See {@link MultiKeyWebhookHandlerConfig.publicKeys}. When it has at least
   * one key, `publicKey` is ignored.
   */
  publicKeys?: string | readonly string[];
}

/**
 * Webhook handler configuration with several trusted keys.
 */
export interface MultiKeyWebhookHandlerConfig extends WebhookHandlerOptions {
  /**
   * Trusted hex-encoded Ed25519 public keys: an array, or a comma-separated
   * list such as `process.env.DAKOTA_WEBHOOK_PUBLIC_KEYS`. A delivery is
   * accepted if any of them signed it. During a key rotation, list the
   * current and the new key; remove a key once Dakota retires it.
   *
   * Validated here: a malformed key throws `SignatureVerificationError`
   * (naming its position, never its value).
   */
  publicKeys: string | readonly string[];
  /**
   * Ignored when `publicKeys` has at least one key, so removing a retired key
   * from `publicKeys` always stops trusting it. If it is set and not listed
   * in `publicKeys` (or malformed), the handler warns once, naming at most
   * its key id. Used only when `publicKeys` is empty, for example an unset
   * environment variable.
   */
  publicKey?: string;
}

/**
 * Logger the handler warns through about its configuration. Messages never
 * contain a key value.
 */
export interface WebhookHandlerLogger {
  warn(message: string): void;
}

/**
 * Webhook handler options other than the trusted keys.
 */
export interface WebhookHandlerOptions {
  /** Timestamp tolerance in seconds (default: 300) */
  timestampTolerance?: number;
  /** Maximum payload size in bytes (default: 65536) */
  maxPayloadSize?: number;
  /** Idempotency store for deduplication (default: in-memory) */
  idempotencyStore?: IdempotencyStore | false;
  /** Where configuration warnings go (default: `console`) */
  logger?: WebhookHandlerLogger;
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
 * // Comma-separated hex keys; list two while Dakota rotates its signing key.
 * const handler = new WebhookHandler({
 *   publicKeys: process.env.DAKOTA_WEBHOOK_PUBLIC_KEYS!,
 * });
 *
 * // Register event handlers. The resource lives under event.data.object.
 * handler.on(WebhookEventType.CustomerCreated, async (event) => {
 *   console.log('Customer created:', event.data.object);
 * });
 *
 * handler.on('transaction.*', async (event) => {
 *   console.log('Transaction event:', event.type, event.data.object);
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
  private readonly trusted: TrustedKeys;
  /** Why the legacy `publicKey` was unusable, when it was the only key given. */
  private readonly keyError: SignatureVerificationError | null;
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
  constructor(config: WebhookHandlerConfig | MultiKeyWebhookHandlerConfig) {
    const logger = config.logger ?? console;
    const hasList = config.publicKeys !== undefined && config.publicKeys !== null;
    if (!config.publicKey && !hasList) {
      throw new Error('Public key is required');
    }

    // publicKeys is new: validate it now and throw on a malformed key.
    let keys = hasList ? parsePublicKeyList([config.publicKeys]) : [];
    let keyError: SignatureVerificationError | null = null;

    if (keys.length > 0) {
      // publicKeys decides what is trusted. A publicKey next to it is never
      // added, so removing a retired key from publicKeys always stops
      // trusting it.
      if (config.publicKey) {
        this.warnIgnoredPublicKey(config.publicKey, keys, logger);
      }
    } else if (config.publicKey) {
      // publicKey alone (or next to an empty publicKeys, such as an unset
      // environment variable) keeps its old contract: a malformed value never
      // throws here, and every request fails verification instead.
      try {
        keys = [parsePublicKey(config.publicKey)];
      } catch (error) {
        keyError =
          error instanceof SignatureVerificationError
            ? error
            : new SignatureVerificationError('Invalid public key');
      }
    } else {
      throw new SignatureVerificationError('At least one webhook public key is required');
    }

    this.trusted = trustedKeys(keys);
    this.keyError = keyError;
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
   * Warn, once, that `publicKey` is ignored because `publicKeys` is set,
   * unless it is also listed there. Never logs a key value: a key id at most.
   */
  private warnIgnoredPublicKey(
    publicKey: string,
    listed: readonly Uint8Array[],
    logger: WebhookHandlerLogger
  ): void {
    let legacy: Uint8Array;
    try {
      legacy = parsePublicKey(publicKey);
    } catch (error) {
      const reason =
        error instanceof SignatureVerificationError ? error.message : 'Invalid public key';
      logger.warn(
        `Dakota webhook handler: ignoring the publicKey option (${reason}); ` +
          `verifying with the ${listed.length} key(s) in publicKeys`
      );
      return;
    }
    const legacyHex = toHex(legacy);
    if (!listed.some((key) => toHex(key) === legacyHex)) {
      logger.warn(
        `Dakota webhook handler: ignoring the publicKey option (key id ${keyId(legacy)}) ` +
          'because publicKeys is set; add it to publicKeys if you still trust it'
      );
    }
  }

  /**
   * Ids of the trusted keys (the first 8 hex characters of each), in the order
   * they are checked for the legacy header. Safe to log, for example at
   * startup to confirm which keys are configured.
   */
  keyIds(): string[] {
    return this.trusted.keys.map((key) => keyId(key));
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

    // Extract headers (case-insensitive). A list header a proxy split over
    // several values is joined back with ",".
    const { signatures, signature, timestamp } = normalizeSignatureHeaders({
      signatures: this.getRawHeader(headers, SIGNATURES_HEADER),
      signature: this.getRawHeader(headers, SIGNATURE_HEADER),
      timestamp: this.getRawHeader(headers, TIMESTAMP_HEADER),
    });

    if (signatures === undefined && signature === undefined) {
      throw new SignatureVerificationError(
        `Missing ${SIGNATURES_HEADER} and ${SIGNATURE_HEADER} headers`
      );
    }
    if (!timestamp) {
      throw new SignatureVerificationError(`Missing ${TIMESTAMP_HEADER} header`);
    }

    // Verify signature
    await this.verify(payload, { timestamp, signatures, signature });

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
   * @param signature - X-Webhook-Signature header value (used only when
   *   `signatures` is missing or blank)
   * @param timestamp - X-Webhook-Timestamp header value
   * @param signatures - X-Dakota-Webhook-Signatures header value (preferred)
   * @returns Parsed and verified event
   */
  async constructEvent<T = unknown>(
    payload: string | Uint8Array,
    signature: string,
    timestamp: string,
    signatures?: string
  ): Promise<WebhookEvent<T>> {
    await this.verify(payload, { timestamp, signatures, signature });
    return parseEvent<T>(payload);
  }

  /**
   * Verify against the trusted keys. A malformed legacy `publicKey` fails
   * here, after the timestamp check, exactly where it used to.
   */
  private async verify(
    payload: string | Uint8Array,
    headers: WebhookSignatureHeaders
  ): Promise<void> {
    if (this.keyError) {
      validateTimestamp(
        normalizeSignatureHeaders(headers).timestamp as string,
        this.timestampTolerance
      );
      throw new SignatureVerificationError(this.keyError.message);
    }
    await verifyWithTrustedKeys(payload, headers, this.trusted, this.timestampTolerance);
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
    res: {
      status: (code: number) => { send: (body: string) => void };
      sendStatus: (code: number) => void;
    },
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
   * Get a raw header value (exact name, or its lowercase form as Node gives).
   */
  private getRawHeader(headers: WebhookHeaders, name: string): string | string[] | undefined {
    return headers[name] ?? headers[name.toLowerCase()];
  }
}
