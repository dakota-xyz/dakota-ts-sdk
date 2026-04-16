/**
 * API Keys resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  ApiKey,
  ApiKeyResponse,
  ApiKeyCreateRequest,
  CreateApiKeyForClientRequest,
  ListParams,
  RequestOptions,
} from '../types.js';

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
  async create(data: ApiKeyCreateRequest, options?: RequestOptions): Promise<ApiKeyResponse> {
    return this.transport.request<ApiKeyResponse>({
      method: 'POST',
      path: '/api-keys',
      body: data,
      idempotencyKey: options?.idempotencyKey,
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

  /**
   * Delete all API keys.
   *
   * Intended for incident response only.
   */
  async deleteAll(): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: '/api-keys',
    });
  }

  /**
   * Create an API key for a specific client (admin only).
   *
   * Requires admin access token.
   *
   * @param data - Request data containing `client_id`
   * @param options - Request options
   * @returns Created API key response (includes key, only shown once)
   */
  async createForClient(
    data: CreateApiKeyForClientRequest,
    options?: RequestOptions
  ): Promise<ApiKeyResponse> {
    return this.transport.request<ApiKeyResponse>({
      method: 'POST',
      path: '/api-keys/admin',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
