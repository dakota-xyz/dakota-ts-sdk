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
  /**
   * A plain-language rendition of the problem, written for the END CUSTOMER,
   * when one exists for this error.
   *
   * `message` names request fields and actions so a machine caller can
   * self-correct. This says the same thing without API vocabulary. Show it
   * when relaying an error into a human surface (chat, email, UI), and fall
   * back to `message` when it is null.
   */
  readonly userMessage: string | null;
  /**
   * A link the customer can follow to CLEAR this error, present only on
   * problems with a concrete self-service remedy.
   *
   * Today `terms-not-accepted` returns one, pointing at the hosted flow where
   * the outstanding agreement can be signed. It is token-gated and usable
   * as-is — send the customer to it rather than parsing one out of the
   * message.
   */
  readonly resolutionUrl: string | null;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: {
      details?: Record<string, unknown> | null;
      requestId?: string | null;
      rawBody?: string | null;
      userMessage?: string | null;
      resolutionUrl?: string | null;
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
    this.userMessage = options?.userMessage ?? null;
    this.resolutionUrl = options?.resolutionUrl ?? null;

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
    let userMessage: string | null = null;
    let resolutionUrl: string | null = null;

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

      // RFC 9457 extensions. `message` stays the machine-facing rendition;
      // these two are what a human surface should show instead.
      if (typeof parsed.user_message === 'string') {
        userMessage = parsed.user_message;
      }
      if (typeof parsed.resolution_url === 'string') {
        resolutionUrl = parsed.resolution_url;
      }
    } catch {
      // Failed to parse JSON, use defaults
    }

    const Typed = GOVERNANCE_ERRORS[code.replace(/-/g, '_')];
    if (Typed) {
      code = code.replace(/-/g, '_');
    }
    return new (Typed ?? APIError)(response.status, code, message, {
      details,
      requestId,
      rawBody,
      userMessage,
      resolutionUrl,
    });
  }

  override toString(): string {
    if (this.code) {
      return `APIError [${this.statusCode} ${this.code}]: ${this.message}`;
    }
    return `APIError [${this.statusCode}]: ${this.message}`;
  }
}

// ============================================================================
// Signer-group governance refusals
// ============================================================================
//
// Each is an APIError (so existing `instanceof APIError` handling still
// catches it) with a class of its own, so a caller can react to the one
// governance refusal it can act on without matching strings.

type APIErrorOptions = ConstructorParameters<typeof APIError>[3];

/**
 * `endorsement_required` (400): the signer-group change needs signatures from
 * the group's governing members — the client has governance enforcement on,
 * or the group has governance settings. Send it signed: use
 * `signerGroups.addSignerSigned` / `removeSignersSigned` /
 * `updateGovernanceSigned`, or the `prepare*` + `submitSignedChange` pair.
 */
export class EndorsementRequiredError extends APIError {
  constructor(statusCode: number, code: string, message: string, options?: APIErrorOptions) {
    super(statusCode, code, message, options);
    this.name = 'EndorsementRequiredError';
  }
}

/**
 * `insufficient_endorsements` (403): the signatures do not meet the group's
 * governance quorum (`effective_governance_threshold` distinct governing
 * members). Collect more signatures over the SAME intent and resend.
 */
export class InsufficientEndorsementsError extends APIError {
  /** Signatures the platform counted, when it said so. */
  readonly have: number | null;
  /** Signatures the quorum needs, when it said so. */
  readonly need: number | null;

  constructor(statusCode: number, code: string, message: string, options?: APIErrorOptions) {
    super(statusCode, code, message, options);
    this.name = 'InsufficientEndorsementsError';
    const m = /have (\d+), need (\d+)/.exec(message);
    this.have = m ? Number(m[1]) : null;
    this.need = m ? Number(m[2]) : null;
  }
}

/**
 * `stale_signer_group_version` (409): the group changed after the signatures
 * were made, so they can never verify. Read the group's `version`, build a
 * new intent under a new idempotency key, and sign again (or pass
 * `staleRetries` to the one-call helpers to do that automatically).
 */
export class StaleSignerGroupVersionError extends APIError {
  constructor(statusCode: number, code: string, message: string, options?: APIErrorOptions) {
    super(statusCode, code, message, options);
    this.name = 'StaleSignerGroupVersionError';
  }
}

/**
 * `below_threshold` (422): the removal would leave the group below a
 * threshold it must keep (at least one member, its governance quorum, or a
 * governed group's threshold). Add members first or remove fewer.
 */
export class BelowThresholdError extends APIError {
  constructor(statusCode: number, code: string, message: string, options?: APIErrorOptions) {
    super(statusCode, code, message, options);
    this.name = 'BelowThresholdError';
  }
}

/**
 * `invalid_governing_group`: the group's governing signer group is missing or
 * no longer valid, so no signature can satisfy its governance.
 */
export class InvalidGoverningGroupError extends APIError {
  constructor(statusCode: number, code: string, message: string, options?: APIErrorOptions) {
    super(statusCode, code, message, options);
    this.name = 'InvalidGoverningGroupError';
  }
}

const GOVERNANCE_ERRORS: Record<string, typeof APIError> = {
  endorsement_required: EndorsementRequiredError,
  insufficient_endorsements: InsufficientEndorsementsError,
  stale_signer_group_version: StaleSignerGroupVersionError,
  below_threshold: BelowThresholdError,
  invalid_governing_group: InvalidGoverningGroupError,
};

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
