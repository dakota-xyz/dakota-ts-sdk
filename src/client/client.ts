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
  SandboxResource,
} from './resources/index.js';

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
  /** Sandbox API - testing simulations (sandbox only) */
  readonly sandbox: SandboxResource;

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
    this.sandbox = new SandboxResource(this.transport);
  }

  /**
   * Get the resolved base URL.
   */
  get baseURL(): string {
    return this.config.baseURL;
  }
}
