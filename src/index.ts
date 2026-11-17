/**
 * Dakota TypeScript SDK
 *
 * Official TypeScript SDK for the Dakota Platform - stablecoin payments infrastructure.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { DakotaClient, Environment } from 'dakota-ts-sdk';
 *
 * const client = new DakotaClient({
 *   apiKey: 'your_api_key',
 *   environment: Environment.Sandbox,
 * });
 *
 * // List customers
 * for await (const customer of client.customers.list()) {
 *   console.log(customer.name);
 * }
 * ```
 */

// Main client
export { DakotaClient } from './client/client.js';

// Configuration
export { Environment, getEnvironmentURL } from './client/environment.js';

export {
  type DakotaClientConfig,
  type ResolvedConfig,
  type RetryPolicy,
  type Logger,
  AuthMode,
  DEFAULT_RETRY_POLICY,
  noopLogger,
  consoleLogger,
} from './client/config.js';

// Errors
export {
  APIError,
  TransportError,
  ConfigurationError,
  EndorsementRequiredError,
  InsufficientEndorsementsError,
  StaleSignerGroupVersionError,
  BelowThresholdError,
  InvalidGoverningGroupError,
} from './client/errors.js';

// Pagination
export {
  PaginatedIterator,
  paginate,
  type PaginationMeta,
  type PaginatedResponse,
  type PaginationParams,
  type PageFetcher,
  type CursorExtractor,
} from './client/pagination.js';

// Types
export * from './client/types.js';

// Re-export resources for advanced usage
export {
  CustomersResource,
  RecipientsResource,
  DestinationsResource,
  AccountsResource,
  TransactionsResource,
  AutoTransactionsResource,
  WalletsResource,
  EventsResource,
  ApplicationsResource,
  PoliciesResource,
  SignerGroupsResource,
  SignersResource,
  ApiKeysResource,
  UsersResource,
  WebhooksResource,
  InfoResource,
  SandboxResource,
  SelfServeResource,
  FeePayoutDestinationResource,
  PaymentAgentsResource,
  InstructionsResource,
  MandatesResource,
  ScheduledPaymentsResource,
  InsightsResource,
  AgenticPolicyResource,
  type AccountListParams,
} from './client/resources/index.js';

// Agentic Payments (ALPHA) high-level helpers
export {
  AgentConversation,
  type AgentConversationOptions,
  type Attachment,
  type AttachmentMediaType,
  type ChatMessage,
  type ConversationTurn,
  attachUserToWallet,
  detachUserFromWallet,
  P256MandateSigner,
  type MandateAction,
  type MandateSigner,
  addPolicyRulePayload,
  attachGroupPayload,
  attachPolicyPayload,
  deletePolicyPayload,
  detachGroupPayload,
  detachPolicyPayload,
  mandateAmendSignPayload,
  mandateSignPayload,
  removePolicyRulePayload,
  updatePolicyRulePayload,
  verifyMandateSignature,
  canonicalJSON,
} from './agentic/index.js';

// ES256 signing (Node), shared by governance and mandates.
export { ES256Signer, verifyES256Signature } from './signing/es256.js';

// Signer-group governance: canonical intents, passkey (WebAuthn) packaging,
// ES256 signers. Also published on its own, browser-safe, as
// `@dakota-xyz/ts-sdk/governance`.
export {
  addSignersToGroupIntent,
  assertIdempotencyKey,
  createCryptoDestinationIntent,
  newIdempotencyKey,
  removeSignersFromGroupIntent,
  updateSignerGroupGovernanceIntent,
  assertionChallengeMatches,
  buildChallenge,
  packAssertion,
  webauthnSigner,
  signGovernanceIntent,
  webCryptoES256Signer,
  type AddSignersToGroupIntent,
  type AssertionCredential,
  type BinaryOrBase64,
  type CanonicalIntent,
  type CreateCryptoDestinationIntent,
  type GovernanceIntent,
  type GovernanceSigner,
  type GovernanceSignerLike,
  type RemoveSignersFromGroupIntent,
  type SubtleCryptoLike,
  type UpdateSignerGroupGovernanceIntent,
} from './governance/index.js';
