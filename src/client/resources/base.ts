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

      const response = await this.transport.request<
        | {
            data: T[];
            meta?: { has_more_after?: boolean };
          }
        | T[]
      >({
        method: 'GET',
        path,
        query,
      });

      // Not every list endpoint returns the `{data, meta}` envelope: a few
      // answer with a BARE ARRAY (GET /mandates and
      // GET /wallets/{id}/signer-groups today). Reading `.data` off those
      // yields undefined, which the old code turned into an empty page —
      // so the iterator finished immediately and the caller saw zero
      // results with no error, for records that plainly exist. Treat an
      // array as one complete page: there is no cursor to follow, so
      // `meta` is absent and `has_more_after` correctly reads false.
      if (Array.isArray(response)) {
        return { data: response, meta: undefined };
      }

      return {
        data: response.data ?? [],
        meta: response.meta,
      };
    };

    return paginate(fetcher, cursorExtractor);
  }
}
