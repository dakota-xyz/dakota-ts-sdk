/**
 * Configuration types and validation for Dakota SDK.
 */

import { Environment, getEnvironmentURL } from './environment.js';
import { ConfigurationError } from './errors.js';

/**
 * Authentication mode for API requests.
 */
export enum AuthMode {
  /** Automatically select the best auth method based on the endpoint */
  Auto = 'auto',
  /** Always use x-api-key header */
  APIKey = 'api_key',
  /** Always use X-Application-Token header */
  ApplicationToken = 'application_token',
}

/**
 * Retry policy configuration.
 */
export interface RetryPolicy {
  /** Maximum number of attempts including the initial request (default: 3) */
  maxAttempts: number;
  /** Initial backoff delay in milliseconds (default: 200) */
  initialBackoffMs: number;
  /** Maximum backoff delay in milliseconds (default: 2000) */
  maxBackoffMs: number;
}

/**
 * Logger interface for SDK logging.
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Configuration options for DakotaClient.
 */
export interface DakotaClientConfig {
  /** API key for authentication (required unless applicationToken is provided) */
  apiKey?: string;
  /** Application token for authentication (alternative to apiKey) */
  applicationToken?: string;
  /** Target environment (default: Sandbox) */
  environment?: Environment;
  /** Override the base URL (takes precedence over environment) */
  baseURL?: string;
  /** Authentication mode (default: Auto) */
  authMode?: AuthMode;
  /**
   * Request timeout in milliseconds (default: 15000).
   *
   * Setting this explicitly applies it to EVERY request, including the
   * model-backed agentic endpoints that otherwise get a longer default
   * ({@link AGENTIC_MODEL_TIMEOUT_MS}) — so you keep full control, but a
   * global value tuned for fast reads will also cap agent turns. To keep
   * the long agentic default while tightening everything else, leave this
   * unset and pass `{ timeout }` per request instead.
   *
   * Note this is a per-ATTEMPT deadline: with the default retry policy a
   * timing-out request can be attempted up to `retryPolicy.maxAttempts`
   * times, so worst-case wall clock is roughly `timeout × maxAttempts`.
   */
  timeout?: number;
  /** Retry policy configuration */
  retryPolicy?: Partial<RetryPolicy>;
  /** Logger instance */
  logger?: Logger;
  /** Automatically generate idempotency keys for POST requests (default: true) */
  automaticIdempotency?: boolean;
  /** Custom idempotency key generator */
  idempotencyKeyGenerator?: () => string;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

/**
 * Resolved configuration with all defaults applied.
 */
export interface ResolvedConfig {
  apiKey: string | null;
  applicationToken: string | null;
  baseURL: string;
  authMode: AuthMode;
  timeout: number;
  /**
   * Whether `timeout` came from the caller rather than the default.
   *
   * An explicit timeout is a deliberate choice and wins everywhere. An
   * inherited default does not, so endpoints that know they are slow (the
   * model-backed agentic ones) can raise it without overriding a value the
   * caller actually asked for.
   */
  timeoutWasExplicit: boolean;
  retryPolicy: RetryPolicy;
  logger: Logger;
  automaticIdempotency: boolean;
  idempotencyKeyGenerator: () => string;
  fetch: typeof fetch;
}

/**
 * Default per-request timeout (ms).
 *
 * Sized for ordinary CRUD reads and writes, which answer in well under a
 * second. It is deliberately NOT the deadline for the agentic endpoints
 * that call a model — see {@link AGENTIC_MODEL_TIMEOUT_MS}.
 */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Default per-request timeout (ms) for the agentic endpoints whose work is
 * a sequence of model calls: drafting proposals.
 *
 * A multi-payee drafting turn ("pay these nine vendors every Friday")
 * legitimately runs minutes — it reads payees, checks balances, drafts, and
 * revises, each a separate model round. Under the ordinary 15s deadline
 * those turns abort client-side while the server is still working, which
 * reads as flakiness rather than as a deadline: the simple turns finish in
 * time and the complex ones do not.
 *
 * Applies only when the caller did not set `timeout` on the client (an
 * explicit choice always wins) and can be overridden per request.
 */
export const AGENTIC_MODEL_TIMEOUT_MS = 180_000;

/**
 * Default retry policy.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialBackoffMs: 200,
  maxBackoffMs: 2000,
};

/**
 * No-op logger that discards all messages.
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Console logger for development.
 */
export const consoleLogger: Logger = {
  debug: (msg, ...args) => console.debug(`[Dakota SDK] ${msg}`, ...args),
  info: (msg, ...args) => console.info(`[Dakota SDK] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[Dakota SDK] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[Dakota SDK] ${msg}`, ...args),
};

/**
 * Generate a UUID v4 for idempotency keys.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate and resolve configuration with defaults.
 */
export function resolveConfig(config: DakotaClientConfig): ResolvedConfig {
  const authMode = config.authMode ?? AuthMode.Auto;

  // Validate authentication
  if (authMode === AuthMode.Auto) {
    if (!config.apiKey && !config.applicationToken) {
      throw new ConfigurationError('API key or application token is required');
    }
  } else if (authMode === AuthMode.APIKey) {
    if (!config.apiKey) {
      throw new ConfigurationError('API key is required when using AuthMode.APIKey');
    }
  } else if (authMode === AuthMode.ApplicationToken) {
    if (!config.applicationToken) {
      throw new ConfigurationError(
        'Application token is required when using AuthMode.ApplicationToken'
      );
    }
  }

  // Resolve base URL
  let baseURL: string;
  if (config.baseURL) {
    baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    // Validate URL
    try {
      new URL(baseURL);
    } catch {
      throw new ConfigurationError('Invalid base URL');
    }
  } else {
    const env = config.environment ?? Environment.Sandbox;
    baseURL = getEnvironmentURL(env);
  }

  // Validate timeout
  const timeoutWasExplicit = config.timeout !== undefined;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
  if (timeout <= 0) {
    throw new ConfigurationError('Timeout must be greater than zero');
  }

  // Resolve retry policy
  const retryPolicy: RetryPolicy = {
    maxAttempts: config.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    initialBackoffMs: config.retryPolicy?.initialBackoffMs ?? DEFAULT_RETRY_POLICY.initialBackoffMs,
    maxBackoffMs: config.retryPolicy?.maxBackoffMs ?? DEFAULT_RETRY_POLICY.maxBackoffMs,
  };

  // Validate retry policy
  if (retryPolicy.maxAttempts <= 0) {
    throw new ConfigurationError('Retry max attempts must be greater than zero');
  }
  if (retryPolicy.initialBackoffMs <= 0) {
    throw new ConfigurationError('Retry initial backoff must be greater than zero');
  }
  if (retryPolicy.maxBackoffMs <= 0) {
    throw new ConfigurationError('Retry max backoff must be greater than zero');
  }
  if (retryPolicy.maxBackoffMs < retryPolicy.initialBackoffMs) {
    throw new ConfigurationError('Retry max backoff must be >= initial backoff');
  }

  return {
    apiKey: config.apiKey ?? null,
    applicationToken: config.applicationToken ?? null,
    baseURL,
    authMode,
    timeout,
    timeoutWasExplicit,
    retryPolicy,
    logger: config.logger ?? noopLogger,
    automaticIdempotency: config.automaticIdempotency ?? true,
    idempotencyKeyGenerator: config.idempotencyKeyGenerator ?? generateUUID,
    fetch: config.fetch ?? globalThis.fetch,
  };
}
