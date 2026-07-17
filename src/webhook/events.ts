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
  CustomerDeleted = 'customer.deleted',
  CustomerKybLinkCreated = 'customer.kyb_link.created',
  CustomerKybLinkUpdated = 'customer.kyb_link.updated',
  CustomerKybStatusCreated = 'customer.kyb_status.created',
  CustomerKybStatusUpdated = 'customer.kyb_status.updated',
  CustomerKybApplicationSubmitted = 'customer.kyb_application.submitted',
  /**
   * Emitted when a customer's standing for a capability (rail) changes. The
   * payload is {@link CustomerCapabilityStatusUpdatedData}.
   */
  CustomerCapabilityStatusUpdated = 'customer.capability_status.updated',

  // ─────────────────────────────────────────────────────────────────────────────
  // Fee Payout Destination events
  // ─────────────────────────────────────────────────────────────────────────────
  /** Payload is {@link FeePayoutDestinationUpdatedData}. */
  FeePayoutDestinationUpdated = 'fee_payout_destination.updated',
  /** Payload is an empty object. */
  FeePayoutDestinationDeleted = 'fee_payout_destination.deleted',

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
  // Scheduled Payment events
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Emitted when a scheduled payment flips to the failed terminal state (the
   * async agentic-payments actor's one silent state change). Its payload is
   * {@link ScheduledPaymentFailedData}.
   */
  ScheduledPaymentFailed = 'scheduled_payment.failed',

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
 * Event payload container. `object` holds the resource the event is about;
 * `previous_attributes`, when present, holds the prior values of the fields
 * that changed on an update event.
 */
export interface WebhookEventData<T = unknown> {
  /** The resource the event is about */
  object: T;
  /** Prior values of the fields that changed (update events only) */
  previous_attributes?: Record<string, unknown>;
}

/**
 * Request context that produced the event, when known.
 */
export interface WebhookEventRequest {
  id?: string;
  idempotency_key?: string;
}

/**
 * Webhook event structure.
 *
 * Mirrors the platform's public event envelope: the resource the event is
 * about lives under `data.object`, and `created` is the emission time in unix
 * seconds. Earlier SDK versions typed the payload flat as `data`, which never
 * matched what the platform actually sends.
 */
export interface WebhookEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: string;
  /**
   * Unix timestamp (seconds) when the event was created.
   *
   * The wire field is `created`, matching the OpenAPI event-stream examples
   * and the platform event builders. Earlier SDK versions exposed this as
   * `created_at`, which was always `undefined` at runtime.
   */
  created: number;
  /** Envelope version (e.g. '1.0.0') */
  api_version?: string;
  /** Event data payload */
  data: WebhookEventData<T>;
  /** Free-form metadata attached to the event, when present */
  metadata?: Record<string, unknown>;
  /** Request context that produced the event, when known */
  request?: WebhookEventRequest;
}

// ---------------------------------------------------------------------------
// Event Data Types
// ---------------------------------------------------------------------------

/**
 * KYB Link event data.
 */
export interface KybLinkData {
  customer_id: string;
  /** e.g. 'onboarding' */
  link_type: string;
  url: string;
  status: string;
  /** Unix seconds; omitted when the link does not expire */
  expires_at?: number;
}

/**
 * KYB Application Submitted event data.
 */
export interface KybApplicationSubmittedData {
  customer_id: string;
  application_id: string;
  application_type: string;
}

/**
 * Customer Deleted event data.
 */
export interface CustomerDeletedData {
  customer_id: string;
}

/**
 * A single outstanding capability requirement, keyed by an opaque join key
 * (a terms id or a document type) — never a partner identifier.
 */
export interface CapabilityRequirement {
  /** 'terms_acceptance' or 'document' */
  type: string;
  /** Opaque join key: a terms id (terms_acceptance) or a document type (document) */
  key: string;
  title: string;
  /** 'required' blocks submission/unlock; 'requested' pre-empts an RFI, not blocking */
  severity: string;
  version?: string;
  url?: string;
}

/**
 * Customer Capability Status Updated event data.
 *
 * Emitted when a customer's standing for a capability (rail) changes; carries
 * the capability, the new status, and the outstanding requirements.
 */
export interface CustomerCapabilityStatusUpdatedData {
  customer_id: string;
  capability: string;
  /** e.g. 'available' | 'enabling' | 'action_required' */
  status: string;
  requirements: CapabilityRequirement[];
}

/**
 * Fee Payout Destination Updated event data.
 */
export interface FeePayoutDestinationUpdatedData {
  /** The destination kind — 'usdc_wallet' (developer-fee payouts are crypto-only) */
  type: string;
}

/**
 * Event payload for {@link WebhookEventType.ScheduledPaymentFailed}
 * ('scheduled_payment.failed'), emitted when a scheduled payment flips to the
 * failed terminal state.
 *
 * A successful scheduled fire already surfaces as wallet.transaction.created
 * through the shared money path; failure is the actionable case (re-approve an
 * expired mandate, fund the wallet, fix a destination), and `failure_reason`
 * carries the humanized verdict while `failure_code` is the stable machine
 * code.
 *
 * `payment_agent_id`, `recipient_id`, and `destination_id` are omitted for
 * schedules that have no such linkage (a signer-native schedule, or one paying
 * a bare address); `address` is always the crypto address the row pays.
 */
export interface ScheduledPaymentFailedData {
  scheduled_payment_id: string;
  signer_id: string;
  wallet_id: string;
  address: string;
  amount: string;
  asset: string;
  network_id: string;
  scheduled_at: number;
  failure_code: string;
  failure_reason: string;
  payment_agent_id?: string;
  recipient_id?: string;
  destination_id?: string;
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

    // An absent data / data.object yields an empty object rather than
    // forcing every consumer to null-check the envelope.
    if (event.data === undefined || event.data === null) {
      event.data = { object: {} as T };
    } else if (event.data.object === undefined || event.data.object === null) {
      event.data.object = {} as T;
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
