/**
 * Pagination utilities with async iterators.
 */

/**
 * Pagination metadata from API responses.
 */
export interface PaginationMeta {
  total_count?: number;
  has_more_after?: boolean;
  has_more_before?: boolean;
}

/**
 * Paginated response structure.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta?: PaginationMeta;
}

/**
 * Parameters for paginated requests.
 */
export interface PaginationParams {
  starting_after?: string;
  ending_before?: string;
  limit?: number;
}

/**
 * Function to fetch a page of results.
 */
export type PageFetcher<T> = (cursor?: string) => Promise<PaginatedResponse<T>>;

/**
 * Function to extract cursor from an item.
 */
export type CursorExtractor<T> = (item: T) => string;

/**
 * Default cursor extractor that uses the 'id' field.
 */
export function defaultCursorExtractor<T extends { id?: string }>(item: T): string {
  if (!item.id) {
    throw new Error('Item does not have an id field for cursor extraction');
  }
  return item.id;
}

/**
 * Async iterator for paginated results.
 */
export class PaginatedIterator<T> implements AsyncIterable<T> {
  private readonly fetcher: PageFetcher<T>;
  private readonly cursorExtractor: CursorExtractor<T>;
  private cursor: string | undefined;
  private buffer: T[] = [];
  private hasMore = true;
  private started = false;

  constructor(fetcher: PageFetcher<T>, cursorExtractor: CursorExtractor<T> = defaultCursorExtractor) {
    this.fetcher = fetcher;
    this.cursorExtractor = cursorExtractor;
  }

  /**
   * Implement async iterator protocol.
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: async (): Promise<IteratorResult<T>> => {
        const item = await this.next();
        if (item === null) {
          return { done: true, value: undefined };
        }
        return { done: false, value: item };
      },
    };
  }

  /**
   * Get the next item, or null if no more items.
   */
  async next(): Promise<T | null> {
    // If buffer has items, return next one
    if (this.buffer.length > 0) {
      return this.buffer.shift()!;
    }

    // If no more pages, we're done
    if (!this.hasMore && this.started) {
      return null;
    }

    // Fetch next page
    await this.fetchNextPage();

    // Return first item from buffer, or null if empty
    if (this.buffer.length > 0) {
      return this.buffer.shift()!;
    }

    return null;
  }

  /**
   * Collect all items into an array.
   */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }

  /**
   * Get the first item, or null if none.
   */
  async first(): Promise<T | null> {
    return this.next();
  }

  /**
   * Fetch the next page of results.
   */
  private async fetchNextPage(): Promise<void> {
    this.started = true;

    const response = await this.fetcher(this.cursor);
    this.buffer = response.data ?? [];

    // Update cursor for next page
    if (this.buffer.length > 0) {
      const lastItem = this.buffer[this.buffer.length - 1];
      if (lastItem) {
        this.cursor = this.cursorExtractor(lastItem);
      }
    }

    // Check if there are more pages
    this.hasMore = response.meta?.has_more_after ?? false;
  }
}

/**
 * Create a paginated iterator.
 */
export function paginate<T>(
  fetcher: PageFetcher<T>,
  cursorExtractor?: CursorExtractor<T>
): PaginatedIterator<T> {
  return new PaginatedIterator(fetcher, cursorExtractor);
}
