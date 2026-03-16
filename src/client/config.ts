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
  /** Request timeout in milliseconds (default: 15000) */
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
  retryPolicy: RetryPolicy;
  logger: Logger;
  automaticIdempotency: boolean;
  idempotencyKeyGenerator: () => string;
  fetch: typeof fetch;
}

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
  const timeout = config.timeout ?? 15000;
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
    retryPolicy,
    logger: config.logger ?? noopLogger,
    automaticIdempotency: config.automaticIdempotency ?? true,
    idempotencyKeyGenerator: config.idempotencyKeyGenerator ?? generateUUID,
    fetch: config.fetch ?? globalThis.fetch,
  };
}
