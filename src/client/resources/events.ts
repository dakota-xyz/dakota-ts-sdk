/**
 * Events resource.
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type { Event, EventListParams } from '../types.js';

/**
 * Events API resource.
 */
export class EventsResource extends BaseResource {
  /**
   * List events.
   *
   * Events track all platform activity and can be used for audit trails.
   *
   * @param params - Filter and pagination parameters
   * @returns Async iterator of events
   *
   * @example
   * ```typescript
   * for await (const event of client.events.list()) {
   *   console.log(event.type, event.data);
   * }
   *
   * // Filter by event type
   * const customerEvents = client.events.list({
   *   event_type: 'customer.created',
   * });
   * ```
   */
  list(params?: EventListParams): PaginatedIterator<Event> {
    return this.paginate<Event>('/events', params);
  }
}
