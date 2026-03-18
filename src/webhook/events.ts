/**
 * Webhook event types and parsing.
 */

/**
 * Known webhook event types.
 *
 * These match the canonical EventType enum from the Dakota Platform API.
 * Use wildcards with the handler for flexible matching (e.g., 'customer.*').
 */
export enum WebhookEventType {
  // ─────────────────────────────────────────────────────────────────────────────
  // User events
  // ─────────────────────────────────────────────────────────────────────────────
  UserCreated = 'user.created',
  UserUpdated = 'user.updated',
  UserDeleted = 'user.deleted',

  // ─────────────────────────────────────────────────────────────────────────────
  // API Key events
  // ─────────────────────────────────────────────────────────────────────────────
  ApiKeyCreated = 'api_key.created',
  ApiKeyDeleted = 'api_key.deleted',

  // ─────────────────────────────────────────────────────────────────────────────
  // Customer events
  // ─────────────────────────────────────────────────────────────────────────────
  CustomerCreated = 'customer.created',
  CustomerUpdated = 'customer.updated',
  CustomerKybLinkCreated = 'customer.kyb_link.created',
  CustomerKybLinkUpdated = 'customer.kyb_link.updated',
  CustomerKybStatusCreated = 'customer.kyb_status.created',
  CustomerKybStatusUpdated = 'customer.kyb_status.updated',
  CustomerKybApplicationSubmitted = 'customer.kyb_application.submitted',

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto Account events (off-ramp/on-ramp account lifecycle)
  // ─────────────────────────────────────────────────────────────────────────────
  AutoAccountCreated = 'auto_account.created',
  AutoAccountUpdated = 'auto_account.updated',
  AutoAccountDeleted = 'auto_account.deleted',

  // ─────────────────────────────────────────────────────────────────────────────
  // Transaction events
  // ─────────────────────────────────────────────────────────────────────────────
  /** Auto transaction created (from off-ramp/on-ramp accounts) */
  TransactionAutoCreated = 'transaction.auto.created',
  /** Auto transaction updated */
  TransactionAutoUpdated = 'transaction.auto.updated',
  /** One-off transaction created */
  TransactionOneOffCreated = 'transaction.one_off.created',
  /** One-off transaction updated */
  TransactionOneOffUpdated = 'transaction.one_off.updated',

  // ─────────────────────────────────────────────────────────────────────────────
  // Recipient events
  // ─────────────────────────────────────────────────────────────────────────────
  RecipientCreated = 'recipient.created',
  RecipientUpdated = 'recipient.updated',
  RecipientDeleted = 'recipient.deleted',

  // ─────────────────────────────────────────────────────────────────────────────
  // Destination events
  // ─────────────────────────────────────────────────────────────────────────────
  DestinationCreated = 'destination.created',
  DestinationDeleted = 'destination.deleted',

  // ─────────────────────────────────────────────────────────────────────────────
  // Webhook Target events
  // ─────────────────────────────────────────────────────────────────────────────
  TargetCreated = 'target.created',
  TargetUpdated = 'target.updated',
  TargetDeleted = 'target.deleted',

  // ─────────────────────────────────────────────────────────────────────────────
  // Exception events (compliance/operational)
  // ─────────────────────────────────────────────────────────────────────────────
  ExceptionCreated = 'exception.created',
  ExceptionCleared = 'exception.cleared',

  // ─────────────────────────────────────────────────────────────────────────────
  // BVNK Onboarding events (provider-specific)
  // ─────────────────────────────────────────────────────────────────────────────
  BvnkOnboardingCreated = 'bvnk.onboarding.created',
  BvnkOnboardingUpdated = 'bvnk.onboarding.updated',

  // ─────────────────────────────────────────────────────────────────────────────
  // Wallet events
  // ─────────────────────────────────────────────────────────────────────────────
  WalletCreated = 'wallet.created',
  WalletUpdated = 'wallet.updated',
  WalletSignerGroupCreated = 'wallet.signer_group.created',
  WalletSignerGroupUpdated = 'wallet.signer_group.updated',
  WalletPolicyCreated = 'wallet.policy.created',
  WalletPolicyUpdated = 'wallet.policy.updated',
  WalletTransactionCreated = 'wallet.transaction.created',
  WalletTransactionUpdated = 'wallet.transaction.updated',
  WalletDeposit = 'wallet.deposit',

  // ─────────────────────────────────────────────────────────────────────────────
  // Legacy/Deprecated event types (kept for backwards compatibility)
  // These may still be emitted but prefer the canonical types above.
  // ─────────────────────────────────────────────────────────────────────────────
  /** @deprecated Use TransactionAutoCreated or TransactionOneOffCreated */
  TransactionCreated = 'transaction.created',
  /** @deprecated Use TransactionAutoUpdated or TransactionOneOffUpdated */
  TransactionUpdated = 'transaction.updated',
  /** @deprecated Check transaction status in the updated event */
  TransactionCompleted = 'transaction.completed',
  /** @deprecated Check transaction status in the updated event */
  TransactionFailed = 'transaction.failed',
  /** @deprecated Check transaction status in the updated event */
  TransactionCancelled = 'transaction.cancelled',
  /** @deprecated Use AutoAccountCreated */
  AccountCreated = 'account.created',
  /** @deprecated Use AutoAccountUpdated */
  AccountUpdated = 'account.updated',
}

/**
 * Webhook event structure.
 */
export interface WebhookEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event data payload */
  data: T;
  /** Unix timestamp when the event was created */
  created_at: number;
  /** API version */
  api_version?: string;
}

// ---------------------------------------------------------------------------
// Event Data Types
// ---------------------------------------------------------------------------

/**
 * KYB Link event data.
 */
export interface KybLinkData {
  customer_id: string;
  url: string;
  expires_at: number;
}

/**
 * KYB Application Submitted event data.
 */
export interface KybApplicationSubmittedData {
  customer_id: string;
  type: string;
}

/**
 * Parse a webhook event from a JSON payload.
 *
 * @param payload - Raw JSON payload (string or Buffer)
 * @returns Parsed webhook event
 * @throws Error if parsing fails
 */
export function parseEvent<T = unknown>(payload: string | Uint8Array): WebhookEvent<T> {
  const payloadStr = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);

  try {
    const event = JSON.parse(payloadStr) as WebhookEvent<T>;

    // Validate required fields
    if (!event.id || typeof event.id !== 'string') {
      throw new Error('Invalid event: missing or invalid id');
    }
    if (!event.type || typeof event.type !== 'string') {
      throw new Error('Invalid event: missing or invalid type');
    }
    if (event.data === undefined) {
      throw new Error('Invalid event: missing data');
    }

    return event;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid event: malformed JSON');
    }
    throw error;
  }
}

/**
 * Check if an event type matches a pattern.
 *
 * Supports wildcards: 'customer.*' matches 'customer.created', 'customer.updated', etc.
 */
export function matchesEventType(eventType: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }

  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix + '.');
  }

  return eventType === pattern;
}
