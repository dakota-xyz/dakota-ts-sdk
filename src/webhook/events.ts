/**
 * Webhook event types and parsing.
 */

/**
 * Known webhook event types.
 */
export enum WebhookEventType {
  // Customer events
  CustomerCreated = 'customer.created',
  CustomerUpdated = 'customer.updated',
  CustomerKybStatusChanged = 'customer.kyb_status_changed',
  CustomerKybLinkCreated = 'customer.kyb_link.created',
  CustomerKybLinkUpdated = 'customer.kyb_link.updated',
  CustomerKybStatusCreated = 'customer.kyb_status.created',
  CustomerKybStatusUpdated = 'customer.kyb_status.updated',
  CustomerKybApplicationSubmitted = 'customer.kyb_application.submitted',

  // Recipient events
  RecipientCreated = 'recipient.created',
  RecipientUpdated = 'recipient.updated',

  // Destination events
  DestinationCreated = 'destination.created',

  // Account events
  AccountCreated = 'account.created',
  AccountUpdated = 'account.updated',

  // Auto Account events
  AutoAccountCreated = 'auto_account.created',
  AutoAccountUpdated = 'auto_account.updated',
  AutoAccountDeleted = 'auto_account.deleted',

  // Transaction events
  TransactionCreated = 'transaction.created',
  TransactionUpdated = 'transaction.updated',
  TransactionCompleted = 'transaction.completed',
  TransactionFailed = 'transaction.failed',
  TransactionCancelled = 'transaction.cancelled',

  // One-off transaction events
  OneOffTransactionCreated = 'one_off_transaction.created',
  OneOffTransactionUpdated = 'one_off_transaction.updated',

  // Auto transaction events
  AutoTransactionCreated = 'auto_transaction.created',
  AutoTransactionUpdated = 'auto_transaction.updated',

  // Wallet events
  WalletCreated = 'wallet.created',
  WalletTransactionCreated = 'wallet.transaction.created',
  WalletTransactionUpdated = 'wallet.transaction.updated',

  // Application events
  ApplicationCreated = 'application.created',
  ApplicationUpdated = 'application.updated',
  ApplicationSubmitted = 'application.submitted',
  ApplicationApproved = 'application.approved',
  ApplicationRejected = 'application.rejected',
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
