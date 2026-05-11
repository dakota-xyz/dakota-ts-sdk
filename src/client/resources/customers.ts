/**
 * Customers resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  BulkImportSumsubTokensRequest,
  BulkImportSumsubTokensResponse,
  Customer,
  CustomerCreateRequest,
  CustomerCreateResponse,
  CustomerListParams,
  RequestOptions,
  SubClientSummary,
  UpdateCustomerSubClientRequest,
} from '../types.js';

/**
 * Customers API resource.
 */
export class CustomersResource extends BaseResource {
  /**
   * Create a new customer.
   *
   * Creates a customer record and initiates KYB onboarding.
   * Returns a URL where the customer can complete verification.
   *
   * @param data - Customer creation data
   * @param options - Request options (e.g., custom idempotency key)
   * @returns Created customer with KYB onboarding URL
   *
   * @example
   * ```typescript
   * const customer = await client.customers.create({
   *   name: 'Acme Corp',
   *   customerType: 'business',
   *   externalId: 'your-internal-id',
   * });
   *
   * // With custom idempotency key
   * const customer = await client.customers.create(
   *   { name: 'Acme Corp', customerType: 'business' },
   *   { idempotencyKey: 'create-acme-corp-001' }
   * );
   * console.log(customer.applicationUrl); // KYB onboarding URL
   * ```
   */
  async create(
    data: CustomerCreateRequest,
    options?: RequestOptions
  ): Promise<CustomerCreateResponse> {
    return this.transport.request<CustomerCreateResponse>({
      method: 'POST',
      path: '/customers',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * List all customers.
   *
   * Returns a paginated async iterator over customer records.
   *
   * @param params - Optional filter and pagination parameters
   * @returns Async iterator of customers
   *
   * @example
   * ```typescript
   * // Iterate through all customers
   * for await (const customer of client.customers.list()) {
   *   console.log(customer.name);
   * }
   *
   * // With filters
   * const active = client.customers.list({ kyb_status: 'active' });
   *
   * // Collect all to array
   * const all = await client.customers.list().toArray();
   * ```
   */
  list(params?: CustomerListParams): PaginatedIterator<Customer> {
    return this.paginate<Customer>('/customers', params);
  }

  /**
   * Get a customer by ID.
   *
   * @param customerId - Customer ID (KSUID)
   * @returns Customer record
   *
   * @example
   * ```typescript
   * const customer = await client.customers.get('cust_abc123');
   * console.log(customer.kybStatus);
   * ```
   */
  async get(customerId: string): Promise<Customer> {
    return this.transport.request<Customer>({
      method: 'GET',
      path: `/customers/${customerId}`,
    });
  }

  /**
   * Update the sub-client association for a customer.
   *
   * Associates or disassociates a customer with a sub-client.
   * Set `sub_client_id` to associate, or set it to `null` to disassociate.
   *
   * @param customerId - Customer ID (KSUID)
   * @param data - Sub-client association data
   * @param options - Request options (e.g., custom idempotency key)
   * @returns Updated customer record
   *
   * @example
   * ```typescript
   * // Associate customer with a sub-client
   * const customer = await client.customers.updateSubClient('cust_abc123', {
   *   sub_client_id: 'cust_sub456',
   * });
   *
   * // Disassociate customer from sub-client
   * const customer = await client.customers.updateSubClient('cust_abc123', {
   *   sub_client_id: null,
   * });
   * ```
   */
  async updateSubClient(
    customerId: string,
    data: UpdateCustomerSubClientRequest,
    options?: RequestOptions
  ): Promise<Customer> {
    return this.transport.request<Customer>({
      method: 'PATCH',
      path: `/customers/${customerId}/sub-client`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Get a summary of all sub-clients and their associated customer counts.
   *
   * @returns Array of sub-client summaries
   *
   * @example
   * ```typescript
   * const summaries = await client.customers.getSubClientSummary();
   * for (const summary of summaries) {
   *   console.log(`${summary.sub_client_name}: ${summary.customer_count} customers`);
   * }
   * ```
   */
  async getSubClientSummary(): Promise<SubClientSummary[]> {
    const response = await this.transport.request<{ data: SubClientSummary[] }>({
      method: 'GET',
      path: '/customers/sub-client-summary',
    });
    return response.data;
  }

  /**
   * Bulk-import customers from Sumsub share tokens.
   *
   * Exchanges one or more Sumsub share tokens for Dakota customers + applications.
   * The response surfaces per-token results — individual tokens can fail while
   * others succeed.
   *
   * @param data - Bulk-import request containing the share tokens to redeem
   * @param options - Request options (e.g., custom idempotency key)
   * @returns Bulk-import summary with per-token results
   *
   * @example
   * ```typescript
   * const result = await client.customers.bulkImportFromSumsubTokens({
   *   tokens: ['_act-sbx-jwt-...', '_act-sbx-jwt-...'],
   * });
   * console.log(`Imported ${result.succeeded}/${result.total}`);
   * for (const r of result.results ?? []) {
   *   if (!r.success) console.error(r.name, r.error);
   * }
   * ```
   */
  async bulkImportFromSumsubTokens(
    data: BulkImportSumsubTokensRequest,
    options?: RequestOptions
  ): Promise<BulkImportSumsubTokensResponse> {
    return this.transport.request<BulkImportSumsubTokensResponse>({
      method: 'POST',
      path: '/customers/bulk-import-sumsub-tokens',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
