/**
 * Users resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  User,
  UserCreateRequest,
  UserUpdateRequest,
  ListParams,
  RequestOptions,
} from '../types.js';

/**
 * Users API resource.
 */
export class UsersResource extends BaseResource {
  /**
   * Create a new user.
   *
   * @param data - User creation data
   * @returns Created user
   */
  async create(data: UserCreateRequest, options?: RequestOptions): Promise<User> {
    return this.transport.request<User>({
      method: 'POST',
      path: '/users',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * List users.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of users
   */
  list(params?: ListParams): PaginatedIterator<User> {
    return this.paginate<User>('/users', params);
  }

  /**
   * Update a user.
   *
   * @param userId - User ID
   * @param data - Update data (first_name, last_name, role)
   */
  async update(userId: string, data: UserUpdateRequest, options?: RequestOptions): Promise<void> {
    await this.transport.request<void>({
      method: 'PATCH',
      path: `/users/${userId}`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Delete a user.
   *
   * @param userId - User ID
   */
  async delete(userId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/users/${userId}`,
    });
  }
}
