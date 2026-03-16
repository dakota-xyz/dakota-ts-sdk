/**
 * API Keys resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type { ApiKey, ApiKeyCreateRequest, ListParams } from '../types.js';

/**
 * API Keys API resource.
 */
export class ApiKeysResource extends BaseResource {
  /**
   * Create a new API key.
   *
   * @param data - API key creation data
   * @returns Created API key (includes secret, only shown once)
   */
  async create(data: ApiKeyCreateRequest): Promise<ApiKey & { secret: string }> {
    return this.transport.request<ApiKey & { secret: string }>({
      method: 'POST',
      path: '/api-keys',
      body: data,
    });
  }

  /**
   * List API keys.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of API keys
   */
  list(params?: ListParams): PaginatedIterator<ApiKey> {
    return this.paginate<ApiKey>('/api-keys', params);
  }

  /**
   * Delete an API key.
   *
   * @param apiKeyId - API key ID
   */
  async delete(apiKeyId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/api-keys/${apiKeyId}`,
    });
  }
}
