/**
 * State-of-the-Art Adaptive Rate Limiter
 * 
 * Self-adjusting batch processor with advanced rate limit handling:
 * - Exponential backoff with jitter (prevents thundering herd)
 * - Circuit breaker pattern (stops wasting requests when service is down)
 * - Per-item retry with backoff (gives each item multiple chances)
 * - Respects Retry-After headers from APIs
 */

export interface AdaptiveRateLimiterConfig {
  // Initial/optimal values (when no rate limiting detected)
  initialBatchSize?: number;
  initialDelayMs?: number;
  
  // Bounds (never go below/above these)
  minBatchSize?: number;
  maxBatchSize?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  
  // Recovery parameters
  successesBeforeRecovery?: number;
  recoveryBatchIncrement?: number;
  recoveryDelayReduction?: number;
  
  // Backoff parameters
  backoffBatchDivisor?: number;
  backoffDelayMultiplier?: number;
  
  // Exponential backoff with jitter
  exponentialBase?: number;           // Default: 2
  maxExponentialPower?: number;       // Default: 6 (caps at 2^6 = 64x)
  jitterFactor?: number;              // Default: 0.3 (±30% randomization)
  
  // Circuit breaker
  circuitBreakerEnabled?: boolean;    // Default: true
  failureThreshold?: number;          // Default: 5 (failures before opening)
  circuitOpenDurationMs?: number;     // Default: 30000 (30s before half-open)
  halfOpenSuccessThreshold?: number;  // Default: 2 (successes to close again)
  
  // Per-item retry
  maxItemRetries?: number;            // Default: 3
}

export interface RateLimitError extends Error {
  status?: number;
  retryAfterMs?: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class AdaptiveRateLimiter {
  private currentBatchSize: number;
  private currentDelayMs: number;
  private consecutiveSuccesses: number = 0;
  private lastRateLimitTime: number = 0;
  private config: Required<AdaptiveRateLimiterConfig>;
  
  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private consecutiveFailures: number = 0;
  private circuitOpenedAt: number = 0;
  private halfOpenSuccesses: number = 0;
  
  // Exponential backoff tracking
  private currentBackoffAttempt: number = 0;

  constructor(config: AdaptiveRateLimiterConfig = {}) {
    this.config = {
      initialBatchSize: 20,     // Start with large batches (Google Drive handles this well)
      initialDelayMs: 30,       // Minimal delay - Google Drive has high limits
      minBatchSize: 1,
      maxBatchSize: 50,         // Much higher ceiling for fast sync
      minDelayMs: 10,           // Very low minimum for speed
      maxDelayMs: 10000,
      successesBeforeRecovery: 3,  // Recover very fast
      recoveryBatchIncrement: 5,   // Ramp up quickly
      recoveryDelayReduction: 0.5, // Aggressive recovery
      backoffBatchDivisor: 2,
      backoffDelayMultiplier: 2,
      // Exponential backoff with jitter
      exponentialBase: 2,
      maxExponentialPower: 6,
      jitterFactor: 0.3,
      // Circuit breaker
      circuitBreakerEnabled: true,
      failureThreshold: 5,
      circuitOpenDurationMs: 30000,
      halfOpenSuccessThreshold: 2,
      // Per-item retry
      maxItemRetries: 3,
      ...config
    };
    
    this.currentBatchSize = this.config.initialBatchSize;
    this.currentDelayMs = this.config.initialDelayMs;
  }

  /**
   * Calculate exponential backoff with jitter
   * Formula: baseDelay * (exponentialBase^attempt) * (1 ± jitterFactor)
   */
  private calculateBackoff(attemptNumber: number): number {
    // Cap the exponential power to prevent overflow
    const power = Math.min(attemptNumber, this.config.maxExponentialPower);
    
    // Exponential: baseDelay * (2^attempt)
    const exponentialDelay = this.config.initialDelayMs * 
      Math.pow(this.config.exponentialBase, power);
    
    // Add jitter: ±jitterFactor randomization
    // e.g., with jitterFactor=0.3, multiply by random value in [0.7, 1.3]
    const jitter = 1 + (Math.random() * 2 - 1) * this.config.jitterFactor;
    const delayWithJitter = exponentialDelay * jitter;
    
    // Cap at maxDelayMs
    return Math.min(delayWithJitter, this.config.maxDelayMs);
  }

  /**
   * Check circuit breaker state
   * Returns whether processing can proceed and optional wait time
   */
  private checkCircuit(): { canProceed: boolean; waitMs?: number } {
    if (!this.config.circuitBreakerEnabled) {
      return { canProceed: true };
    }
    
    if (this.circuitState === 'closed') {
      return { canProceed: true };
    }
    
    if (this.circuitState === 'open') {
      const elapsed = Date.now() - this.circuitOpenedAt;
      
      if (elapsed >= this.config.circuitOpenDurationMs) {
        // Transition to half-open: allow limited traffic to test
        this.circuitState = 'half-open';
        this.halfOpenSuccesses = 0;
        
        if (import.meta.env.DEV) {
          console.log('🔄 Circuit breaker: half-open, testing service...');
        }
        
        return { canProceed: true };
      }
      
      // Still open - reject immediately
      const waitMs = this.config.circuitOpenDurationMs - elapsed;
      
      if (import.meta.env.DEV) {
        console.log(`🔴 Circuit breaker OPEN: rejecting requests for ${Math.round(waitMs / 1000)}s`);
      }
      
      return { canProceed: false, waitMs };
    }
    
    // Half-open: allow request to test
    return { canProceed: true };
  }

  /**
   * Record successful operation for circuit breaker
   */
  private recordCircuitSuccess(): void {
    if (!this.config.circuitBreakerEnabled) return;
    
    if (this.circuitState === 'half-open') {
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.circuitState = 'closed';
        this.consecutiveFailures = 0;
        this.currentBackoffAttempt = 0;
        
        if (import.meta.env.DEV) {
          console.log('🟢 Circuit breaker: CLOSED (service recovered)');
        }
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordCircuitFailure(): void {
    if (!this.config.circuitBreakerEnabled) return;
    
    this.consecutiveFailures++;
    this.halfOpenSuccesses = 0;
    
    if (this.circuitState === 'half-open') {
      // Failed during test - reopen immediately
      this.circuitState = 'open';
      this.circuitOpenedAt = Date.now();
      
      if (import.meta.env.DEV) {
        console.log('🔴 Circuit breaker: reopened (test failed)');
      }
    } else if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.circuitState = 'open';
      this.circuitOpenedAt = Date.now();
      
      if (import.meta.env.DEV) {
        console.log(`🔴 Circuit breaker: OPEN (${this.consecutiveFailures} consecutive failures)`);
      }
      
      // Emit custom event for diagnostics integration
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rate-limiter-circuit-open', {
          detail: {
            consecutiveFailures: this.consecutiveFailures,
            circuitOpenDurationMs: this.config.circuitOpenDurationMs,
            timestamp: new Date().toISOString()
          }
        }));
      }
    }
  }

  /**
   * Record a successful batch operation - may trigger gradual recovery
   */
  recordSuccess(): void {
    this.consecutiveSuccesses++;
    this.recordCircuitSuccess();
    
    // Only recover if enough time has passed since last rate limit
    const timeSinceError = Date.now() - this.lastRateLimitTime;
    const cooldownMs = 5000; // Wait 5s after rate limit before recovering
    
    if (this.consecutiveSuccesses >= this.config.successesBeforeRecovery && 
        timeSinceError > cooldownMs) {
      // Gradually increase batch size
      this.currentBatchSize = Math.min(
        this.currentBatchSize + this.config.recoveryBatchIncrement,
        this.config.maxBatchSize
      );
      
      // Gradually decrease delay
      this.currentDelayMs = Math.max(
        this.currentDelayMs * this.config.recoveryDelayReduction,
        this.config.minDelayMs
      );
      
      // Reset backoff attempt counter
      this.currentBackoffAttempt = Math.max(0, this.currentBackoffAttempt - 1);
      
      this.consecutiveSuccesses = 0; // Reset counter
      
      if (import.meta.env.DEV) {
        console.log(`📈 Rate limiter recovered: batch=${this.currentBatchSize}, delay=${Math.round(this.currentDelayMs)}ms`);
      }
    }
  }

  /**
   * Record a rate limit error - triggers exponential backoff with jitter
   */
  recordRateLimit(retryAfterMs?: number): void {
    this.consecutiveSuccesses = 0;
    this.lastRateLimitTime = Date.now();
    this.currentBackoffAttempt++;
    this.recordCircuitFailure();
    
    // Aggressively reduce batch size
    this.currentBatchSize = Math.max(
      Math.floor(this.currentBatchSize / this.config.backoffBatchDivisor),
      this.config.minBatchSize
    );
    
    // Calculate exponential delay with jitter
    const exponentialDelay = this.calculateBackoff(this.currentBackoffAttempt);
    
    // Use Retry-After if provided and larger, otherwise use exponential
    if (retryAfterMs && retryAfterMs > exponentialDelay) {
      this.currentDelayMs = Math.min(retryAfterMs, this.config.maxDelayMs);
    } else {
      this.currentDelayMs = exponentialDelay;
    }
    
    if (import.meta.env.DEV) {
      console.log(`📉 Rate limit hit: batch=${this.currentBatchSize}, delay=${Math.round(this.currentDelayMs)}ms (exponential + jitter)`);
    }
  }

  getBatchSize(): number {
    return this.currentBatchSize;
  }

  getDelayMs(): number {
    return this.currentDelayMs;
  }

  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Reset to initial state (useful after a period of inactivity)
   */
  reset(): void {
    this.currentBatchSize = this.config.initialBatchSize;
    this.currentDelayMs = this.config.initialDelayMs;
    this.consecutiveSuccesses = 0;
    this.lastRateLimitTime = 0;
    this.currentBackoffAttempt = 0;
    // Reset circuit breaker
    this.circuitState = 'closed';
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = 0;
    this.halfOpenSuccesses = 0;
  }

  /**
   * Check if an error is a rate limit error
   */
  static isRateLimitError(error: any): boolean {
    if (!error) return false;
    
    // Explicit 429 status
    if (error.status === 429 || error.statusCode === 429) return true;
    
    // Error message indicators
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('rate_limit') || 
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('too_many_write_operations') ||
        msg.includes('dropbox_rate_limited')) {
      return true;
    }
    
    // CORS errors often mask 429 responses from APIs
    // When Dropbox returns 429, browsers hide it as a CORS error
    if (error instanceof TypeError) {
      const typeMsg = error.message.toLowerCase();
      if (typeMsg.includes('cors') || 
          typeMsg.includes('network') ||
          typeMsg.includes('failed to fetch')) {
        // Likely a masked rate limit - treat as such
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if an error is retryable (network issues, timeouts, rate limits)
   */
  static isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Rate limits are always retryable
    if (AdaptiveRateLimiter.isRateLimitError(error)) return true;
    
    const msg = (error.message || '').toLowerCase();
    
    // Network errors are retryable
    if (msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('socket hang up') ||
        msg.includes('fetch failed')) {
      return true;
    }
    
    // 5xx errors are typically retryable
    const status = error.status || error.statusCode;
    if (status && status >= 500 && status < 600) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract retry-after milliseconds from error
   */
  static getRetryAfterMs(error: any): number | undefined {
    if (error?.retryAfterMs) return error.retryAfterMs;
    
    // Try to parse from message
    const match = (error?.message || '').match(/retry after (\d+)/i);
    if (match) return parseInt(match[1], 10) * 1000;
    
    return undefined;
  }

  /**
   * Process items in adaptive batches with automatic rate limit handling
   * Includes circuit breaker and per-item retry with exponential backoff
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      isRateLimitError?: (error: any) => boolean;
      isRetryableError?: (error: any) => boolean;
      getRetryAfterMs?: (error: any) => number | undefined;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: any }>> {
    const results: Array<{ status: 'fulfilled'; value: R } | { status: 'rejected'; reason: any }> = [];
    
    const isRateLimitError = options.isRateLimitError || AdaptiveRateLimiter.isRateLimitError;
    const isRetryableError = options.isRetryableError || AdaptiveRateLimiter.isRetryableError;
    const getRetryAfterMs = options.getRetryAfterMs || AdaptiveRateLimiter.getRetryAfterMs;
    
    let i = 0;
    while (i < items.length) {
      // Check circuit breaker before processing
      const circuitCheck = this.checkCircuit();
      if (!circuitCheck.canProceed) {
        // Circuit is open - wait and return all remaining as failed
        if (circuitCheck.waitMs) {
          await new Promise(r => setTimeout(r, circuitCheck.waitMs));
        }
        // After waiting, continue to re-check circuit
        continue;
      }
      
      const batchSize = this.getBatchSize();
      const batch = items.slice(i, i + batchSize);
      
      if (import.meta.env.DEV && items.length > 5) {
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} items (batch size: ${batchSize}, delay: ${Math.round(this.getDelayMs())}ms)`);
      }
      
      // Process current batch in parallel with per-item retry
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          return this.processItemWithRetry(item, processor, isRetryableError, getRetryAfterMs);
        })
      );
      
      // Check if any item in batch was rate limited (after retries exhausted)
      let hadRateLimit = false;
      let maxRetryAfter = 0;
      
      for (const result of batchResults) {
        if (result.status === 'rejected' && isRateLimitError(result.reason)) {
          hadRateLimit = true;
          const retryAfter = getRetryAfterMs(result.reason) || 0;
          if (retryAfter > maxRetryAfter) maxRetryAfter = retryAfter;
        }
      }
      
      if (hadRateLimit) {
        // Record rate limit and get adjusted delay
        this.recordRateLimit(maxRetryAfter || undefined);
        
        // Wait extra time before next batch
        const extraDelay = Math.max(this.getDelayMs(), maxRetryAfter || 2000);
        if (import.meta.env.DEV) {
          console.log(`⏱️ Rate limit detected, waiting ${Math.round(extraDelay)}ms before continuing...`);
        }
        await new Promise(r => setTimeout(r, extraDelay));
      } else {
        // Check if all items in batch succeeded
        const successes = batchResults.filter(r => r.status === 'fulfilled').length;
        if (successes === batch.length) {
          this.recordSuccess();
        }
      }
      
      // Collect results
      results.push(...batchResults as any);
      
      // Report progress
      if (options.onProgress) {
        options.onProgress(i + batch.length, items.length);
      }
      
      i += batchSize;
      
      // Delay before next batch (unless it's the last one)
      if (i < items.length) {
        await new Promise(r => setTimeout(r, this.getDelayMs()));
      }
    }
    
    return results;
  }

  /**
   * Process a single item with per-item retry and exponential backoff
   */
  private async processItemWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    isRetryableError: (error: any) => boolean,
    getRetryAfterMs: (error: any) => number | undefined
  ): Promise<R> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.config.maxItemRetries; attempt++) {
      try {
        const result = await processor(item);
        
        // Success on retry - log it
        if (attempt > 0 && import.meta.env.DEV) {
          console.log(`✅ Item succeeded on retry attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (!isRetryableError(error) || attempt === this.config.maxItemRetries - 1) {
          // Not retryable or final attempt - give up
          throw error;
        }
        
        // Calculate per-item backoff with jitter
        // Use retry-after if available, otherwise exponential backoff
        const retryAfter = getRetryAfterMs(error);
        const itemBackoff = retryAfter 
          ? Math.min(retryAfter, this.config.maxDelayMs)
          : this.calculateBackoff(attempt);
        
        if (import.meta.env.DEV) {
          console.log(`🔄 Retrying item (attempt ${attempt + 2}/${this.config.maxItemRetries}) in ${Math.round(itemBackoff)}ms`);
        }
        
        await new Promise(r => setTimeout(r, itemBackoff));
      }
    }
    
    throw lastError;
  }
}

// Shared instance for cloud operations - AGGRESSIVE settings for Google Drive's high rate limits
// - Start with larger batches for fast initial sync
// - Very fast recovery to maximize throughput
// - Will automatically back off if rate limited
export const cloudRateLimiter = new AdaptiveRateLimiter({
  // START AGGRESSIVE (Google Drive handles it well)
  initialBatchSize: 10,
  initialDelayMs: 30,
  
  // ALLOW HIGH THROUGHPUT
  minBatchSize: 5,
  maxBatchSize: 50,
  minDelayMs: 10,
  maxDelayMs: 5000,
  
  // VERY FAST RECOVERY (ramp up immediately)
  successesBeforeRecovery: 1,
  recoveryBatchIncrement: 5,
  recoveryDelayReduction: 0.5,
  
  // Exponential backoff with jitter (capped lower)
  exponentialBase: 2,
  maxExponentialPower: 4,
  jitterFactor: 0.2,
  
  // LESS SENSITIVE CIRCUIT BREAKER (allow more retries)
  circuitBreakerEnabled: true,
  failureThreshold: 5,
  circuitOpenDurationMs: 10000,
  halfOpenSuccessThreshold: 1,
  
  // Per-item retry (fail faster per item to move on)
  maxItemRetries: 2,
});
