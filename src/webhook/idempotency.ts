/**
 * Idempotency store for webhook event deduplication.
 */

/**
 * Interface for idempotency stores.
 */
export interface IdempotencyStore {
  /**
   * Check if an event has been seen before.
   *
   * @param eventId - Event ID to check
   * @returns true if event was already processed
   */
  has(eventId: string): Promise<boolean> | boolean;

  /**
   * Mark an event as seen.
   *
   * @param eventId - Event ID to mark
   */
  add(eventId: string): Promise<void> | void;
}

/**
 * In-memory idempotency store.
 *
 * Suitable for single-process applications. For distributed systems,
 * use a Redis-based or database-backed implementation.
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen: Set<string> = new Set();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly timestamps: Map<string, number> = new Map();

  /**
   * Create a new in-memory idempotency store.
   *
   * @param options - Store options
   * @param options.maxSize - Maximum number of event IDs to store (default: 10000)
   * @param options.ttlMs - Time-to-live in milliseconds (default: 24 hours)
   */
  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = options?.maxSize ?? 10000;
    this.ttlMs = options?.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Check if an event has been seen.
   */
  has(eventId: string): boolean {
    this.cleanup();

    if (!this.seen.has(eventId)) {
      return false;
    }

    // Check if expired
    const timestamp = this.timestamps.get(eventId);
    if (timestamp && Date.now() - timestamp > this.ttlMs) {
      this.seen.delete(eventId);
      this.timestamps.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * Mark an event as seen.
   */
  add(eventId: string): void {
    this.cleanup();

    // Evict oldest entries if at capacity
    if (this.seen.size >= this.maxSize) {
      const oldest = this.findOldest();
      if (oldest) {
        this.seen.delete(oldest);
        this.timestamps.delete(oldest);
      }
    }

    this.seen.add(eventId);
    this.timestamps.set(eventId, Date.now());
  }

  /**
   * Get the number of stored event IDs.
   */
  get size(): number {
    return this.seen.size;
  }

  /**
   * Clear all stored event IDs.
   */
  clear(): void {
    this.seen.clear();
    this.timestamps.clear();
  }

  /**
   * Remove expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [eventId, timestamp] of this.timestamps) {
      if (now - timestamp > this.ttlMs) {
        expired.push(eventId);
      }
    }

    for (const eventId of expired) {
      this.seen.delete(eventId);
      this.timestamps.delete(eventId);
    }
  }

  /**
   * Find the oldest entry.
   */
  private findOldest(): string | undefined {
    let oldest: string | undefined;
    let oldestTime = Infinity;

    for (const [eventId, timestamp] of this.timestamps) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldest = eventId;
      }
    }

    return oldest;
  }
}
