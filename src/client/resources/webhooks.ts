/**
 * Webhooks resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  WebhookTarget,
  WebhookTargetCreateRequest,
  WebhookTargetUpdateRequest,
  WebhookEvent,
  ListParams,
  RequestOptions,
} from '../types.js';

/**
 * Webhooks API resource.
 */
export class WebhooksResource extends BaseResource {
  /**
   * Create a new webhook target.
   *
   * @param data - Webhook target creation data
   * @returns Created webhook target
   */
  async createTarget(data: WebhookTargetCreateRequest, options?: RequestOptions): Promise<WebhookTarget> {
    return this.transport.request<WebhookTarget>({
      method: 'POST',
      path: '/webhooks/targets',
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * List webhook targets.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of webhook targets
   */
  listTargets(params?: ListParams): PaginatedIterator<WebhookTarget> {
    return this.paginate<WebhookTarget>('/webhooks/targets', params);
  }

  /**
   * Get a webhook target by ID.
   *
   * @param targetId - Webhook target ID
   * @returns Webhook target record
   */
  async getTarget(targetId: string): Promise<WebhookTarget> {
    return this.transport.request<WebhookTarget>({
      method: 'GET',
      path: `/webhooks/targets/${targetId}`,
    });
  }

  /**
   * Update a webhook target.
   *
   * @param targetId - Webhook target ID
   * @param data - Update data
   * @returns Updated webhook target
   */
  async updateTarget(targetId: string, data: WebhookTargetUpdateRequest, options?: RequestOptions): Promise<WebhookTarget> {
    return this.transport.request<WebhookTarget>({
      method: 'PATCH',
      path: `/webhooks/targets/${targetId}`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Delete a webhook target.
   *
   * @param targetId - Webhook target ID
   */
  async deleteTarget(targetId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/webhooks/targets/${targetId}`,
    });
  }

  /**
   * List webhook events.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of webhook events
   */
  listEvents(params?: ListParams): PaginatedIterator<WebhookEvent> {
    return this.paginate<WebhookEvent>('/webhooks', params);
  }

  /**
   * Get a webhook event by ID.
   *
   * @param eventId - Webhook event ID
   * @returns Webhook event record
   */
  async getEvent(eventId: string): Promise<WebhookEvent> {
    return this.transport.request<WebhookEvent>({
      method: 'GET',
      path: `/webhooks/${eventId}`,
    });
  }

  /**
   * Replay a webhook event.
   *
   * @param eventId - Webhook event ID
   */
  async replayEvent(eventId: string, options?: RequestOptions): Promise<void> {
    await this.transport.request<void>({
      method: 'POST',
      path: `/webhooks/events/${eventId}/replay`,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
