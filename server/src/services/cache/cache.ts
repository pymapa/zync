/**
 * LRU Cache with TTL and size limits to prevent memory leaks
 * User-scoped keys for data isolation
 *
 * Features:
 * - Thread-safe atomic operations
 * - TTL validation
 * - Memory size limits with estimated tracking
 * - Proper cleanup and resource management
 * - Protection against counter overflow
 */

import { logger } from '../../utils/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  /** Estimated size in bytes for memory tracking */
  estimatedSizeBytes: number;
}

interface CacheStats {
  size: number;
  maxSize: number;
  hits: bigint;
  misses: bigint;
  evictions: bigint;
  estimatedMemoryBytes: number;
  maxMemoryBytes: number | null;
}

export interface CacheOptions {
  /** Maximum number of entries in cache */
  maxSize: number;
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** Optional maximum memory limit in bytes */
  maxMemoryBytes?: number;
  /** Cleanup interval in milliseconds (default: 5 minutes) */
  cleanupIntervalMs?: number;
}

/**
 * Configuration validation errors
 */
export class CacheConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheConfigError';
  }
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly maxMemoryBytes: number | null;
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null;
  private estimatedMemoryBytes: number;
  private isShutdown: boolean;

  constructor(options: CacheOptions) {
    // Validate configuration
    this.validateOptions(options);

    this.cache = new Map();
    this.maxSize = options.maxSize;
    this.defaultTtlMs = options.defaultTtlSeconds * 1000;
    this.maxMemoryBytes = options.maxMemoryBytes ?? null;
    this.estimatedMemoryBytes = 0;
    this.isShutdown = false;

    this.stats = {
      size: 0,
      maxSize: options.maxSize,
      hits: 0n,
      misses: 0n,
      evictions: 0n,
      estimatedMemoryBytes: 0,
      maxMemoryBytes: this.maxMemoryBytes,
    };

    // Periodic cleanup of expired entries
    const cleanupInterval = options.cleanupIntervalMs ?? 5 * 60 * 1000;
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupInterval);

    // Allow cleanup to not block shutdown
    this.cleanupInterval.unref();
  }

  /**
   * Validate cache configuration options
   * @throws {CacheConfigError} If configuration is invalid
   */
  private validateOptions(options: CacheOptions): void {
    if (!Number.isInteger(options.maxSize) || options.maxSize <= 0) {
      throw new CacheConfigError(
        `maxSize must be a positive integer, got: ${options.maxSize}`
      );
    }

    if (
      !Number.isFinite(options.defaultTtlSeconds) ||
      options.defaultTtlSeconds <= 0
    ) {
      throw new CacheConfigError(
        `defaultTtlSeconds must be a positive number, got: ${options.defaultTtlSeconds}`
      );
    }

    if (
      options.maxMemoryBytes !== undefined &&
      (!Number.isInteger(options.maxMemoryBytes) || options.maxMemoryBytes <= 0)
    ) {
      throw new CacheConfigError(
        `maxMemoryBytes must be a positive integer, got: ${options.maxMemoryBytes}`
      );
    }

    if (
      options.cleanupIntervalMs !== undefined &&
      (!Number.isInteger(options.cleanupIntervalMs) ||
        options.cleanupIntervalMs <= 0)
    ) {
      throw new CacheConfigError(
        `cleanupIntervalMs must be a positive integer, got: ${options.cleanupIntervalMs}`
      );
    }
  }

  /**
   * Estimate the size of a value in bytes
   * This is a rough approximation for memory tracking
   */
  private estimateValueSize(value: T): number {
    if (value === null || value === undefined) {
      return 8; // Reference size
    }

    const type = typeof value;

    switch (type) {
      case 'string':
        // UTF-16 encoding: 2 bytes per character
        return (value as string).length * 2;
      case 'number':
      case 'boolean':
        return 8;
      case 'object':
        try {
          // Rough estimate: JSON string length * 2 for UTF-16
          // This is an approximation and may not reflect actual memory usage
          const jsonString = JSON.stringify(value);
          return jsonString.length * 2;
        } catch {
          // Circular reference or non-serializable object
          return 1024; // Default estimate
        }
      default:
        return 8; // Default for functions, symbols, etc.
    }
  }

  /**
   * Generate user-scoped cache key
   */
  static scopedKey(userId: number, key: string): string {
    return `user:${userId}:${key}`;
  }

  /**
   * Check if cache has been shutdown
   * @throws {Error} If cache is shutdown
   */
  private ensureNotShutdown(): void {
    if (this.isShutdown) {
      throw new Error('Cannot operate on shutdown cache instance');
    }
  }

  /**
   * Get value from cache
   * This operation is atomic with respect to stats updates
   */
  get(key: string): T | undefined {
    this.ensureNotShutdown();

    const entry = this.cache.get(key);

    if (!entry) {
      // Atomic: increment misses
      this.stats.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      // Entry expired - remove it atomically
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.estimatedMemoryBytes -= entry.estimatedSizeBytes;
        // Update stats atomically with deletion
        this.stats.size = this.cache.size;
        this.stats.estimatedMemoryBytes = this.estimatedMemoryBytes;
      }
      this.stats.misses++;
      return undefined;
    }

    /**
     * Move to end (most recently used)
     *
     * Why delete+set? JavaScript Map maintains insertion order.
     * To update LRU position, we must delete and re-insert.
     * This is the standard pattern for Map-based LRU caches.
     */
    this.cache.delete(key);
    this.cache.set(key, entry);

    // Atomic: increment hits
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with optional custom TTL
   * All cache modifications and stats updates are atomic
   *
   * @throws {CacheConfigError} If TTL is invalid
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    this.ensureNotShutdown();

    // Validate TTL if provided
    let ttlMs: number;
    if (ttlSeconds !== undefined) {
      if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        throw new CacheConfigError(
          `ttlSeconds must be a positive number, got: ${ttlSeconds}`
        );
      }
      ttlMs = ttlSeconds * 1000;
    } else {
      ttlMs = this.defaultTtlMs;
    }

    const expiresAt = Date.now() + ttlMs;
    const estimatedSizeBytes = this.estimateValueSize(value);

    // If key exists, remove it first to update position and free memory
    const existingEntry = this.cache.get(key);
    if (existingEntry !== undefined) {
      this.cache.delete(key);
      this.estimatedMemoryBytes -= existingEntry.estimatedSizeBytes;
    }

    // Check memory limit before adding new entry
    if (this.maxMemoryBytes !== null) {
      const projectedMemory = this.estimatedMemoryBytes + estimatedSizeBytes;

      // Evict entries if we would exceed memory limit
      while (
        this.cache.size > 0 &&
        projectedMemory > this.maxMemoryBytes
      ) {
        this.evictOldest();
      }

      // If single entry is too large, reject it
      if (estimatedSizeBytes > this.maxMemoryBytes) {
        logger.warn('Cache entry exceeds maxMemoryBytes', {
          key,
          estimatedSizeBytes,
          maxMemoryBytes: this.maxMemoryBytes,
        });
        return;
      }
    }

    // Evict oldest entry if at size capacity
    // Check after potential memory evictions to avoid unnecessary evictions
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    // Add new entry atomically
    this.cache.set(key, { value, expiresAt, estimatedSizeBytes });
    this.estimatedMemoryBytes += estimatedSizeBytes;

    // Update stats atomically
    this.stats.size = this.cache.size;
    this.stats.estimatedMemoryBytes = this.estimatedMemoryBytes;
  }

  /**
   * Evict the oldest (least recently used) entry
   * Helper method to keep eviction logic consistent
   */
  private evictOldest(): void {
    // Map iterator returns entries in insertion order
    // First entry is the oldest (least recently used)
    const oldestEntry = this.cache.entries().next();

    if (!oldestEntry.done) {
      const [oldestKey, oldestValue] = oldestEntry.value;
      this.cache.delete(oldestKey);
      this.estimatedMemoryBytes -= oldestValue.estimatedSizeBytes;
      this.stats.evictions++;

      logger.debug('Cache eviction', {
        key: oldestKey,
        estimatedSizeBytes: oldestValue.estimatedSizeBytes,
      });
    }
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    this.ensureNotShutdown();

    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);

    if (deleted && entry !== undefined) {
      this.estimatedMemoryBytes -= entry.estimatedSizeBytes;
      // Update stats atomically with deletion
      this.stats.size = this.cache.size;
      this.stats.estimatedMemoryBytes = this.estimatedMemoryBytes;
    }

    return deleted;
  }

  /**
   * Delete all keys for a specific user
   * Avoids mutation-during-iteration by collecting keys first
   */
  deleteUserCache(userId: number): number {
    this.ensureNotShutdown();

    const prefix = `user:${userId}:`;

    // Collect all keys to delete first to avoid mutation during iteration
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    // Now safely delete all collected keys
    let memoryFreed = 0;
    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry !== undefined) {
        memoryFreed += entry.estimatedSizeBytes;
      }
      this.cache.delete(key);
    }

    // Update stats atomically after all deletions
    this.estimatedMemoryBytes -= memoryFreed;
    this.stats.size = this.cache.size;
    this.stats.estimatedMemoryBytes = this.estimatedMemoryBytes;

    logger.debug('User cache cleared', {
      userId,
      deletedCount: keysToDelete.length,
      memoryFreed,
    });

    return keysToDelete.length;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.ensureNotShutdown();

    this.cache.clear();
    this.estimatedMemoryBytes = 0;

    // Reset stats atomically
    this.stats.size = 0;
    this.stats.estimatedMemoryBytes = 0;
    this.stats.evictions = 0n;

    logger.info('Cache cleared');
  }

  /**
   * Remove expired entries
   * Collects keys first to avoid mutation during iteration
   */
  private cleanupExpired(): void {
    if (this.isShutdown) {
      return;
    }

    const now = Date.now();

    // Collect expired keys first to avoid mutation during iteration
    const expiredKeys: Array<[string, CacheEntry<T>]> = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push([key, entry]);
      }
    }

    // Now safely delete all expired entries
    let memoryFreed = 0;
    for (const [key, entry] of expiredKeys) {
      this.cache.delete(key);
      memoryFreed += entry.estimatedSizeBytes;
    }

    if (expiredKeys.length > 0) {
      // Update stats atomically after cleanup
      this.estimatedMemoryBytes -= memoryFreed;
      this.stats.size = this.cache.size;
      this.stats.estimatedMemoryBytes = this.estimatedMemoryBytes;

      logger.debug('Cache cleanup completed', {
        cleanedCount: expiredKeys.length,
        memoryFreed,
      });
    }
  }

  /**
   * Get cache statistics
   * Returns a copy to prevent external mutation
   *
   * Note: BigInt values are converted to strings for JSON serialization safety
   */
  getStats(): Omit<CacheStats, 'hits' | 'misses' | 'evictions'> & {
    hits: string;
    misses: string;
    evictions: string;
  } {
    return {
      ...this.stats,
      hits: this.stats.hits.toString(),
      misses: this.stats.misses.toString(),
      evictions: this.stats.evictions.toString(),
    };
  }

  /**
   * Get raw stats with BigInt values (for internal use)
   */
  getRawStats(): Readonly<CacheStats> {
    return { ...this.stats };
  }

  /**
   * Shutdown cache and cleanup resources
   * MUST be called on application shutdown to clear interval and prevent leaks
   *
   * After shutdown, the cache instance cannot be used
   */
  shutdown(): void {
    if (this.isShutdown) {
      logger.warn('Cache shutdown called multiple times');
      return;
    }

    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.cache.clear();
    this.estimatedMemoryBytes = 0;
    this.stats.size = 0;
    this.stats.estimatedMemoryBytes = 0;
    this.isShutdown = true;

    logger.info('Cache shutdown complete');
  }

  /**
   * Check if cache has been shutdown
   */
  isShutdownComplete(): boolean {
    return this.isShutdown;
  }
}
