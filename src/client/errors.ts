/**
 * Error classes for Dakota SDK.
 */

/** Status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Represents a structured Dakota Platform API error response.
 */
export class APIError extends Error {
  /** HTTP status code */
  readonly statusCode: number;
  /** Machine-readable error code */
  readonly code: string;
  /** Additional error details */
  readonly details: Record<string, unknown> | null;
  /** Request ID for support tickets */
  readonly requestId: string | null;
  /** Raw response body */
  readonly rawBody: string | null;
  /** Whether this error is safe to retry */
  readonly retryable: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: {
      details?: Record<string, unknown> | null;
      requestId?: string | null;
      rawBody?: string | null;
    }
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details ?? null;
    this.requestId = options?.requestId ?? null;
    this.rawBody = options?.rawBody ?? null;
    this.retryable = RETRYABLE_STATUS_CODES.has(statusCode);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Create an APIError from an HTTP response.
   */
  static async fromResponse(response: Response): Promise<APIError> {
    const requestId = response.headers.get('x-request-id');
    let rawBody: string | null = null;
    let code = `http_${response.status}`;
    let message = response.statusText || 'Unknown error';
    let details: Record<string, unknown> | null = null;

    try {
      rawBody = await response.text();
      const parsed = JSON.parse(rawBody);

      // Try ProblemDetails format (RFC 7807)
      if (parsed.type && typeof parsed.type === 'string') {
        // Extract code from type URI fragment (e.g., "...#invalid-request")
        const hashIndex = parsed.type.lastIndexOf('#');
        if (hashIndex !== -1) {
          code = parsed.type.substring(hashIndex + 1);
        }
      }

      // Use code if directly provided
      if (parsed.code) {
        code = parsed.code;
      }

      // Build message from title and detail
      if (parsed.title) {
        message = parsed.title;
        if (parsed.detail) {
          message = `${parsed.title}: ${parsed.detail}`;
        }
      } else if (parsed.message) {
        message = parsed.message;
      } else if (parsed.detail) {
        message = parsed.detail;
      }

      // Extract details
      if (parsed.details && typeof parsed.details === 'object') {
        details = parsed.details;
      }
    } catch {
      // Failed to parse JSON, use defaults
    }

    return new APIError(response.status, code, message, {
      details,
      requestId,
      rawBody,
    });
  }

  override toString(): string {
    if (this.code) {
      return `APIError [${this.statusCode} ${this.code}]: ${this.message}`;
    }
    return `APIError [${this.statusCode}]: ${this.message}`;
  }
}

/**
 * Represents a transport-level error (network, timeout, etc.).
 */
export class TransportError extends Error {
  /** The underlying error that caused this transport error */
  readonly cause: Error | undefined;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'TransportError';
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransportError);
    }
  }

  override toString(): string {
    if (this.cause) {
      return `TransportError: ${this.message} (caused by: ${this.cause.message})`;
    }
    return `TransportError: ${this.message}`;
  }
}

/**
 * Represents a configuration error.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationError);
    }
  }
}
