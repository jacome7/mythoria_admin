/**
 * Simple in-memory cache with TTL (Time To Live)
 * 
 * Used to cache Google Postmaster API responses to respect rate limits
 * and improve performance. Default TTL is 6 hours since Postmaster data
 * is updated once per day.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  /**
   * @param defaultTTL - Default TTL in milliseconds (default: 6 hours)
   */
  constructor(defaultTTL: number = 6 * 60 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get value from cache
   * @returns The cached value or null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in milliseconds (optional, uses default if not provided)
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data: value, expiresAt });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get number of entries in cache (including expired)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute if not present
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

// Create a singleton cache instance for Postmaster data
// 6 hours TTL since Postmaster updates once per day
export const postmasterCache = new MemoryCache(6 * 60 * 60 * 1000);

// Cleanup expired entries every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    postmasterCache.cleanup();
  }, 60 * 60 * 1000);
}
