/**
 * HTTP transport layer with retry, authentication, and idempotency.
 */

import { ResolvedConfig, AuthMode } from './config.js';
import { APIError, TransportError } from './errors.js';

/** Status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** HTTP methods that are safe to retry without idempotency key */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);

/**
 * Request options for the transport layer.
 */
export interface TransportRequestOptions {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/**
 * HTTP transport with retry, auth, and idempotency support.
 */
export class Transport {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Make an HTTP request with automatic retry and error handling.
   */
  async request<T>(options: TransportRequestOptions): Promise<T> {
    const { method, path, body, query, headers, idempotencyKey, signal } = options;

    // Build URL with query parameters
    const url = this.buildURL(path, query);

    // Build headers
    const requestHeaders = this.buildHeaders(method, path, headers, idempotencyKey);

    // Build request body
    const requestBody = body !== undefined ? JSON.stringify(body) : undefined;

    // Execute with retry
    return this.executeWithRetry<T>(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal,
    });
  }

  /**
   * Build the full URL with query parameters.
   */
  private buildURL(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path, this.config.baseURL);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Build request headers with authentication.
   */
  private buildHeaders(
    method: string,
    path: string,
    customHeaders?: Record<string, string>,
    idempotencyKey?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'dakota-ts-sdk/1.0.0',
      ...customHeaders,
    };

    // Add authentication header
    this.addAuthHeader(headers, path);

    // Add idempotency key for POST requests
    if (method === 'POST') {
      const key =
        idempotencyKey ??
        (this.config.automaticIdempotency ? this.config.idempotencyKeyGenerator() : undefined);
      if (key) {
        headers['x-idempotency-key'] = key;
      }
    }

    return headers;
  }

  /**
   * Add authentication header based on auth mode and path.
   */
  private addAuthHeader(headers: Record<string, string>, path: string): void {
    // Don't override existing auth headers
    if (headers['x-api-key'] || headers['x-application-token']) {
      return;
    }

    const { authMode, apiKey, applicationToken } = this.config;

    switch (authMode) {
      case AuthMode.APIKey:
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }
        break;

      case AuthMode.ApplicationToken:
        if (applicationToken) {
          headers['x-application-token'] = applicationToken;
        }
        break;

      case AuthMode.Auto:
      default:
        // For /applications routes, prefer application token
        if (path.startsWith('/applications') && applicationToken) {
          headers['x-application-token'] = applicationToken;
        } else if (apiKey) {
          headers['x-api-key'] = apiKey;
        } else if (applicationToken) {
          headers['x-application-token'] = applicationToken;
        }
        break;
    }
  }

  /**
   * Execute request with exponential backoff retry.
   */
  private async executeWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    const { maxAttempts, initialBackoffMs, maxBackoffMs } = this.config.retryPolicy;
    const method = init.method ?? 'GET';

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        // Merge signals if provided
        const signal = init.signal
          ? this.mergeAbortSignals(init.signal, controller.signal)
          : controller.signal;

        this.logRequest(method, url, attempt);

        const response = await this.config.fetch(url, {
          ...init,
          signal,
        });

        clearTimeout(timeoutId);

        this.logResponse(method, url, response.status, attempt);

        // Check for successful response
        if (response.ok) {
          // Handle 204 No Content
          if (response.status === 204) {
            return undefined as T;
          }
          return (await response.json()) as T;
        }

        // Convert to API error
        const apiError = await APIError.fromResponse(response);

        // Check if we should retry
        if (this.shouldRetry(response.status, method, init, attempt)) {
          lastError = apiError;
          const delay = this.calculateBackoff(attempt, response, initialBackoffMs, maxBackoffMs);
          this.config.logger.warn(
            `Request failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
          );
          await this.sleep(delay);
          continue;
        }

        throw apiError;
      } catch (error) {
        if (error instanceof APIError) {
          throw error;
        }

        // Handle abort/timeout
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TransportError('Request timed out', error);
        } else if (error instanceof Error) {
          lastError = new TransportError('Network error', error);
        } else {
          lastError = new TransportError('Unknown error');
        }

        // Retry on network errors for safe methods
        if (this.shouldRetryNetworkError(method, init, attempt)) {
          const delay = this.calculateBackoff(attempt, null, initialBackoffMs, maxBackoffMs);
          this.config.logger.warn(
            `Network error, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
          );
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    // All retries exhausted
    throw lastError ?? new TransportError('Request failed after all retries');
  }

  /**
   * Determine if a request should be retried based on status code.
   */
  private shouldRetry(status: number, method: string, init: RequestInit, attempt: number): boolean {
    if (attempt >= this.config.retryPolicy.maxAttempts) {
      return false;
    }

    if (!RETRYABLE_STATUS_CODES.has(status)) {
      return false;
    }

    // Safe methods can always be retried
    if (SAFE_METHODS.has(method)) {
      return true;
    }

    // POST can be retried if we have an idempotency key
    if (method === 'POST' && init.headers) {
      const headers = init.headers as Record<string, string>;
      return !!headers['x-idempotency-key'];
    }

    return false;
  }

  /**
   * Determine if a network error should be retried.
   */
  private shouldRetryNetworkError(method: string, init: RequestInit, attempt: number): boolean {
    if (attempt >= this.config.retryPolicy.maxAttempts) {
      return false;
    }

    // Safe methods can always be retried
    if (SAFE_METHODS.has(method)) {
      return true;
    }

    // POST can be retried if we have an idempotency key
    if (method === 'POST' && init.headers) {
      const headers = init.headers as Record<string, string>;
      return !!headers['x-idempotency-key'];
    }

    return false;
  }

  /**
   * Calculate backoff delay with jitter.
   */
  private calculateBackoff(
    attempt: number,
    response: Response | null,
    initialBackoffMs: number,
    maxBackoffMs: number
  ): number {
    // Check for Retry-After header
    if (response) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          return seconds * 1000;
        }
        // Try parsing as HTTP date
        const date = Date.parse(retryAfter);
        if (!isNaN(date)) {
          return Math.max(0, date - Date.now());
        }
      }
    }

    // Exponential backoff with jitter (±20%)
    const exponentialDelay = initialBackoffMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxBackoffMs);
    const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(cappedDelay + jitter);
  }

  /**
   * Merge multiple abort signals.
   */
  private mergeAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    const controller = new AbortController();

    const abort = () => controller.abort();

    signal1.addEventListener('abort', abort);
    signal2.addEventListener('abort', abort);

    if (signal1.aborted || signal2.aborted) {
      controller.abort();
    }

    return controller.signal;
  }

  /**
   * Sleep for the specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log outgoing request.
   */
  private logRequest(method: string, url: string, attempt: number): void {
    this.config.logger.debug(
      `Request: ${method} ${url}${attempt > 1 ? ` (attempt ${attempt})` : ''}`
    );
  }

  /**
   * Log response.
   */
  private logResponse(method: string, url: string, status: number, attempt: number): void {
    this.config.logger.debug(
      `Response: ${method} ${url} -> ${status}${attempt > 1 ? ` (attempt ${attempt})` : ''}`
    );
  }
}
