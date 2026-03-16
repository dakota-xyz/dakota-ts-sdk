/**
 * Users resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type { User, UserCreateRequest, UserUpdateRequest, ListParams } from '../types.js';

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
  async create(data: UserCreateRequest): Promise<User> {
    return this.transport.request<User>({
      method: 'POST',
      path: '/users',
      body: data,
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
   * Get a user by ID.
   *
   * @param userId - User ID
   * @returns User record
   */
  async get(userId: string): Promise<User> {
    return this.transport.request<User>({
      method: 'GET',
      path: `/users/${userId}`,
    });
  }

  /**
   * Update a user.
   *
   * @param userId - User ID
   * @param data - Update data
   * @returns Updated user
   */
  async update(userId: string, data: UserUpdateRequest): Promise<User> {
    return this.transport.request<User>({
      method: 'PATCH',
      path: `/users/${userId}`,
      body: data,
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
