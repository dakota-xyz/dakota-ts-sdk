/**
 * Pagination tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { paginate, defaultCursorExtractor, type PageFetcher } from '../../src/client/pagination.js';

interface TestItem {
  id: string;
}

describe('Pagination', () => {
  describe('defaultCursorExtractor', () => {
    it('extracts id from object', () => {
      const cursor = defaultCursorExtractor({ id: 'item_123' });
      expect(cursor).toBe('item_123');
    });

    it('throws if object has no id', () => {
      expect(() => defaultCursorExtractor({ id: undefined })).toThrow(
        'Item does not have an id field'
      );
    });
  });

  describe('PaginatedIterator', () => {
    it('iterates through single page', async () => {
      const fetcher: PageFetcher<TestItem> = vi.fn().mockResolvedValueOnce({
        data: [{ id: '1' }, { id: '2' }, { id: '3' }],
        meta: { has_more_after: false },
      });

      const iterator = paginate(fetcher);
      const items = await iterator.toArray();

      expect(items).toHaveLength(3);
      expect(items.map((i) => i.id)).toEqual(['1', '2', '3']);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('iterates through multiple pages', async () => {
      const fetcher: PageFetcher<TestItem> = vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: '1' }, { id: '2' }],
          meta: { has_more_after: true },
        })
        .mockResolvedValueOnce({
          data: [{ id: '3' }, { id: '4' }],
          meta: { has_more_after: true },
        })
        .mockResolvedValueOnce({
          data: [{ id: '5' }],
          meta: { has_more_after: false },
        });

      const iterator = paginate(fetcher);
      const items = await iterator.toArray();

      expect(items).toHaveLength(5);
      expect(items.map((i) => i.id)).toEqual(['1', '2', '3', '4', '5']);
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('passes cursor to fetcher', async () => {
      const fetcher: PageFetcher<TestItem> = vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: 'a' }, { id: 'b' }],
          meta: { has_more_after: true },
        })
        .mockResolvedValueOnce({
          data: [{ id: 'c' }],
          meta: { has_more_after: false },
        });

      const iterator = paginate(fetcher);
      await iterator.toArray();

      expect(fetcher).toHaveBeenCalledWith(undefined); // First call
      expect(fetcher).toHaveBeenCalledWith('b'); // Second call with cursor
    });

    it('supports for-await-of syntax', async () => {
      const fetcher: PageFetcher<TestItem> = vi.fn().mockResolvedValueOnce({
        data: [{ id: '1' }, { id: '2' }],
        meta: { has_more_after: false },
      });

      const iterator = paginate(fetcher);
      const items: TestItem[] = [];

      for await (const item of iterator) {
        items.push(item);
      }

      expect(items).toHaveLength(2);
    });

    it('handles empty results', async () => {
      const fetcher: PageFetcher<TestItem> = vi.fn().mockResolvedValueOnce({
        data: [],
        meta: { has_more_after: false },
      });

      const iterator = paginate(fetcher);
      const items = await iterator.toArray();

      expect(items).toHaveLength(0);
    });

    it('first() returns first item', async () => {
      const fetcher: PageFetcher<TestItem> = vi.fn().mockResolvedValueOnce({
        data: [{ id: '1' }, { id: '2' }],
        meta: { has_more_after: true },
      });

      const iterator = paginate(fetcher);
      const first = await iterator.first();

      expect(first).toEqual({ id: '1' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('first() returns null for empty results', async () => {
      const fetcher: PageFetcher<TestItem> = vi.fn().mockResolvedValueOnce({
        data: [],
        meta: { has_more_after: false },
      });

      const iterator = paginate(fetcher);
      const first = await iterator.first();

      expect(first).toBeNull();
    });

    it('next() returns items one at a time', async () => {
      const fetcher: PageFetcher<TestItem> = vi.fn().mockResolvedValueOnce({
        data: [{ id: '1' }, { id: '2' }],
        meta: { has_more_after: false },
      });

      const iterator = paginate(fetcher);

      const item1 = await iterator.next();
      const item2 = await iterator.next();
      const item3 = await iterator.next();

      expect(item1).toEqual({ id: '1' });
      expect(item2).toEqual({ id: '2' });
      expect(item3).toBeNull();
    });

    it('uses custom cursor extractor', async () => {
      interface CursorItem {
        cursor: string;
      }
      const fetcher: PageFetcher<CursorItem> = vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ cursor: 'x' }, { cursor: 'y' }],
          meta: { has_more_after: true },
        })
        .mockResolvedValueOnce({
          data: [{ cursor: 'z' }],
          meta: { has_more_after: false },
        });

      const customExtractor = (item: CursorItem) => item.cursor;
      const iterator = paginate(fetcher, customExtractor);
      await iterator.toArray();

      expect(fetcher).toHaveBeenCalledWith('y'); // Uses custom cursor field
    });
  });
});
