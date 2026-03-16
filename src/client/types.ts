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
export type KSUID = components['schemas']['KSUID'];

/** Network identifier */
export type NetworkId = components['schemas']['NetworkId'];

/** Payment capability/rail */
export type PaymentCapability = components['schemas']['PaymentCapability'];

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
export type KybStatus = components['schemas']['KybStatus'];

// ============================================================================
// Recipient Types
// ============================================================================

/** Recipient response */
export type Recipient = components['schemas']['RecipientResponse'];

/** Recipient creation request */
export type RecipientRequest = components['schemas']['RecipientRequest'];

/** Recipient update request */
export type RecipientUpdateRequest = components['schemas']['RecipientUpdateRequest'];

// ============================================================================
// Destination Types
// ============================================================================

/** Destination response union */
export type Destination = components['schemas']['DestinationResponseUnion'];

/** Destination request union */
export type DestinationRequest = components['schemas']['DestinationRequest'];

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
export type Account = components['schemas']['AccountResponseUnion'];

/** Account creation request union */
export type AccountCreateRequest = components['schemas']['AccountCreateRequest'];

/** On-ramp account creation request */
export type OnrampAccountCreateRequest = components['schemas']['OnrampAccountCreateRequest'];

/** Off-ramp account creation request */
export type OfframpAccountCreateRequest = components['schemas']['OfframpAccountCreateRequest'];

/** Swap account creation request */
export type SwapAccountCreateRequest = components['schemas']['SwapAccountCreateRequest'];

/** On-ramp account response */
export type OnrampAccount = components['schemas']['OnrampAccount'];

/** Off-ramp account response */
export type OfframpAccount = components['schemas']['OfframpAccount'];

/** Swap account response */
export type SwapAccount = components['schemas']['SwapAccount'];

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
export type TransactionStatus = components['schemas']['OneOffTransactionStatus'];

/** Auto transaction */
export type AutoTransaction = components['schemas']['AutoTransaction'];

// ============================================================================
// Wallet Types
// ============================================================================

/** Wallet */
export type Wallet = components['schemas']['Wallet'];

/** Wallet creation request */
export type WalletCreateRequest = components['schemas']['WalletCreateRequest'];

/** Wallet balance */
export type WalletBalance = components['schemas']['Balance'];

/** Wallet transaction request */
export type WalletTransactionRequest = components['schemas']['WalletTransactionRequest'];

/** Wallet transaction response */
export type WalletTransaction = components['schemas']['WalletTransactionResponse'];

// ============================================================================
// Event Types
// ============================================================================

/** Event */
export type Event = components['schemas']['Event'];

/** Event type */
export type EventType = components['schemas']['EventType'];

// ============================================================================
// Application Types (Onboarding)
// ============================================================================

/** Application list item */
export type ApplicationListItem = components['schemas']['ApplicationListItem'];

/** Application details */
export type Application = components['schemas']['ApplicationListItem'];

/** Application submission request */
export type ApplicationSubmissionRequest = components['schemas']['ApplicationSubmissionRequest'];

/** Associated individual */
export type AssociatedIndividual = components['schemas']['AssociatedIndividual'];

/** Associated individual request */
export type AssociatedIndividualRequest = components['schemas']['AssociatedIndividualRequest'];

// ============================================================================
// Policy Types
// ============================================================================

/** Policy */
export type Policy = components['schemas']['Policy'];

/** Policy creation request */
export type PolicyCreateRequest = components['schemas']['PolicyCreateRequest'];

/** Policy rule */
export type PolicyRule = components['schemas']['PolicyRule'];

/** Policy rule creation request */
export type PolicyRuleCreateRequest = components['schemas']['PolicyRuleCreateRequest'];

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
export type ApiKey = components['schemas']['ApiKey'];

/** API key creation request */
export type ApiKeyCreateRequest = components['schemas']['ApiKeyCreateRequest'];

// ============================================================================
// User Types
// ============================================================================

/** User */
export type User = components['schemas']['User'];

/** User creation request */
export type UserCreateRequest = components['schemas']['UserCreateRequest'];

/** User update request */
export type UserUpdateRequest = components['schemas']['UserUpdateRequest'];

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
export type WebhookEvent = components['schemas']['WebhookEvent'];

// ============================================================================
// Info Types
// ============================================================================

/** Country info */
export type Country = components['schemas']['Country'];

/** Network info */
export type Network = components['schemas']['Network'];

// ============================================================================
// Sandbox Types
// ============================================================================

/** Sandbox simulation request */
export type SimulateInboundRequest = components['schemas']['SimulateInboundRequest'];

/** Sandbox simulation response */
export type SimulationResponse = components['schemas']['SimulationResponse'];

/** Sandbox onboarding request */
export type SimulateOnboardingRequest = components['schemas']['SimulateOnboardingRequest'];

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
