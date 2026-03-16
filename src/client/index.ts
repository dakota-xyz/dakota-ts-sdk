/**
 * Client module exports.
 */

export { DakotaClient } from './client.js';
export { Environment, getEnvironmentURL } from './environment.js';
export {
  type DakotaClientConfig,
  type ResolvedConfig,
  type RetryPolicy,
  type Logger,
  AuthMode,
  DEFAULT_RETRY_POLICY,
  noopLogger,
  consoleLogger,
} from './config.js';
export { APIError, TransportError, ConfigurationError } from './errors.js';
export {
  PaginatedIterator,
  paginate,
  type PaginationMeta,
  type PaginatedResponse,
  type PaginationParams,
  type PageFetcher,
  type CursorExtractor,
} from './pagination.js';

// Re-export types
export * from './types.js';

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
} from './resources/index.js';
