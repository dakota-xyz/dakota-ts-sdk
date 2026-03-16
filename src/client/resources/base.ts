/**
 * Base resource class for API resources.
 */

import { Transport } from '../transport.js';
import { PaginatedIterator, paginate, PageFetcher, CursorExtractor } from '../pagination.js';

/**
 * Base class for API resources.
 */
export abstract class BaseResource {
  protected readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Create a paginated iterator for a list endpoint.
   */
  protected paginate<T>(
    path: string,
    params?: Record<string, unknown>,
    cursorExtractor?: CursorExtractor<T>
  ): PaginatedIterator<T> {
    const fetcher: PageFetcher<T> = async (cursor?: string) => {
      const query: Record<string, string | number | boolean | undefined> = {};

      // Add pagination params
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            query[key] = value as string | number | boolean;
          }
        }
      }

      if (cursor) {
        query.starting_after = cursor;
      }

      const response = await this.transport.request<{
        data: T[];
        meta?: { has_more_after?: boolean };
      }>({
        method: 'GET',
        path,
        query,
      });

      return {
        data: response.data ?? [],
        meta: response.meta,
      };
    };

    return paginate(fetcher, cursorExtractor);
  }
}
