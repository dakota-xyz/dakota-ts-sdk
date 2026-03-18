/**
 * SDK-friendly type aliases and helpers.
 *
 * These types provide a cleaner interface over the generated OpenAPI types.
 */

import type { components } from '../generated/api.js';

// ============================================================================
// Core Types
// ============================================================================

/** Unique identifier (KSUID format) */
export type KSUID = components['schemas']['IDResponse']['id'];

/** Network identifier (e.g., 'ethereum-mainnet', 'polygon-mainnet', 'ethereum-sepolia') */
export type NetworkId = components['schemas']['NetworkId'];

/**
 * Payment capability/rail.
 *
 * Currently supported: `'ach'` and `'fedwire'` (wire).
 * SWIFT and SEPA are defined in the API but not yet supported.
 */
export type PaymentCapability = components['schemas']['PaymentCapability'];

/** Blockchain family */
export type Family = components['schemas']['Family'];

/** Address (for businesses and individuals) */
export type Address = components['schemas']['Address'];

/** Person name */
export type PersonName = components['schemas']['PersonName'];

// ============================================================================
// Customer Types
// ============================================================================

/** Customer record */
export type Customer = components['schemas']['Customer'];

/** Customer creation request */
export type CustomerCreateRequest = components['schemas']['CustomerCreateRequest'];

/** Customer creation response */
export type CustomerCreateResponse = components['schemas']['CustomerCreateResponse'];

/** KYB status */
export type KybStatus = Customer['kyb_status'];

// ============================================================================
// Recipient Types
// ============================================================================

/** Recipient response */
export type Recipient = components['schemas']['RecipientResponse'];

/** Recipient creation request */
export type RecipientRequest = components['schemas']['RecipientRequest'];

/** Recipient update request */
export type RecipientUpdateRequest = components['schemas']['RecipientRequest'];

// ============================================================================
// Destination Types
// ============================================================================

/** Destination response union */
export type Destination = components['schemas']['DestinationResponseUnion'];

/** Destination request union */
export type DestinationRequest = components['schemas']['DestinationRequestUnion'];

/** Fiat US destination request */
export type FiatUSDestinationRequest = components['schemas']['FiatUSDestinationRequest'];

/** Crypto destination request */
export type CryptoDestinationRequest = components['schemas']['CryptoDestinationRequest'];

/** Fiat US destination response */
export type FiatUSDestination = components['schemas']['FiatUSDestinationResponse'];

/** Crypto destination response */
export type CryptoDestination = components['schemas']['CryptoDestinationResponse'];

// ============================================================================
// Account Types
// ============================================================================

/** Account response union */
export type Account = components['schemas']['AccountResponse'];

/** Account creation request union */
export type AccountCreateRequest = components['schemas']['AccountCreateRequest'];

/** On-ramp account creation request */
export type OnrampAccountCreateRequest = components['schemas']['AccountCreateRequest'];

/** Off-ramp account creation request */
export type OfframpAccountCreateRequest = components['schemas']['AccountCreateRequest'];

/** Swap account creation request */
export type SwapAccountCreateRequest = components['schemas']['AccountCreateRequest'];

/** On-ramp account response */
export type OnrampAccount = components['schemas']['AccountResponse'];

/** Off-ramp account response */
export type OfframpAccount = components['schemas']['AccountResponse'];

/** Swap account response */
export type SwapAccount = components['schemas']['AccountResponse'];

/** Account update request */
export type AccountUpdateRequest = components['schemas']['AccountUpdateRequest'];

// ============================================================================
// Transaction Types
// ============================================================================

/** One-off transaction */
export type OneOffTransaction = components['schemas']['OneOffTransaction'];

/** One-off transaction request */
export type OneOffTransactionRequest = components['schemas']['OneOffTransactionRequest'];

/** Transaction status */
export type TransactionStatus = OneOffTransaction['status'];

/** Auto transaction */
export type AutoTransaction = components['schemas']['AutoAccountTransaction'];

// ============================================================================
// Wallet Types
// ============================================================================

/** Wallet */
export type Wallet = components['schemas']['Wallet'];

/** Wallet creation request */
export type WalletCreateRequest = components['schemas']['WalletCreateRequest'];

/** Wallet balance */
export type WalletBalance = components['schemas']['AssetBalance'];

/** Wallet balances */
export type WalletBalances = components['schemas']['WalletBalances'];

/** Wallet transaction request */
export type WalletTransactionRequest = components['schemas']['SendTransactionIntent'];

/** Wallet transaction response */
export type WalletTransaction = components['schemas']['WalletTransaction'];

// ============================================================================
// Event Types
// ============================================================================

/** Event */
export type Event = components['schemas']['Event'];

/** Event type */
export type EventType = Event['type'];

// ============================================================================
// Application Types (Onboarding)
// ============================================================================

/** Application list item (lightweight, used in list responses) */
export type ApplicationListItem = components['schemas']['ApplicationListItem'];

/** Application details (full application with all data) */
export type Application = components['schemas']['Application'];

/** Application status */
export type ApplicationStatus = components['schemas']['ApplicationStatus'];

/**
 * Business application creation request.
 *
 * Used when submitting a business application for KYB verification.
 */
export type BusinessApplicationCreateRequest =
  components['schemas']['BusinessApplicationCreateRequest'];

/**
 * Individual request for associated persons or individual applications.
 *
 * Used for:
 * - Adding UBOs (Ultimate Beneficial Owners)
 * - Adding control persons
 * - Adding applicants
 * - Individual (non-business) applications
 */
export type IndividualRequest = components['schemas']['IndividualRequest'];

/** Legal structure types for business applications */
export type LegalStructure =
  components['schemas']['BusinessApplicationCreateRequest']['legal_structure'];

/** Purpose of account options for businesses */
export type BusinessPurposeOfAccount =
  components['schemas']['BusinessApplicationCreateRequest']['purpose_of_account'][number];

/** Source of funds options for businesses */
export type BusinessSourceOfFunds =
  components['schemas']['BusinessApplicationCreateRequest']['source_of_funds'][number];

/** Average monthly revenue ranges */
export type AverageMonthlyRevenue =
  components['schemas']['BusinessApplicationCreateRequest']['average_monthly_revenue'];

/** Expected monthly deposit ranges */
export type ExpectedMonthlyDeposit =
  components['schemas']['BusinessApplicationCreateRequest']['expected_monthly_deposit'];

/** Individual roles */
export type IndividualRole = components['schemas']['IndividualRequest']['roles'][number];

/** Individual title options */
export type IndividualTitle = NonNullable<
  components['schemas']['IndividualRequest']['title']
>;

/** Employment status options */
export type EmploymentStatus = NonNullable<
  components['schemas']['IndividualRequest']['employment_status']
>;

/** Associated individual response */
export type AssociatedIndividual = components['schemas']['AssociatedIndividualResponse'];

/** Associated individual request (alias for IndividualRequest) */
export type AssociatedIndividualRequest = components['schemas']['IndividualRequest'];

/**
 * Application submission request.
 *
 * The submission endpoint does not require a body - it submits the already-populated application.
 * This type is kept for forward compatibility if fields are added in the future.
 */
export type ApplicationSubmissionRequest = Record<string, unknown>;

// ============================================================================
// Policy Types
// ============================================================================

/** Policy */
export type Policy = components['schemas']['Policy'];

/** Policy creation request */
export type PolicyCreateRequest = components['schemas']['CreatePolicyRequest'];

/** Policy rule */
export type PolicyRule = components['schemas']['PolicyRule'];

/** Policy rule creation request */
export type PolicyRuleCreateRequest = components['schemas']['CreatePolicyRuleRequest'];

// ============================================================================
// Signer Group Types
// ============================================================================

/** Signer group */
export type SignerGroup = components['schemas']['SignerGroup'];

/** Signer group creation request */
export type SignerGroupCreateRequest = components['schemas']['SignerGroupCreateRequest'];

/** Signer */
export type Signer = components['schemas']['Signer'];

/** Signer creation request */
export type SignerCreateRequest = components['schemas']['SignerCreateRequest'];

// ============================================================================
// API Key Types
// ============================================================================

/** API key */
export type ApiKey = components['schemas']['ApiKeyListItem'];

/** API key response */
export type ApiKeyResponse = components['schemas']['ApiKeyResponse'];

/** API key creation request */
export type ApiKeyCreateRequest = Record<string, unknown>;

// ============================================================================
// User Types
// ============================================================================

/** User */
export type User = components['schemas']['ClientUser'];

/** User creation request */
export type UserCreateRequest = components['schemas']['CreateClientUserRequest'];

/** User update request */
export type UserUpdateRequest = components['schemas']['UpdateClientUserRequest'];

// ============================================================================
// Webhook Types
// ============================================================================

/** Webhook target */
export type WebhookTarget = components['schemas']['WebhookTarget'];

/** Webhook target creation request */
export type WebhookTargetCreateRequest = components['schemas']['WebhookTargetCreateRequest'];

/** Webhook target update request */
export type WebhookTargetUpdateRequest = components['schemas']['WebhookTargetUpdateRequest'];

/** Webhook event */
export type WebhookEvent = components['schemas']['WebhookDelivery'];

// ============================================================================
// Info Types
// ============================================================================

/** Country info */
export type Country = components['schemas']['Country'];

/** Network info - generic structure for network responses */
export interface Network {
  id: string;
  name: string;
  [key: string]: unknown;
}

// ============================================================================
// Sandbox Types
// ============================================================================

/**
 * Payment simulation types for inbound payment events.
 *
 * - `ach_inbound` - ACH deposit into on-ramp account (requires `account_id`)
 * - `wire_inbound` - Wire deposit into on-ramp account (requires `account_id`)
 * - `crypto_inbound` - Crypto deposit into wallet (requires `wallet_id`)
 * - `ach_outbound_settled` - ACH payment completed successfully (requires `movement_id`)
 * - `ach_outbound_failed` - ACH payment failed (requires `movement_id`)
 * - `ach_outbound_returned` - ACH payment returned by receiving bank (requires `movement_id`)
 * - `ach_outbound_rejected` - ACH payment rejected (requires `movement_id`)
 * - `wire_outbound_settled` - Wire payment completed successfully (requires `movement_id`)
 * - `wire_outbound_failed` - Wire payment failed (requires `movement_id`)
 * - `wire_outbound_returned` - Wire payment returned (requires `movement_id`)
 * - `wire_outbound_rejected` - Wire payment rejected (requires `movement_id`)
 * - `ach_reversal` - ACH reversal (requires `movement_id`)
 * - `wire_reversal` - Wire reversal (requires `movement_id`)
 */
export type SimulateInboundType =
  | 'ach_inbound'
  | 'wire_inbound'
  | 'crypto_inbound'
  | 'ach_outbound_settled'
  | 'ach_outbound_failed'
  | 'ach_outbound_returned'
  | 'ach_outbound_rejected'
  | 'wire_outbound_settled'
  | 'wire_outbound_failed'
  | 'wire_outbound_returned'
  | 'wire_outbound_rejected'
  | 'ach_reversal'
  | 'wire_reversal';

/**
 * Sandbox inbound simulation request.
 *
 * Triggers a simulated payment event. The required fields depend on the `type`:
 *
 * | Type | Required Fields |
 * |------|-----------------|
 * | `ach_inbound`, `wire_inbound` | `account_id` |
 * | `crypto_inbound` | `wallet_id` |
 * | `*_outbound_*`, `*_reversal` | `movement_id` |
 *
 * @example
 * // Simulate ACH deposit to on-ramp account
 * await client.sandbox.simulateInbound({
 *   simulation_id: 'sim_001',
 *   type: 'ach_inbound',
 *   account_id: 'acc_123',
 *   amount: '1000.00',
 *   currency: 'USD',
 * });
 *
 * @example
 * // Simulate outbound ACH settlement (for off-ramp)
 * await client.sandbox.simulateInbound({
 *   simulation_id: 'sim_002',
 *   type: 'ach_outbound_settled',
 *   movement_id: 'mov_456',
 *   amount: '500.00',
 *   currency: 'USD',
 * });
 */
export interface SimulateInboundRequest {
  /** Unique ID for this simulation (used for idempotency). Required. */
  simulation_id: string;

  /** Payment rail and direction. Required. */
  type: SimulateInboundType;

  /** Amount as a decimal string. Required. */
  amount: string;

  /** Currency code (e.g., 'USD', 'USDC'). Required. */
  currency: string;

  /** Platform account ID. Required for `ach_inbound` and `wire_inbound`. */
  account_id?: string;

  /** Wallet ID. Required for `crypto_inbound`. */
  wallet_id?: string;

  /** Movement/Transaction ID. Required for outbound types (`*_outbound_*`, `*_reversal`). */
  movement_id?: string;

  /**
   * Simulation scenario. Defaults to `success_immediate`.
   *
   * Common scenarios:
   * - `success_immediate` - Callbacks fire immediately
   * - `success_delayed` - Callbacks fire after `delay_seconds` (default 30s)
   *
   * For `crypto_inbound`:
   * - `wrong_chain` - Deposit on wrong chain
   * - `unsupported_token` - Unsupported token type
   * - `address_mismatch` - Address doesn't match
   * - `partial_crypto` - Partial amount received (use with `partial_amount`)
   * - `unconfirmed` - Unconfirmed transaction
   */
  scenario?: string;

  /** Amount actually received (for `crypto_inbound` with `scenario=partial_crypto` only). */
  partial_amount?: string;

  /** Delay in seconds for `success_delayed` scenario (1-86400). */
  delay_seconds?: number;

  /** Optional trace ID for correlation. */
  trace_id?: string;

  /** Additional properties for forward compatibility. */
  [key: string]: unknown;
}

/** Sandbox simulation response (for simulateInbound) */
export interface SimulationResponse {
  /** The simulation ID that was submitted. */
  simulation_id: string;

  /** Current state of the simulation ('accepted'). */
  state?: 'accepted';

  /** Trace ID if provided in request. */
  trace_id?: string;

  /** Additional properties. */
  [key: string]: unknown;
}

/** Sandbox onboarding simulation response */
export interface SimulateOnboardingResponse {
  /** The simulation ID that was submitted. */
  simulation_id: string;

  /** The applicant ID that was processed. */
  applicant_id: string;

  /** State before the transition. */
  previous_state: string;

  /** State after the transition. */
  new_state: string;

  /** Additional properties. */
  [key: string]: unknown;
}

/**
 * Onboarding simulation types.
 *
 * - `kyb_approve` - Approve a KYB application
 * - `kyb_reject` - Reject a KYB application
 * - `kyb_info_request` - Request additional information for KYB
 * - `kyc_approve` - Approve a KYC check
 * - `kyc_reject` - Reject a KYC check
 * - `kyc_info_request` - Request additional information for KYC
 * - `applicant_activate` - Activate an applicant (triggers provisioning)
 * - `applicant_suspend` - Suspend an applicant
 */
export type SimulateOnboardingType =
  | 'kyb_approve'
  | 'kyb_reject'
  | 'kyb_info_request'
  | 'kyc_approve'
  | 'kyc_reject'
  | 'kyc_info_request'
  | 'applicant_activate'
  | 'applicant_suspend';

/**
 * Sandbox onboarding simulation request.
 *
 * Drives KYB, KYC, or applicant account status through a sandbox transition.
 *
 * **Important:** For full activation, you typically need to call:
 * 1. `kyb_approve` - Approves the KYB application
 * 2. `applicant_activate` - Activates the applicant (triggers provisioning)
 *
 * @example
 * // Approve KYB and activate applicant
 * await client.sandbox.simulateOnboarding({
 *   type: 'kyb_approve',
 *   applicant_id: 'app_123',
 *   simulation_id: 'sim_kyb_001',
 * });
 *
 * await client.sandbox.simulateOnboarding({
 *   type: 'applicant_activate',
 *   applicant_id: 'app_123',
 *   simulation_id: 'sim_activate_001',
 * });
 */
export interface SimulateOnboardingRequest {
  /** The onboarding transition to simulate. Required. */
  type: SimulateOnboardingType;

  /** The onboarding application ID (from customer creation). Required. */
  applicant_id: string;

  /** Unique ID for this simulation (for idempotency). Required. */
  simulation_id: string;

  /** Organization ID (optional, used for logging). */
  organization_id?: string;

  /** Reason code for reject/info_request transitions. */
  reason_code?: string;

  /** Fields to request (for `*_info_request` types only). */
  info_request_fields?: string[];

  /** Additional properties for forward compatibility. */
  [key: string]: unknown;
}

/**
 * Request for advancing a stateful simulation.
 *
 * Some scenarios pause and wait for explicit advancement via POST /sandbox/simulations/{id}/advance.
 */
export interface AdvanceSimulationRequest {
  /** Action to take: 'release', 'reject', 'confirm', 'expire'. */
  action: string;

  /** Optional reason code (e.g., 'R10' for ACH return). */
  reason_code?: string;
}

/** Result of advancing a simulation */
export interface AdvanceSimulationResult {
  /** The simulation ID. */
  simulation_id: string;

  /** State before advancing. */
  previous_state: string;

  /** State after advancing. */
  new_state: string;

  /** Number of new callbacks scheduled. */
  callbacks_scheduled: number;
}

/** Callback delivery record for a simulation */
export interface SimulationCallbackRecord {
  /** Callback identifier. */
  callback_id?: string;

  /** Full webhook payload (JSON-encoded). */
  payload_json?: string;

  /** When callback is scheduled. */
  scheduled_for?: string;

  /** Delivery state. */
  state?: 'pending' | 'delivered' | 'failed';

  /** Number of delivery attempts made. */
  attempts?: number;

  /** Maximum allowed attempts. */
  max_attempts?: number;

  /** When successfully delivered. */
  delivered_at?: string;

  /** Last error message if failed. */
  last_error?: string;
}

/** Full simulation inspection/state */
export interface SimulationInspection {
  /** Simulation identifier. */
  simulation_id: string;

  /** Payment rail (ach, wire, crypto). */
  rail: string;

  /** Operation type. */
  operation: string;

  /** Scenario name. */
  scenario: string;

  /** Current state (accepted, settled, returned, rejected, failed). */
  state: string;

  /** Sub-state for multi-step scenarios. */
  state_position?: string;

  /** Whether simulation is paused waiting for advance. */
  awaiting_advance?: boolean;

  /** Organization that owns simulation. */
  organization_id: string;

  /** Platform account ID (fiat simulations). */
  account_id?: string;

  /** Platform wallet ID (crypto simulations). */
  wallet_id?: string;

  /** Amount as decimal string. */
  amount: string;

  /** Currency code. */
  currency: string;

  /** Caller-supplied trace ID. */
  trace_id?: string;

  /** Caller-supplied metadata. */
  metadata?: Record<string, string>;

  /** When simulation was created. */
  created_at: string;

  /** When simulation reached terminal state. */
  completed_at?: string;

  /** Callback delivery log. */
  callbacks?: SimulationCallbackRecord[];

  /** Valid advance actions when awaiting_advance=true. */
  advance_actions_available?: string[];
}

/** Sandbox scenario */
export type SandboxScenario = components['schemas']['SandboxScenario'];

// ============================================================================
// Pagination Types
// ============================================================================

/** Pagination metadata */
export type Meta = components['schemas']['Meta'];

/** Common list parameters */
export interface ListParams {
  starting_after?: string;
  ending_before?: string;
  limit?: number;
  [key: string]: unknown;
}

/** Customer list parameters */
export interface CustomerListParams extends ListParams {
  external_id?: string;
  search?: string;
  kyb_status?: KybStatus;
}

/** Transaction list parameters */
export interface TransactionListParams extends ListParams {
  customer_id?: string;
  account_id?: string;
  status?: TransactionStatus;
}

/** Event list parameters */
export interface EventListParams extends ListParams {
  event_type?: string;
}
