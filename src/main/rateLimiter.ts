/**
 * IPC Rate Limiter
 * Prevents excessive IPC calls that could overwhelm the main process
 */

interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed in the window
  windowMs: number; // Time window in milliseconds
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Default configurations for different operation types
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  read: { maxRequests: 100, windowMs: 1000 }, // 100 reads/second
  write: { maxRequests: 30, windowMs: 1000 }, // 30 writes/second
  delete: { maxRequests: 10, windowMs: 1000 }, // 10 deletes/second
  heavy: { maxRequests: 5, windowMs: 1000 }, // 5 heavy ops/second (backup, restore, etc.)
  default: { maxRequests: 50, windowMs: 1000 }, // 50 requests/second default
};

// Map IPC channels to operation types
const CHANNEL_TYPES: Record<string, keyof typeof DEFAULT_CONFIGS> = {
  // Read operations
  'company:getAll': 'read',
  'company:getById': 'read',
  'project:getAll': 'read',
  'project:getById': 'read',
  'transaction:getAll': 'read',
  'transaction:getByCompany': 'read',
  'transaction:getByProject': 'read',
  'category:getAll': 'read',
  'material:getAll': 'read',
  'material:getById': 'read',
  'analytics:getDashboardStats': 'read',
  'analytics:getCompanyBalance': 'read',
  'analytics:getProjectCategoryBreakdown': 'read',
  'settings:get': 'read',
  'exchange:getRates': 'read',
  'db:checkIntegrity': 'read',
  'db:getStats': 'read',

  // Write operations
  'company:create': 'write',
  'company:update': 'write',
  'project:create': 'write',
  'project:update': 'write',
  'transaction:create': 'write',
  'transaction:update': 'write',
  'category:create': 'write',
  'category:update': 'write',
  'material:create': 'write',
  'material:update': 'write',
  'material:updateStock': 'write',
  'settings:set': 'write',

  // Delete operations
  'company:delete': 'delete',
  'project:delete': 'delete',
  'transaction:delete': 'delete',
  'category:delete': 'delete',
  'material:delete': 'delete',

  // Heavy operations
  'db:backup': 'heavy',
  'db:restore': 'heavy',
  'db:export': 'heavy',
  'db:import': 'heavy',
  'googleDrive:backup': 'heavy',
  'googleDrive:restore': 'heavy',
};

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Initialize with default configs
    Object.entries(DEFAULT_CONFIGS).forEach(([key, config]) => {
      this.configs.set(key, config);
    });
  }

  /**
   * Check if a request should be rate limited
   * @param channel - IPC channel name
   * @returns true if request is allowed, false if rate limited
   */
  checkLimit(channel: string): boolean {
    const operationType = CHANNEL_TYPES[channel] || 'default';
    const config = this.configs.get(operationType) || DEFAULT_CONFIGS.default;
    const key = `${channel}`;
    const now = Date.now();

    let entry = this.limits.get(key);

    // If no entry or window has passed, reset
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      this.limits.set(key, entry);
      return true;
    }

    // If within window, increment and check
    entry.count++;

    if (entry.count > config.maxRequests) {
      console.warn(
        `Rate limit exceeded for channel: ${channel} (${entry.count}/${config.maxRequests})`
      );
      return false;
    }

    return true;
  }

  /**
   * Get remaining requests for a channel
   */
  getRemaining(channel: string): number {
    const operationType = CHANNEL_TYPES[channel] || 'default';
    const config = this.configs.get(operationType) || DEFAULT_CONFIGS.default;
    const key = `${channel}`;
    const entry = this.limits.get(key);

    if (!entry || Date.now() >= entry.resetTime) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - entry.count);
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  getResetTime(channel: string): number {
    const key = `${channel}`;
    const entry = this.limits.get(key);

    if (!entry) {
      return 0;
    }

    return Math.max(0, entry.resetTime - Date.now());
  }

  /**
   * Configure rate limit for a specific operation type
   */
  configure(operationType: string, config: RateLimitConfig): void {
    this.configs.set(operationType, config);
  }

  /**
   * Clear all rate limit entries (useful for testing)
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Get statistics about current rate limiting
   */
  getStats(): Record<string, { count: number; resetTime: number; remaining: number }> {
    const stats: Record<string, { count: number; resetTime: number; remaining: number }> = {};
    const now = Date.now();

    this.limits.forEach((entry, key) => {
      if (entry.resetTime > now) {
        const operationType = CHANNEL_TYPES[key] || 'default';
        const config = this.configs.get(operationType) || DEFAULT_CONFIGS.default;
        stats[key] = {
          count: entry.count,
          resetTime: entry.resetTime - now,
          remaining: Math.max(0, config.maxRequests - entry.count),
        };
      }
    });

    return stats;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * IPC handler wrapper with rate limiting
 */
export function withRateLimit<T>(
  channel: string,
  handler: (...args: unknown[]) => Promise<T>
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]): Promise<T> => {
    if (!rateLimiter.checkLimit(channel)) {
      const resetTime = rateLimiter.getResetTime(channel);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds.`);
    }
    return handler(...args);
  };
}

export default rateLimiter;
