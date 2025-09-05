/**
 * Shared request throttling utility for cloud storage providers
 * 
 * Provides consistent rate limiting across all storage services:
 * - Minimum interval between any requests
 * - Write operation serialization with additional delays
 * - Configurable settings per provider if needed
 */

export interface ThrottlerConfig {
  /** Minimum milliseconds between any API requests */
  minRequestInterval: number;
  /** Additional delay between write operations (uploads, deletes) */
  writeOperationDelay: number;
  /** Whether to serialize write operations (prevent concurrent writes) */
  enableWriteQueue: boolean;
}

/** Default configuration - optimized for speed while avoiding rate limits */
export const DEFAULT_THROTTLE_CONFIG: ThrottlerConfig = {
  minRequestInterval: 50,     // 50ms between any requests (Google Drive has high limits)
  writeOperationDelay: 100,   // 100ms between write operations (faster)
  enableWriteQueue: true,     // Serialize writes to prevent rate limiting
};

/**
 * Request throttler class for managing API rate limiting
 * 
 * Usage:
 * ```typescript
 * const throttler = new RequestThrottler();
 * 
 * // For read operations (listFiles, download, exists):
 * const result = await throttler.throttledRequest(() => fetch(url));
 * 
 * // For write operations (upload, delete):
 * await throttler.queueWriteOperation(() => uploadFile(content));
 * ```
 */
/** Write delay (ms) used during bulk sync - faster than default to speed up uploads */
const BULK_SYNC_WRITE_DELAY_MS = 30;

export class RequestThrottler {
  private lastRequestTime = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private config: ThrottlerConfig;
  /** Stored so we can restore when bulk sync mode is turned off */
  private normalWriteOperationDelay: number;

  constructor(config: Partial<ThrottlerConfig> = {}) {
    this.config = { ...DEFAULT_THROTTLE_CONFIG, ...config };
    this.normalWriteOperationDelay = this.config.writeOperationDelay;
  }

  /**
   * Get current configuration
   */
  getConfig(): ThrottlerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<ThrottlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable bulk sync mode for faster writes during sync.
   * When enabled, uses a lower write delay (30ms) between uploads/deletes to speed up sync.
   */
  setBulkSyncMode(enabled: boolean): void {
    this.config.writeOperationDelay = enabled ? BULK_SYNC_WRITE_DELAY_MS : this.normalWriteOperationDelay;
  }

  /**
   * Throttle any request to maintain minimum interval between API calls
   * 
   * Use for read operations: listFiles, download, exists, search
   */
  async throttledRequest<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.config.minRequestInterval) {
      const waitTime = this.config.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    return operation();
  }

  /**
   * Fast read with minimal delay - use for bulk downloads during sync
   * Only 3ms delay - optimized for read-heavy operations (Google Drive has very high limits)
   */
  async fastRead<T>(operation: () => Promise<T>): Promise<T> {
    const FAST_READ_INTERVAL = 1; // Near-instant for cached reads - Google Drive handles this easily
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < FAST_READ_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, FAST_READ_INTERVAL - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
    return operation();
  }

  /**
   * Queue a write operation to serialize uploads/deletes and prevent rate limiting
   * 
   * Use for write operations: upload, delete
   * All writes are chained sequentially with delays between them
   */
  async queueWriteOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enableWriteQueue) {
      // If queue disabled, just throttle normally
      return this.throttledRequest(operation);
    }

    const task = this.writeQueue.then(async () => {
      // Add delay before each write operation
      await new Promise(resolve => setTimeout(resolve, this.config.writeOperationDelay));
      this.lastRequestTime = Date.now();
      return operation();
    });

    // Update queue to prevent subsequent operations from starting until this one completes
    // Use .catch() to prevent queue from breaking on individual operation failures
    this.writeQueue = task.then(() => {}).catch(() => {});

    return task;
  }

  /**
   * Wait for all queued writes to complete
   * Useful for cleanup or ensuring all operations are done before disconnect
   */
  async waitForQueue(): Promise<void> {
    await this.writeQueue;
  }

  /**
   * Reset throttler state (for reconnection scenarios)
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.writeQueue = Promise.resolve();
  }
}
