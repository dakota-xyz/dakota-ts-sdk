/**
 * Dakota Platform API Client.
 */

import { DakotaClientConfig, ResolvedConfig, resolveConfig } from './config.js';
import { Transport } from './transport.js';
import {
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
  LegalResource,
  RDMarketingFeeResource,
  SandboxResource,
  SelfServeResource,
  FeePayoutDestinationResource,
  PaymentAgentsResource,
  InstructionsResource,
  MandatesResource,
  ScheduledPaymentsResource,
  InsightsResource,
  AgenticPolicyResource,
} from './resources/index.js';
import {
  AgentConversation,
  type AgentConversationOptions,
  type ChatMessage,
} from '../agentic/chat.js';
import {
  attachUserToWallet as attachUserToWalletHelper,
  detachUserFromWallet as detachUserFromWalletHelper,
} from '../agentic/wallets.js';

/**
 * Dakota Platform API Client.
 *
 * The main entry point for interacting with the Dakota Platform API.
 *
 * @example
 * ```typescript
 * import { DakotaClient, Environment } from 'dakota-ts-sdk';
 *
 * const client = new DakotaClient({
 *   apiKey: 'your_api_key',
 *   environment: Environment.Sandbox, // default
 * });
 *
 * // List customers
 * for await (const customer of client.customers.list()) {
 *   console.log(customer.name);
 * }
 *
 * // Create a customer
 * const customer = await client.customers.create({
 *   name: 'Acme Corp',
 *   customer_type: 'business',
 * });
 * ```
 */
export class DakotaClient {
  private readonly config: ResolvedConfig;
  private readonly transport: Transport;

  // API Resources
  /** Customers API - manage customer records and KYB */
  readonly customers: CustomersResource;
  /** Recipients API - manage payment recipients */
  readonly recipients: RecipientsResource;
  /** Destinations API - manage bank accounts and crypto wallets */
  readonly destinations: DestinationsResource;
  /** Accounts API - manage on-ramp, off-ramp, and swap accounts */
  readonly accounts: AccountsResource;
  /** Transactions API - manage one-off transactions */
  readonly transactions: TransactionsResource;
  /** Auto Transactions API - manage automated transactions */
  readonly autoTransactions: AutoTransactionsResource;
  /** Wallets API - manage non-custodial wallets */
  readonly wallets: WalletsResource;
  /** Events API - query platform events */
  readonly events: EventsResource;
  /** Applications API - manage KYB applications */
  readonly applications: ApplicationsResource;
  /** Policies API - manage transaction policies */
  readonly policies: PoliciesResource;
  /** Signer Groups API - manage multi-sig signer groups */
  readonly signerGroups: SignerGroupsResource;
  /** Signers API - manage individual signers */
  readonly signers: SignersResource;
  /** API Keys API - manage API keys */
  readonly apiKeys: ApiKeysResource;
  /** Users API - manage platform users */
  readonly users: UsersResource;
  /** Webhooks API - manage webhook targets and events */
  readonly webhooks: WebhooksResource;
  /** Info API - query platform capabilities */
  readonly info: InfoResource;
  /** Legal API - the published terms customers accept (unauthenticated) */
  readonly legal: LegalResource;
  /** RD Marketing Fee API - this client's reserve-management statements */
  readonly rdMarketingFee: RDMarketingFeeResource;
  /** Sandbox API - testing simulations (sandbox only) */
  readonly sandbox: SandboxResource;
  /** Self-Serve Credits API - manage prepaid transfer credits */
  readonly selfServe: SelfServeResource;
  /** Fee Payout Destination API - where Dakota pays your accrued developer fees */
  readonly feePayoutDestination: FeePayoutDestinationResource;
  /** Payment Agents API (ALPHA) - hosted signing agents that draft payments */
  readonly paymentAgents: PaymentAgentsResource;
  /** Instructions API (ALPHA) - accept and inspect actuated proposals */
  readonly instructions: InstructionsResource;
  /** Mandates API (ALPHA) - the §8 authorizations that arm scheduled payments */
  readonly mandates: MandatesResource;
  /** Scheduled Payments API (ALPHA) - schedule rows created from instructions */
  readonly scheduledPayments: ScheduledPaymentsResource;
  /** Insights API (ALPHA) - read-only advisory reporting over agentic activity */
  readonly insights: InsightsResource;
  /** Agentic Policy API (ALPHA) - register the vocabulary the agent speaks for your product */
  readonly agenticPolicy: AgenticPolicyResource;

  /**
   * Create a new Dakota client.
   *
   * @param config - Client configuration
   * @throws ConfigurationError if configuration is invalid
   *
   * @example
   * ```typescript
   * // Basic usage (sandbox)
   * const client = new DakotaClient({
   *   apiKey: 'your_api_key',
   * });
   *
   * // Production
   * const client = new DakotaClient({
   *   apiKey: 'your_production_api_key',
   *   environment: Environment.Production,
   * });
   *
   * // With custom configuration
   * const client = new DakotaClient({
   *   apiKey: 'your_api_key',
   *   timeout: 30000,
   *   retryPolicy: {
   *     maxAttempts: 5,
   *     initialBackoffMs: 100,
   *     maxBackoffMs: 5000,
   *   },
   *   logger: console,
   * });
   * ```
   */
  constructor(config: DakotaClientConfig) {
    this.config = resolveConfig(config);
    this.transport = new Transport(this.config);

    // Initialize resources
    this.customers = new CustomersResource(this.transport);
    this.recipients = new RecipientsResource(this.transport);
    this.destinations = new DestinationsResource(this.transport);
    this.accounts = new AccountsResource(this.transport);
    this.transactions = new TransactionsResource(this.transport);
    this.autoTransactions = new AutoTransactionsResource(this.transport);
    this.wallets = new WalletsResource(this.transport);
    this.events = new EventsResource(this.transport);
    this.applications = new ApplicationsResource(this.transport);
    this.policies = new PoliciesResource(this.transport);
    this.signerGroups = new SignerGroupsResource(this.transport);
    this.signers = new SignersResource(this.transport);
    this.apiKeys = new ApiKeysResource(this.transport);
    this.users = new UsersResource(this.transport);
    this.webhooks = new WebhooksResource(this.transport);
    this.info = new InfoResource(this.transport);
    this.legal = new LegalResource(this.transport);
    this.rdMarketingFee = new RDMarketingFeeResource(this.transport);
    this.sandbox = new SandboxResource(this.transport);
    this.selfServe = new SelfServeResource(this.transport);
    this.feePayoutDestination = new FeePayoutDestinationResource(this.transport);
    this.paymentAgents = new PaymentAgentsResource(this.transport);
    this.instructions = new InstructionsResource(this.transport);
    this.mandates = new MandatesResource(this.transport);
    this.scheduledPayments = new ScheduledPaymentsResource(this.transport);
    this.insights = new InsightsResource(this.transport);
    this.agenticPolicy = new AgenticPolicyResource(this.transport);
  }

  // ==========================================================================
  // Agentic Payments high-level helpers (ALPHA)
  //
  // Collapse the multi-step, crypto-heavy hosted-agent flows into single
  // calls with good defaults. The raw operations remain reachable via
  // `signerGroups.addSigner` / `signerGroups.removeSigner` and friends.
  // ==========================================================================

  /**
   * Start a fresh multi-turn conversation with a payment agent.
   *
   * Pass `{ timezone }` (an IANA zone) so the agent resolves "tomorrow" and
   * "10 am" in the customer's local time rather than UTC. The conversation
   * resends it on every turn.
   *
   * @see AgentConversation
   */
  newAgentConversation(
    paymentAgentId: string,
    options?: AgentConversationOptions
  ): AgentConversation {
    return new AgentConversation(this, paymentAgentId, undefined, options);
  }

  /**
   * Rebuild a conversation from a persisted transcript (oldest first) —
   * for backends that store the history between requests.
   *
   * A stateless backend must pass `{ timezone }` again here: the transcript
   * carries the messages, not the zone.
   */
  resumeAgentConversation(
    paymentAgentId: string,
    history: ChatMessage[],
    options?: AgentConversationOptions
  ): AgentConversation {
    return new AgentConversation(this, paymentAgentId, history, options);
  }

  /**
   * Grant a principal (user or agent — both are just signers) permission to
   * spend from a wallet by adding its signer to an EXISTING signer group on
   * that wallet. Idempotent; errors if the group isn't attached to the wallet.
   *
   * @see attachUserToWallet in `agentic/wallets.ts` for the full contract.
   */
  attachUserToWallet(
    walletId: string,
    signerPublicKey: string,
    spendingGroupId: string,
    options?: { idempotencyKey?: string }
  ): Promise<{ alreadyMember: boolean }> {
    return attachUserToWalletHelper(this, walletId, signerPublicKey, spendingGroupId, options);
  }

  /**
   * Revoke a principal's spend permission by removing its signer from the
   * given signer group — the inverse of {@link attachUserToWallet}.
   * Idempotent; errors if the group isn't attached to the wallet.
   *
   * @see detachUserFromWallet in `agentic/wallets.ts` for the full contract.
   */
  detachUserFromWallet(
    walletId: string,
    signerPublicKey: string,
    spendingGroupId: string,
    options?: { idempotencyKey?: string }
  ): Promise<{ wasMember: boolean }> {
    return detachUserFromWalletHelper(this, walletId, signerPublicKey, spendingGroupId, options);
  }

  /**
   * Get the resolved base URL.
   */
  get baseURL(): string {
    return this.config.baseURL;
  }
}
