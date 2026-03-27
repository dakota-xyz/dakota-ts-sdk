/**
 * Customers resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  Customer,
  CustomerCreateRequest,
  CustomerCreateResponse,
  CustomerListParams,
  RequestOptions,
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
  async create(data: CustomerCreateRequest, options?: RequestOptions): Promise<CustomerCreateResponse> {
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
}
