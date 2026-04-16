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
  WebhookReplayResponse,
  WebhookHistoryListParams,
  WebhookHistoryResponse,
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
  async createTarget(
    data: WebhookTargetCreateRequest,
    options?: RequestOptions
  ): Promise<WebhookTarget> {
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
  async updateTarget(
    targetId: string,
    data: WebhookTargetUpdateRequest,
    options?: RequestOptions
  ): Promise<WebhookTarget> {
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
   * List webhook delivery history.
   *
   * Note: This endpoint uses cursor-based pagination (`cursor`/`has_more`) instead
   * of the standard `starting_after`/`has_more_after` format. Because of this,
   * it returns the raw response rather than a `PaginatedIterator`. Use the `cursor`
   * field from the response to fetch subsequent pages.
   *
   * @param params - Webhook history query parameters
   * @returns Webhook history response with `data`, `has_more`, and `cursor`
   *
   * @example
   * ```typescript
   * let cursor: string | undefined;
   * do {
   *   const page = await client.webhooks.listEvents({ limit: 50, cursor });
   *   for (const event of page.data) {
   *     console.log(event);
   *   }
   *   cursor = page.cursor ?? undefined;
   * } while (page.has_more);
   * ```
   */
  async listEvents(params?: WebhookHistoryListParams): Promise<WebhookHistoryResponse> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          query[key] = value as string | number | boolean;
        }
      }
    }
    return this.transport.request<WebhookHistoryResponse>({
      method: 'GET',
      path: '/webhooks',
      query,
    });
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
   * Re-queues the webhook for delivery to all configured targets.
   *
   * @param eventId - Webhook event ID
   * @param options - Request options
   * @returns Replay response with `webhook_id`, `status`, and `replayed_to_count`
   */
  async replayEvent(eventId: string, options?: RequestOptions): Promise<WebhookReplayResponse> {
    return this.transport.request<WebhookReplayResponse>({
      method: 'POST',
      path: `/webhooks/events/${eventId}/replay`,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
