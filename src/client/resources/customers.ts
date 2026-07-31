/**
 * Customers resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  BulkImportSumsubTokensRequest,
  BulkImportSumsubTokensResponse,
  Customer,
  CustomerCapabilities,
  CustomerCreateRequest,
  CustomerCreateResponse,
  CustomerListParams,
  CustomerReEngagementResponse,
  ImportPersonaTokensRequest,
  ImportPersonaTokensResponse,
  PersonaImportJob,
  PersonaImportJobListParams,
  PersonaImportJobParams,
  PersonaImportJobsPage,
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
   *
   * // Designate as a sub-client at creation (ENG-2454).
   * // `is_sub_client` can only be set here — a regular customer cannot
   * // be promoted afterwards. Cannot be combined with `sub_client_id`.
   * const subClient = await client.customers.create({
   *   name: 'Partner Corp',
   *   customer_type: 'business',
   *   is_sub_client: true,
   * });
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
      timeout: options?.timeout,
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
   * Delete a customer record.
   *
   * Soft-deletes the customer. Blocked with a 409 if the customer still has
   * associated accounts, or is referenced as a sub-client by another customer.
   *
   * @param customerId - Customer ID (KSUID)
   *
   * @example
   * ```typescript
   * await client.customers.delete('cust_abc123');
   * ```
   */
  async delete(customerId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/customers/${customerId}`,
    });
  }

  /**
   * List a customer's capabilities and what is still needed to unlock each.
   *
   * Returns the customer's rails (e.g. `international_wire`) with a status and
   * the OUTSTANDING requirements — terms to accept, documents to upload — that
   * gate them. Partner-agnostic: requirements are keyed by an opaque terms id
   * or document type, never a provider or partner name.
   *
   * @param customerId - Customer ID (KSUID)
   * @returns The customer's capabilities and their outstanding requirements
   *
   * @example
   * ```typescript
   * const { capabilities } = await client.customers.getCapabilities(customerId);
   * for (const cap of capabilities) {
   *   if (cap.status !== 'action_required') continue;
   *   for (const req of cap.requirements) {
   *     console.log(`${cap.capability}: ${req.title} → ${req.url}`);
   *   }
   * }
   * ```
   */
  async getCapabilities(customerId: string): Promise<CustomerCapabilities> {
    return this.transport.request<CustomerCapabilities>({
      method: 'GET',
      path: `/customers/${customerId}/capabilities`,
    });
  }

  /**
   * Mint a fresh application link for re-engaging an APPROVED customer.
   *
   * Issues a new onboarding token for an existing approved customer's
   * application and returns the rebuilt `application_url` — use it when the
   * original token has expired and the customer needs to come back through
   * the hosted flow (e.g. to accept outstanding partner disclosures).
   *
   * @param customerId - Customer ID (KSUID)
   * @param options - Request options (e.g., custom idempotency key)
   * @returns The rebuilt application URL
   *
   * @example
   * ```typescript
   * const { application_url } = await client.customers.reEngage(customerId);
   * ```
   */
  async reEngage(
    customerId: string,
    options?: RequestOptions
  ): Promise<CustomerReEngagementResponse> {
    return this.transport.request<CustomerReEngagementResponse>({
      method: 'POST',
      path: `/customers/${customerId}/re-engagement`,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * Update the sub-client association for a customer.
   *
   * Associates or disassociates a customer with a sub-client.
   * Set `sub_client_id` to associate, or set it to `null` to disassociate.
   *
   * @deprecated The sub-client association can only be set when a customer is
   * created (`is_sub_client` / `sub_client_id` on `create`) and can no longer
   * be changed afterwards — this endpoint now returns 400.
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
      timeout: options?.timeout,
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
      timeout: options?.timeout,
    });
  }

  /**
   * Import customers from Persona Connect share tokens (`cnst_...`).
   *
   * Unlike the Sumsub import, Persona redemption is asynchronous on Persona's
   * side, so this returns a JOB immediately (HTTP 202). Poll
   * `getPersonaImportJob` for per-token results. Up to 5,000 tokens per
   * request — split larger migrations into multiple batches.
   *
   * Tokens are validated and de-duplicated up front, and a skipped token
   * never blocks an accepted one. A `skipped` entry is about the token STRING
   * (malformed, duplicated in the batch, or already imported) — it is never a
   * compliance decision about a person or application.
   *
   * @param data - The share tokens to import
   * @param options - Request options (e.g., custom idempotency key)
   * @returns The queued job, with any tokens that could not be enqueued
   *
   * @example
   * ```typescript
   * const job = await client.customers.importPersonaTokens({
   *   tokens: ['cnst_ABC123def456', 'cnst_GHI789jkl012'],
   * });
   * console.log(`${job.accepted}/${job.total} queued as ${job.job_id}`);
   * ```
   */
  async importPersonaTokens(
    data: ImportPersonaTokensRequest,
    options?: RequestOptions
  ): Promise<ImportPersonaTokensResponse> {
    return this.transport.request<ImportPersonaTokensResponse>({
      method: 'POST',
      path: '/customers/import-persona-tokens',
      body: data,
      idempotencyKey: options?.idempotencyKey,
      timeout: options?.timeout,
    });
  }

  /**
   * List this client's Persona share-token import jobs, newest first.
   *
   * This endpoint pages on its own cursor (`starting_after` + `has_more`), not
   * the standard list envelope, so it returns a single page rather than an
   * async iterator.
   *
   * @param params - Optional `limit` and `starting_after` job-id cursor
   * @returns One page of job summaries plus a `has_more` flag
   *
   * @example
   * ```typescript
   * const { jobs, has_more } = await client.customers.listPersonaImportJobs({ limit: 20 });
   * ```
   */
  async listPersonaImportJobs(params?: PersonaImportJobListParams): Promise<PersonaImportJobsPage> {
    return this.transport.request<PersonaImportJobsPage>({
      method: 'GET',
      path: '/customers/persona-import-jobs',
      query: { ...params },
    });
  }

  /**
   * Get a Persona import job's status and its per-token results.
   *
   * Result rows page on a row-index cursor: pass the last row's `index` as
   * `results_after_index` while `has_more_results` is true.
   *
   * @param jobId - Import job ID (`pij_...`)
   * @param params - Optional `results_limit` (1-500) and `results_after_index`
   * @returns Job status, row counts, and one page of result rows
   *
   * @example
   * ```typescript
   * let after: number | undefined;
   * do {
   *   const job = await client.customers.getPersonaImportJob(jobId, {
   *     results_after_index: after,
   *   });
   *   for (const row of job.results ?? []) {
   *     if (row.state === 'failed') console.error(row.token, row.error);
   *     after = row.index;
   *   }
   *   if (!job.has_more_results) break;
   * } while (true);
   * ```
   */
  async getPersonaImportJob(
    jobId: string,
    params?: PersonaImportJobParams
  ): Promise<PersonaImportJob> {
    return this.transport.request<PersonaImportJob>({
      method: 'GET',
      path: `/customers/persona-import-jobs/${jobId}`,
      query: { ...params },
    });
  }
}
