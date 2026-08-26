/**
 * SDK-friendly type aliases and helpers.
 *
 * These types provide a cleaner interface over the generated OpenAPI types.
 */

import type { components, operations } from '../generated/api.js';

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

/**
 * Customer creation request.
 *
 * NOTE: openapi-typescript generates `is_sub_client` as required because the
 * OpenAPI spec declares a `default: false`. The spec's `required:` list is
 * only `['name', 'customer_type']`, so this alias re-exports with
 * `is_sub_client` optional to match the server's runtime behaviour. Pass
 * `is_sub_client: true` to designate a sub-client at creation; cannot be
 * combined with `sub_client_id`. See ENG-2454.
 */
export type CustomerCreateRequest = Omit<
  components['schemas']['CustomerCreateRequest'],
  'is_sub_client'
> & {
  is_sub_client?: boolean;
};

/** Customer creation response */
export type CustomerCreateResponse = components['schemas']['CustomerCreateResponse'];

/** KYB status */
export type KybStatus = Customer['kyb_status'];

/**
 * The single client-facing customer status.
 *
 * One value collapsing the frozen state, the application decision, and the
 * application lifecycle — what the dashboard shows, filters, and counts by.
 * See `Customer.status` for the derivation precedence.
 *
 * Distinct from {@link KybStatus}, which reports only the KYB leg.
 */
export type CustomerStatus = components['schemas']['CustomerStatus'];

/**
 * How many customers hold each unified status.
 *
 * Returned alongside a customer page as `status_counts`, computed under the
 * same filters (search, date, sub-client) but IGNORING the `status` selection
 * itself — so a status chip keeps its count while that status is the active
 * filter. A status absent from the object has a count of zero.
 *
 * `customers.list()` iterates rows, so reach this with
 * {@link CustomersResource.listPage}.
 */
export type CustomerStatusCounts = components['schemas']['CustomerStatusCounts'];

/** Request to update the sub-client association for a customer */
export type UpdateCustomerSubClientRequest =
  components['schemas']['UpdateCustomerSubClientRequest'];

/** Summary of a sub-client including the count of associated customers */
export type SubClientSummary = components['schemas']['SubClientSummary'];

/** Request body for bulk-importing customers from Sumsub share tokens */
export interface BulkImportSumsubTokensRequest {
  /** List of Sumsub share tokens to import */
  tokens: string[];
}

/** Per-token outcome for a bulk Sumsub import */
export interface BulkImportSumsubTokensResult {
  name?: string;
  success?: boolean;
  customer_id?: string;
  application_id?: string;
  error?: string;
}

/** Response from bulk-importing customers from Sumsub share tokens */
export interface BulkImportSumsubTokensResponse {
  total?: number;
  succeeded?: number;
  failed?: number;
  results?: BulkImportSumsubTokensResult[];
}

/**
 * Request body for importing customers from Persona Connect share tokens.
 *
 * Up to 5,000 tokens per request — split larger migrations into multiple
 * batches, each of which returns its own job.
 */
export interface ImportPersonaTokensRequest {
  /** Persona Connect share tokens (`cnst_...`) to import */
  tokens: string[];
}

/**
 * The queued job returned by `importPersonaTokens`.
 *
 * `skipped` entries are token STRINGS that could not be queued (malformed,
 * duplicated within the batch, or already imported) — never a compliance
 * decision about a person or application.
 */
export type ImportPersonaTokensResponse =
  operations['importPersonaTokens']['responses'][202]['content']['application/json'];

/** Summary row for a Persona share-token import job. */
export type PersonaImportJobSummary = components['schemas']['PersonaImportJobSummary'];

/** One page of Persona import jobs (this endpoint pages on its own cursor). */
export type PersonaImportJobsPage =
  operations['listPersonaImportJobs']['responses'][200]['content']['application/json'];

/** Per-token outcome inside a Persona import job. */
export type PersonaImportRowResult = components['schemas']['PersonaImportRowResult'];

/** A Persona import job with its per-token results (one page of rows). */
export type PersonaImportJob =
  operations['getPersonaImportJob']['responses'][200]['content']['application/json'];

/** Parameters for listing Persona import jobs (newest first). */
export interface PersonaImportJobListParams {
  limit?: number;
  /** Job ID cursor; returns jobs created before it */
  starting_after?: string;
}

/** Parameters for paging the result rows of a single Persona import job. */
export interface PersonaImportJobParams {
  results_limit?: number;
  /** Row-index cursor; returns rows with a greater index */
  results_after_index?: number;
}

/** A customer's capabilities and the outstanding requirements to unlock each. */
export type CustomerCapabilities = components['schemas']['CustomerCapabilities'];

/** One rail/capability and what the customer must do to unlock it. */
export type Capability = components['schemas']['Capability'];

/** A single outstanding requirement (terms to accept, or a document to upload). */
export type CapabilityRequirement = components['schemas']['CapabilityRequirement'];

/** A freshly minted application link for re-engaging an approved customer. */
export type CustomerReEngagementResponse = components['schemas']['CustomerReEngagementResponse'];

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

/** Destination response union (used by `destinations.list`) */
export type Destination = components['schemas']['DestinationResponseUnion'];

/** Destination request union */
export type DestinationRequest = components['schemas']['DestinationRequestUnion'];

/**
 * Response for `destinations.create` — the platform returns just `{ id }`
 * (per `IDResponse`), NOT the full `DestinationResponseUnion`. Call
 * `destinations.list(recipientId)` afterwards to read the full shape if
 * you need it.
 */
export type DestinationCreateResponse = components['schemas']['IDResponse'];

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

/**
 * Wallet transaction request body.
 *
 * `POST /wallets/{id}/transactions` expects an endorsed envelope —
 * `{ signatures: string[], intent: SendTransactionIntent }` — NOT a bare
 * intent. Build the `SendTransactionIntent`, canonicalize per RFC 8785,
 * sign with the wallet's signer-group ECDSA P-256 key, then post the
 * `{ signatures, intent }` envelope.
 *
 * @see https://docs.dakota.xyz/documentation/signing-guide
 */
export type WalletTransactionRequest = components['schemas']['EndorsedRequest'];

/**
 * The bare intent that goes inside `WalletTransactionRequest.intent`.
 * Exposed for callers building + signing the intent locally before
 * wrapping it in the endorsed envelope.
 */
export type SendTransactionIntent = components['schemas']['SendTransactionIntent'];

/**
 * Endorsed request envelope: `{ signatures: string[], intent: <one of the
 * endorsed intent types> }`. Required by every mutating policy / signer-group
 * / wallet-transaction endpoint. Build the canonical intent, sign it with
 * each required signer's private key, and pass the resulting envelope as
 * the `endorsement` option on the relevant resource method.
 */
export type EndorsedRequest = components['schemas']['EndorsedRequest'];

/** Wallet transaction response */
export type WalletTransaction = components['schemas']['WalletTransaction'];

/** Slim reference to a policy attached to a wallet (id + name) */
export type AttachedPolicy = components['schemas']['AttachedPolicy'];

/** Slim reference to a wallet attached to a policy or signer group (id + name + family) */
export type AttachedWallet = components['schemas']['AttachedWallet'];

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
 * The reviewer-selected resubmission scope for an RFI (request for
 * information).
 *
 * Present on `Application.rfi_requested_items` while an RFI is open: which
 * documents to replace, whether the business description is editable, and any
 * free-text compliance questions to answer. Render the resubmit page from
 * this rather than reopening the whole application form.
 */
export type RFIRequestedItems = components['schemas']['RFIRequestedItems'];

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
export type IndividualTitle = NonNullable<components['schemas']['IndividualRequest']['title']>;

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

/** Response after updating business details */
export type BusinessDetailsResponse = components['schemas']['BusinessDetailsResponse'];

/** Response after updating individual details */
export type IndividualDetailsResponse = components['schemas']['IndividualDetailsResponse'];

/** Attestation submission request */
export type AttestationSubmitRequest = components['schemas']['AttestationSubmitRequest'];

/** Attestation type */
export type AttestationType = components['schemas']['AttestationType'];

/** EDD (Enhanced Due Diligence) request */
export type EDDRequest = components['schemas']['EDDRequest'];

/** EDD response with application context */
export type EDDWithApplicationID = components['schemas']['EDDWithApplicationID'];

/** Application document upload request (base64-encoded content) */
export type ApplicationDocumentUploadRequest =
  components['schemas']['ApplicationDocumentUploadRequest'];

/** Application document upload URL request (presigned URL) */
export type ApplicationDocumentUploadUrlRequest =
  components['schemas']['ApplicationDocumentUploadUrlRequest'];

/** Document upload response (contains document_id) */
export type DocumentUploadResponse = components['schemas']['DocumentUploadResponse'];

/** Document upload URL response (contains upload_url and upload_id) */
export type DocumentUploadUrlResponse = components['schemas']['DocumentUploadUrlResponse'];

/** Uploaded document metadata (used in list responses) */
export type UploadedDocumentMetadata = components['schemas']['UploadedDocumentMetadata'];

/** Individual document upload request (base64-encoded content) */
export type IndividualDocumentUploadRequest =
  components['schemas']['IndividualDocumentUploadRequest'];

/** Individual document upload URL request (presigned URL) */
export type IndividualDocumentUploadUrlRequest =
  components['schemas']['IndividualDocumentUploadUrlRequest'];

/** Application document type */
export type ApplicationDocumentType = components['schemas']['ApplicationDocumentType'];

/** Individual document type */
export type IndividualDocumentType = components['schemas']['IndividualDocumentType'];

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

/** Signer creation request (POST /signers — creates a signer resource) */
export type SignerCreateRequest = components['schemas']['SignerCreateRequest'];

/**
 * Signer group signer add request (POST /signer-groups/{id}/signers —
 * adds an EXISTING signer's public key to a group).
 */
export type SignerGroupSignerAddRequest = components['schemas']['CreateSignerGroupSignerRequest'];

/** Parameters for getting a single signer group. */
export interface SignerGroupGetParams {
  /**
   * When true, the response also carries a `removed_members` array of signers
   * that were removed from this group (each with its `removed_at`).
   * Defaults to false — active members only.
   */
  include_removed?: boolean;
}

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

/** Webhook history list response (cursor-based pagination) */
export type WebhookHistoryList = components['schemas']['WebhookHistoryList'];

/** Webhook replay response */
export type WebhookReplayResponse = components['schemas']['WebhookReplayResponse'];

/** API key creation request for a specific client (admin only) */
export type CreateApiKeyForClientRequest = components['schemas']['CreateApiKeyForClientRequest'];

/**
 * Webhook history list parameters.
 *
 * Uses cursor-based pagination (not starting_after/has_more_after).
 */
export interface WebhookHistoryListParams {
  /** Filter by delivery status */
  status?: 'delivered' | 'failed' | 'pending';
  /** Filter by event type (e.g. `transaction.completed`) */
  event_type?: string;
  /** Filter to deliveries that originated from a sandbox simulation */
  simulation_id?: string;
  /** Return only records created at or after this timestamp (ISO 8601) */
  from?: string;
  /** Return only records created at or before this timestamp (ISO 8601) */
  to?: string;
  /** Maximum number of records to return per page (1-100, default 20) */
  limit?: number;
  /** Pagination cursor (event_id of the last item from the previous page) */
  cursor?: string;
}

/**
 * Webhook history response.
 *
 * Uses cursor-based pagination with `has_more` and `cursor` instead of the
 * standard `meta.has_more_after` format.
 */
export interface WebhookHistoryResponse {
  data: WebhookEvent[];
  has_more: boolean;
  cursor?: string | null;
}

// ============================================================================
// Legal Document Types
// ============================================================================

/**
 * One published revision of a legal document.
 *
 * A revision is IMMUTABLE: `version` identifies an exact text that never
 * changes once published, and a correction produces a new revision rather than
 * editing this one. So an acceptance recorded against a version always refers
 * to the same words, and a fetched `(key, version)` can be cached forever.
 *
 * `content` is present only on {@link LegalResource.get} — the list is an
 * index without the text.
 */
export type LegalDocument = components['schemas']['LegalDocument'];

/**
 * A legal document the customer has never accepted, at the revision now in
 * force. Identity only — fetch the text with {@link LegalResource.get}.
 */
export type OutstandingLegalDocument = components['schemas']['OutstandingLegalDocument'];

/** An agreement this application has already accepted, and at which revision. */
export type AcceptedAgreement = components['schemas']['AcceptedAgreement'];

/**
 * Someone permitted to accept this application's agreements.
 *
 * An id and a display name, and NOTHING else about the person: the credential
 * that reaches this endpoint travels in an emailed URL, and date of birth,
 * nationality and email are exactly what that scoping exists to keep out.
 */
export type LegalAcceptanceAttestor = components['schemas']['LegalAcceptanceAttestor'];

/**
 * What an accept-agreements page renders: the agreements still owed, and the
 * people permitted to accept them.
 *
 * Deliberately NOT the application — see
 * {@link ApplicationsResource.getLegalAcceptance}.
 */
export type LegalAcceptanceContext = components['schemas']['LegalAcceptanceContext'];

// ============================================================================
// RD Marketing Fee Types
// ============================================================================

/**
 * One month of a client's reserve-management marketing-fee statement.
 *
 * Absent is not zero: `owed_minor` and `avg_daily_balance_minor` are absent
 * until the month is priced, and a zero there would instead assert that
 * nothing is owed.
 */
export type RDMarketingFeeStatement = components['schemas']['RDMarketingFeeStatement'];

/**
 * One calendar day of a marketing-fee statement.
 *
 * Every day of the month gets a row. An ABSENT `balance_minor` means the day
 * is not stamped yet; a present `'0'` means the client genuinely held no RD
 * that day. The two are different facts and must not render alike.
 */
export type RDMarketingFeeDailyRow = components['schemas']['RDMarketingFeeDailyRow'];

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
 * - `kyb_approve` - Fully approve any customer (individual or business). Triggers the complete
 *   onboarding flow including endorsement and recipient creation.
 * - `kyb_reject` - Reject a KYB application
 * - `kyb_info_request` - Request additional information for KYB
 * - `kyc_approve` - Approve an individual applicant's KYC application status only (no endorsement/recipient)
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
// Self-Serve Credits Types
// ============================================================================

/** Self-serve credits purchase request */
export type SelfServeCreditsPurchaseRequest =
  components['schemas']['SelfServeCreditsPurchaseRequest'];

/** Self-serve credits purchase response (contains checkout URL) */
export type SelfServeCreditsPurchaseResponse =
  components['schemas']['SelfServeCreditsPurchaseResponse'];

/** Self-serve credits balance response */
export type SelfServeCreditsBalanceResponse =
  components['schemas']['SelfServeCreditsBalanceResponse'];

/** Self-serve credits ledger entry */
export type SelfServeCreditsLedgerEntry = components['schemas']['SelfServeCreditsLedgerEntry'];

/** Self-serve credits ledger response */
export type SelfServeCreditsLedgerResponse =
  components['schemas']['SelfServeCreditsLedgerResponse'];

/** Self-serve credit tier */
export type SelfServeCreditTier = components['schemas']['SelfServeCreditTier'];

/** Self-serve credit tiers response */
export type SelfServeCreditTiersResponse = components['schemas']['SelfServeCreditTiersResponse'];

/** Self-serve client pricing configuration (fee schedule) */
export type ClientPricingConfig = components['schemas']['ClientPricingConfig'];

/**
 * Self-serve credits pricing response.
 *
 * Returned by `GET /self-serve/credits/pricing` — the caller's current
 * `ClientPricingConfig` (transfer/ACH/wire/SEPA/SWIFT/KYC/KYB fees + monthly minimum).
 */
export type SelfServeCreditsPricingResponse = ClientPricingConfig;

/** Ledger entry type filter */
export type SelfServeCreditsLedgerEntryType = SelfServeCreditsLedgerEntry['entry_type'];

/** Parameters for listing self-serve credits ledger entries */
export interface SelfServeCreditsLedgerParams {
  /** Cursor for pagination (ISO 8601 datetime). Returns entries created BEFORE it. */
  cursor?: string;
  /**
   * Tiebreaker for `cursor` — pass the `id` of the last entry on the previous
   * page, alongside its `created_at` as `cursor`.
   *
   * Entries written in one transaction share an identical `created_at`, so
   * ordering by timestamp alone is not total and a page boundary landing
   * inside such a group SILENTLY DROPS rows. With both, entries come back
   * strictly before `(cursor, cursor_id)` in `(created_at, id)` order.
   *
   * Ignored unless `cursor` is also present.
   */
  cursor_id?: string;
  /** Number of entries to return (1-100, default 20) */
  limit?: number;
  /** Filter by entry type */
  type?: SelfServeCreditsLedgerEntryType;
}

// ============================================================================
// Fee Payout Destination Types
// ============================================================================

/**
 * The destination Dakota pays accrued developer fees to.
 *
 * Exactly one exists per organization, and it is crypto-only (a USDC wallet).
 */
export type FeePayoutDestination = components['schemas']['FeePayoutDestination'];

/** Request body for `PUT /fee-payout-destination` (register or replace). */
export type PutFeePayoutDestinationRequest =
  components['schemas']['PutFeePayoutDestinationRequest'];

/** A USDC wallet payout destination — CAIP-2 chain id + address. */
export type UsdcWalletPayoutDestination = components['schemas']['UsdcWalletPayoutDestination'];

// ============================================================================
// Request Options
// ============================================================================

/**
 * Options for API requests.
 *
 * Use this to pass custom idempotency keys for deterministic API calls.
 *
 * @example
 * ```typescript
 * // Use a custom idempotency key for replay safety (must be a valid UUID —
 * // the platform rejects other formats with 400)
 * const tx = await client.transactions.create(
 *   { customer_id: '...', amount: '100.00', ... },
 *   { idempotencyKey: randomUUID() }
 * );
 * ```
 */
export interface RequestOptions {
  /**
   * Custom idempotency key (UUID format).
   *
   * If provided, this key will be used instead of auto-generating one.
   * The same key with the same request body will return the cached response.
   *
   * Requirements:
   * - Must be a valid UUID
   * - Stable per logical operation
   * - Not reused across different business intents
   */
  idempotencyKey?: string;

  /**
   * Deadline for THIS request, in milliseconds.
   *
   * Overrides the client-wide `timeout` (and any endpoint default) for this
   * call only — so one slow operation does not force you to loosen the
   * deadline on every fast one, or to build a second client that differs by
   * a single number.
   *
   * Per ATTEMPT, not per call: a request that keeps timing out is retried
   * per `retryPolicy`, so budget roughly `timeout × maxAttempts`.
   */
  timeout?: number;

  /**
   * Endorsed-request envelope (`{ signatures, intent }`) for mutating
   * policy, signer-group, and wallet-transaction endpoints. Required by the
   * server on all endorsed routes — passing this is the only way the
   * signature ever reaches the wire. On methods that already accept a
   * typed `data` argument (e.g. `policies.addRule`, `policies.updateRule`),
   * `endorsement` takes precedence over `data` when both are provided so
   * you can swap a bare data shape for an endorsed envelope at the call
   * site without breaking the typed signature.
   */
  endorsement?: EndorsedRequest;
}

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

/**
 * Customer list parameters.
 *
 * The `*_statuses` filters take a COMMA-SEPARATED list in one string, not an
 * array — `'active,frozen'`, not `['active', 'frozen']`.
 */
export interface CustomerListParams extends ListParams {
  external_id?: string;
  /** Name, email, or customer id. Case-insensitive. */
  search?: string;
  /** A single KYB status. Use `kyb_statuses` for several. */
  kyb_status?: KybStatus;
  /** Several KYB statuses, comma-separated (e.g. `'active,frozen'`). */
  kyb_statuses?: string;
  /**
   * Several effective KYC/B link statuses, comma-separated. Values mirror
   * `KybLinkStatus`: `not_started`, `pending`, `in_review`, `approved`,
   * `expired`, `rejected`.
   */
  kyc_statuses?: string;
  /**
   * Several onboarding application statuses, comma-separated. Values mirror
   * {@link ApplicationStatus}. Customers with NO application are excluded
   * when this filter is set.
   */
  application_statuses?: string;
  /**
   * Several unified customer statuses, comma-separated (e.g.
   * `'frozen,info_requested'`). Values mirror {@link CustomerStatus}.
   *
   * This is the one client-facing status the dashboard shows, filters, and
   * counts by — it collapses the frozen state, the application decision, and
   * the application lifecycle into a single value.
   */
  status?: string;
  sub_client_id?: string;
  /** True returns ONLY sub-clients. False or omitted returns everything. */
  is_sub_client?: boolean;
  /** Defaults to `name`. */
  sort_by?:
    | 'application_status'
    | 'created_at'
    | 'customer_type'
    | 'id'
    | 'kyb_status'
    | 'kyc_status'
    | 'name'
    | 'status';
  /** Defaults to `asc`. */
  sort_dir?: 'asc' | 'desc';
  /** RFC 3339 lower bound on `created_at`. */
  created_at_from?: string;
  /** RFC 3339 upper bound on `created_at`. */
  created_at_to?: string;
}

/**
 * One page of customers, plus the per-status counts the dashboard header
 * renders. Returned by {@link CustomersResource.listPage}.
 */
export interface CustomerPage {
  data: Customer[];
  meta?: Meta;
  /**
   * Counts under the same filters but ignoring the `status` selection, so a
   * status chip keeps its count while it is the active filter. Absent when
   * the server did not compute them.
   */
  status_counts?: CustomerStatusCounts;
}

/** The transaction resource family a `GET /transactions` page belongs to. */
export type TransactionResourceType = components['schemas']['TransactionResourceType'];

/**
 * Meta on a transaction list page.
 *
 * The shared pagination meta plus `transaction_type`, which names the family
 * the server actually listed — so an empty page still says what it searched,
 * and `total_count` is read as a count of that family alone.
 */
export type TransactionListMeta = components['schemas']['TransactionListMeta'];

/** Filters every transaction family accepts. */
export interface TransactionListParamsBase extends ListParams {
  customer_id?: string;
  /** Free-text search across the family's rows. */
  search?: string;
  sort_by?: 'amount' | 'created_at' | 'customer_name' | 'status';
  sort_dir?: 'asc' | 'desc';
  /** RFC 3339 lower bound on `created_at`, inclusive. */
  created_at_from?: string;
  /** RFC 3339 upper bound on `created_at`, inclusive. */
  created_at_to?: string;
  /** Decimal string, e.g. `'100.00'`. */
  amount_min?: string;
  /** Decimal string, e.g. `'5000.00'`. */
  amount_max?: string;
}

/**
 * Filters for the `one_off` family — the default family of
 * {@link TransactionsResource.list}.
 */
export interface OneOffTransactionListParams extends TransactionListParamsBase {
  transaction_type?: 'one_off';
  destination_id?: string;
  status?: TransactionStatus;
  /** Several statuses at once, comma-separated (e.g. `'pending,completed'`). */
  statuses?: string;
  source_network_id?: string;
  source_asset?: string;
  destination_asset?: string;
}

/**
 * Filters for the `wallet` family.
 *
 * `transaction_type: 'wallet'` is REQUIRED — it is the only way to reach this
 * family, and the server rejects `wallet_id` or `direction` without it with a
 * 400 rather than inferring it.
 */
export interface WalletTransactionListParams extends TransactionListParamsBase {
  transaction_type: 'wallet';
  /** Filter to one wallet. */
  wallet_id?: string;
  /**
   * Direction relative to the wallet:
   * - `'out'` — sent FROM the wallet
   * - `'in'` — recorded with the wallet as the recipient
   */
  direction?: 'in' | 'out';
}

/**
 * Filters for the `auto_account` family.
 *
 * `customer_id` is required: the server rejects
 * `transaction_type=auto_account` without one with a 400.
 */
export interface AutoAccountTransactionListParams extends TransactionListParamsBase {
  transaction_type: 'auto_account';
  customer_id: string;
}

/**
 * Transaction list parameters, discriminated by family.
 *
 * `GET /transactions` serves three families from one path and infers the
 * family from the filters when `transaction_type` is absent — so the type is
 * a union rather than one bag of optional fields, and a wallet-only filter
 * cannot be written without naming the wallet family.
 */
export type TransactionListParams =
  | OneOffTransactionListParams
  | WalletTransactionListParams
  | AutoAccountTransactionListParams;

/**
 * Auto-transaction list parameters.
 *
 * `statuses` and `types` take a COMMA-SEPARATED string, not an array. Dates
 * are Unix epoch SECONDS, not ISO strings — unlike every other list endpoint
 * here.
 */
export interface AutoTransactionListParams extends ListParams {
  auto_account_id?: string;
  destination_id?: string;
  status?: TransactionStatus;
  /** Several statuses at once, comma-separated (e.g. `'pending,processing'`). */
  statuses?: string;
  type?: string;
  /** Several types at once, comma-separated (e.g. `'onramp,offramp'`). */
  types?: string;
  provider_id?: string;
  source_crypto_address?: string;
  destination_crypto_address?: string;
  source_network_id?: string;
  destination_network_id?: string;
  transaction_hash?: string;
  /** Created on or after this instant. Epoch SECONDS. */
  start_date?: number;
  /** Created on or before this instant. Epoch SECONDS. */
  end_date?: number;
  input_asset?: string;
  destination_asset?: string;
  /** Decimal string, e.g. `'100.00'`. */
  outgoing_amount_min?: string;
  /** Decimal string, e.g. `'5000.00'`. */
  outgoing_amount_max?: string;
  /** Only `created_at` is supported today, which is also the default. */
  sort_by?: 'created_at';
  /** Defaults to `desc`. */
  sort_dir?: 'asc' | 'desc';
}

/** Destination list parameters. */
export interface DestinationListParams extends ListParams {
  destination_type?: 'crypto' | 'fiat_us' | 'fiat_iban';
}

/** User list parameters. */
export interface UserListParams extends ListParams {
  /** Fuzzy match across first/last name, email, and user id. */
  search?: string;
  /** ISO 8601, e.g. `'2026-01-01T00:00:00Z'`. */
  created_at_from?: string;
  /** ISO 8601, e.g. `'2026-12-31T23:59:59Z'`. */
  created_at_to?: string;
  /** One or more roles, comma-separated (e.g. `'admin,member'`). */
  roles?: string;
  /** Defaults to `created_at`. */
  sort_by?: 'created_at' | 'email' | 'name' | 'role';
  /** Defaults to `desc`. */
  sort_dir?: 'asc' | 'desc';
}

/**
 * Which extra sections to inline on an application read.
 *
 * Comma-separated, e.g. `'entities,validation'`, or `'all'`. Each section adds
 * weight to the response — `'all'` carries the full KYB record, including every
 * associated individual's date of birth, nationality and email — so ask for
 * what the page renders rather than defaulting to `'all'`.
 *
 * To render an accept-agreements page, use
 * {@link ApplicationsResource.getLegalAcceptance} instead: it returns exactly
 * that page's inputs and none of the personal data.
 */
export interface ApplicationGetParams {
  include?: string;
}

/** Event list parameters */
export interface EventListParams extends ListParams {
  event_type?: string;
}

// ============================================================================
// Agentic Payments (ALPHA)
// ============================================================================
//
// Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
// and may change without a major-version bump.

/** Payment agent (hosted signer that drafts payments on a customer's behalf) */
export type PaymentAgent = components['schemas']['PaymentAgentResponse'];

/** Payment agent creation request */
export type PaymentAgentCreateRequest = components['schemas']['CreatePaymentAgentRequest'];

/** Slim reference to a signer group an agent's signer still belongs to (returned by revoke). */
export type PaymentAgentSignerGroupRef = components['schemas']['PaymentAgentSignerGroupRef'];

/** A single reviewable action series drafted by an agent. */
export type AgenticProposal = components['schemas']['AgenticProposal'];

/** One tagged action inside an AgenticProposal. */
export type AgenticAction = components['schemas']['AgenticAction'];

/** Per-action downstream artifacts produced by actuation. */
export type AgenticActionDownstream = components['schemas']['AgenticActionDownstream'];

/** The result of POST /payment-agents/{id}/proposals. */
export type AgenticProposalsResult = components['schemas']['AgenticProposalsResult'];

/** Request body for POST /payment-agents/{id}/proposals. */
export type CreateProposalsRequest = components['schemas']['CreateProposalsRequest'];

/** Request body for POST /instructions. */
export type CreateInstructionsRequest = components['schemas']['CreateInstructionsRequest'];

/** A persisted, actuated instruction (the accepted proposal). */
export type AgenticInstruction = components['schemas']['AgenticInstruction'];

/** The result of POST /instructions — instruction_ids + the mandates the batch drafted. */
export type AgenticInstructionsResult = components['schemas']['AgenticInstructionsResult'];

/** A mandate — the §8 authorization a customer signs to arm scheduled payments. */
export type Mandate = components['schemas']['Mandate'];

/** Mandate rule — the spend authorization the customer approves. */
export type MandateRule = components['schemas']['MandateRule'];

/** Slim mandate response (approve/cancel). */
export type MandateResponse = components['schemas']['MandateResponse'];

/** Request body for POST /mandates — draft a mandate from a direct user interaction. */
export type CreateMandateRequest = components['schemas']['CreateMandateRequest'];

/** Request body for POST /mandates/{id}/approve. */
export type ApproveMandateRequest = components['schemas']['ApproveMandateRequest'];

/** Request body for POST /mandates/{id}/cancel. */
export type CancelMandateRequest = components['schemas']['CancelMandateRequest'];

/** Request body for POST /mandates/{id}/amend — a signed NEW version of the rule. */
export type AmendMandateRequest = components['schemas']['AmendMandateRequest'];

/** One immutable, independently signed version of a mandate's rule. */
export type MandateVersion = components['schemas']['MandateVersion'];

/**
 * A mandate's remaining spend budget at a point in time.
 *
 * Advisory: nothing here reserves budget, and the mandate gate remains the
 * authority at fire time.
 */
export type MandateBudget = components['schemas']['MandateBudget'];

/** One budget line — a window bucket, what it has spent, and what is left. */
export type MandateBudgetLine = components['schemas']['MandateBudgetLine'];

/** Live snapshot of an in-flight proposal-drafting turn (advisory display only). */
export type AgenticProposalsProgress = components['schemas']['AgenticProposalsProgress'];

/**
 * One machine-actionable reason a drafting turn could not complete — for the
 * CLIENT APPLICATION, not the customer.
 *
 * `reply` explains the same thing in prose, which software cannot branch on.
 * Always switch on `code` and IGNORE codes you do not recognize: new ones are
 * added over time.
 */
export type AgenticBlocker = components['schemas']['AgenticBlocker'];

/** The stable `code` of an {@link AgenticBlocker}. Treat as an OPEN set. */
export type AgenticBlockerCode = NonNullable<AgenticBlocker['code']>;

/**
 * How THIS client's product speaks, and what the agent may propose for it.
 *
 * Reshapes what the drafting model sees and constrains what it may propose,
 * so the agent narrates in your nouns instead of the platform's. Register it
 * ONCE via `client.agenticPolicy.set(policy)`; sending it per
 * request is a development override that wins for that turn only.
 *
 * STRICT — an unknown key, an unknown value, or a label for a concept the
 * server does not implement is a 400, so "accepted" always means "enforced".
 */
export type AgenticClientPolicy = components['schemas']['AgenticClientPolicy'];

/**
 * A client's registered policy plus its registration timestamps.
 *
 * `policy` is the NORMALIZED form — what the server will actually apply, not
 * an echo of what was sent (values meaning "the default" are normalized away).
 */
export type RegisteredAgenticClientPolicy = components['schemas']['RegisteredAgenticClientPolicy'];

/**
 * Your developer fee, declared per payout type: `swap_bps` for a crypto
 * payout, `offramp_bps` for a bank payout.
 *
 * The two are independent — omit one (or send zero) and that payout type
 * carries no fee at all, and the agent is told nothing about a fee it could
 * mention. Both are DEFAULTS for the auto-accounts a request creates; an
 * action-level `fee_bps` still wins outright.
 */
export type DeveloperFee = components['schemas']['DeveloperFee'];

/** A scheduled payment — bookkeeping row created by accepting an instruction. */
export type ScheduledPayment = components['schemas']['ScheduledPaymentResponse'];

/** Request body for POST /scheduled-payments — direct (signer-first) schedule create. */
export type CreateScheduledPaymentRequest = components['schemas']['CreateScheduledPaymentRequest'];

/** The customer's account insight report (deterministic, read-only). */
export type InsightReport = components['schemas']['InsightReport'];

/** One observation or suggestion inside an InsightReport. `kind` is an OPEN set. */
export type InsightItem = components['schemas']['InsightItem'];

/** Typed reference to the platform object an insight was computed from. */
export type InsightEvidence = components['schemas']['InsightEvidence'];

/** The typed-facts snapshot inside an InsightReport. */
export type InsightSnapshot = components['schemas']['InsightSnapshot'];

/** Parameters for listing mandates. */
export interface MandateListParams extends ListParams {
  customer_id?: string;
  signer_id?: string;
  /**
   * Effective status(es) to include. Accepts a single status or a
   * comma-separated combination, e.g. 'active,expired'. Omit for all.
   */
  status?: NonNullable<Mandate['status']> | (string & NonNullable<unknown>);
}

/** Parameters for listing scheduled payments. */
export interface ScheduledPaymentListParams extends ListParams {
  customer_id?: string;
  signer_id?: string;
  wallet_id?: string;
  mandate_id?: string;
  /**
   * Status(es) to include. Accepts a single status or a comma-separated
   * combination, e.g. 'scheduled,executed'. Omit for all.
   */
  status?: NonNullable<ScheduledPayment['status']> | (string & NonNullable<unknown>);
  /**
   * Only payments that executed under this VERSION of the mandate — "which
   * payments were judged against v2's caps".
   *
   * Use together with `mandate_id`, and like it this matches EXECUTED rows
   * only: the version is stamped at fire time, so a scheduled-but-unfired row
   * carries none.
   */
  mandate_version?: number;
  /**
   * 1-based page number, used only alongside `limit`.
   *
   * On its own it has nothing to page through and is ignored. A page past the
   * end is an empty list, not an error.
   *
   * Note this endpoint returns EVERY matching payment when `limit` is omitted
   * — the iterator's usual cursor paging does not apply here.
   */
  page?: number;
}
