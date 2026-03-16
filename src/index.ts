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
export { APIError, TransportError, ConfigurationError } from './client/errors.js';

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
  type AccountListParams,
} from './client/resources/index.js';
