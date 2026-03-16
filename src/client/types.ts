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

/** Network identifier */
export type NetworkId = string;

/** Payment capability/rail */
export type PaymentCapability = string;

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

/** Application list item */
export type ApplicationListItem = components['schemas']['ApplicationListItem'];

/** Application details */
export type Application = components['schemas']['Application'];

/** Application submission request */
export type ApplicationSubmissionRequest = Record<string, unknown>;

/** Associated individual */
export type AssociatedIndividual = components['schemas']['AssociatedIndividualResponse'];

/** Associated individual request */
export type AssociatedIndividualRequest = components['schemas']['IndividualRequest'];

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

/** Sandbox inbound simulation request */
export interface SimulateInboundRequest {
  account_id: string;
  amount: string;
  scenario?: string;
  [key: string]: unknown;
}

/** Sandbox simulation response */
export interface SimulationResponse {
  simulation_id?: string;
  applicant_id?: string;
  previous_state?: string;
  new_state?: string;
  [key: string]: unknown;
}

/** Sandbox onboarding simulation request */
export interface SimulateOnboardingRequest {
  type:
    | 'kyb_approve'
    | 'kyb_reject'
    | 'kyb_info_request'
    | 'kyc_approve'
    | 'kyc_reject'
    | 'kyc_info_request'
    | 'applicant_activate'
    | 'applicant_suspend';
  applicant_id: string;
  simulation_id: string;
  organization_id?: string;
  reason_code?: string;
  info_request_fields?: string[];
  [key: string]: unknown;
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
