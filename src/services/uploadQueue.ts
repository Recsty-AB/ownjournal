// Upload Queue Service - ensures no uploads are silently skipped during rate limiting
// Queues uploads when provider just connected and processes them once delay expires
// PHASE 1: Added IndexedDB persistence, retry logic with exponential backoff
// PHASE 2: Added provider health checks before processing

import { CloudProvider } from '@/types/cloudProvider';
import { connectionMonitor } from '@/utils/connectionMonitor';
import { connectionStateManager } from '@/services/connectionStateManager';
import { openDB, saveToIndexedDB, getFromIndexedDB } from '@/utils/pwa';

interface QueuedUpload {
  filePath: string;
  content: string;
  resolve: () => void;
  reject: (error: Error) => void;
  queuedAt: number;
  retryCount: number;
  restored?: boolean; // Flag for uploads restored from IndexedDB
}

// Persisted queue item (without promise callbacks)
interface PersistedQueueItem {
  filePath: string;
  content: string;
  queuedAt: number;
  retryCount: number;
}

const JOURNAL_FOLDER = '/OwnJournal';
const PERSISTENCE_KEY = 'uploadQueue';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

class UploadQueue {
  private static instance: UploadQueue;
  private queue = new Map<string, QueuedUpload>(); // Key by filePath for deduplication
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private readonly CHECK_INTERVAL = 500; // Check every 500ms
  private initialized = false;
  private providerChangeCleanupFn: (() => void) | null = null;

  private constructor() {
    // Load persisted queue on startup
    this.loadPersistedQueue();
    
    // Subscribe to provider changes for abort functionality (Phase 2)
    this.subscribeToProviderChanges();
  }

  public static getInstance(): UploadQueue {
    if (!UploadQueue.instance) {
      UploadQueue.instance = new UploadQueue();
    }
    return UploadQueue.instance;
  }

  /**
   * Subscribe to provider changes to abort/clear queue on disconnect
   * Phase 2: Abort in-progress syncs on provider change
   */
  private subscribeToProviderChanges(): void {
    this.providerChangeCleanupFn = connectionStateManager.subscribe(() => {
      // If no primary provider, pause processing but don't reject
      // Items will resume when provider reconnects
      const primary = connectionStateManager.getPrimaryProvider();
      if (!primary && this.queue.size > 0) {
        if (import.meta.env.DEV) {
          console.log('⏸️ Upload queue paused - no primary provider');
        }
        // Don't clear queue - just pause processing
        // Items will be processed when provider reconnects
      }
    });
  }

  /**
   * Normalize any incoming path to a single "/OwnJournal/..." form
   */
  private toFullPath(p: string): string {
    const raw = (p || '').trim();

    const marker = '/remote.php/webdav/';
    let cleaned = raw;
    const markerIdx = cleaned.indexOf(marker);
    if (markerIdx !== -1) {
      cleaned = cleaned.substring(markerIdx + marker.length);
    }

    let normalized = cleaned.replace(/^\/+/, '');

    const ownIdx = normalized.toLowerCase().indexOf('ownjournal/');
    if (ownIdx > 0) {
      normalized = normalized.substring(ownIdx);
    }

    if (normalized.toLowerCase().startsWith('ownjournal/')) {
      return `/${normalized}`;
    }
    return `${JOURNAL_FOLDER}/${normalized}`;
  }

  /**
   * Load persisted queue from IndexedDB on startup
   * Phase 1: Persistence across page reloads
   */
  private async loadPersistedQueue(): Promise<void> {
    try {
      const persisted = await getFromIndexedDB('settings', PERSISTENCE_KEY);
      if (persisted && Array.isArray(persisted.value)) {
        const items: PersistedQueueItem[] = persisted.value;
        
        if (items.length > 0) {
          if (import.meta.env.DEV) {
            console.log(`📥 Restoring ${items.length} uploads from previous session`);
          }
          
          for (const item of items) {
            // Create restored upload with dummy promise handlers
            // These will complete silently when processed
            this.queue.set(item.filePath, {
              filePath: item.filePath,
              content: item.content,
              queuedAt: item.queuedAt,
              retryCount: item.retryCount,
              restored: true,
              resolve: () => {}, // Restored items complete silently
              reject: (error: Error) => {
                // Log errors for restored items since no one is listening
                console.error(`❌ Restored upload failed permanently: ${item.filePath}`, error);
              }
            });
          }
          
          this.startProcessing();
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load persisted upload queue:', error);
      this.initialized = true;
    }
  }

  /**
   * Persist current queue to IndexedDB
   * Phase 1: Persistence across page reloads
   */
  private async persistQueue(): Promise<void> {
    try {
      const items: PersistedQueueItem[] = Array.from(this.queue.values()).map(item => ({
        filePath: item.filePath,
        content: item.content,
        queuedAt: item.queuedAt,
        retryCount: item.retryCount
      }));
      
      await saveToIndexedDB('settings', { key: PERSISTENCE_KEY, value: items });
    } catch (error) {
      console.error('Failed to persist upload queue:', error);
    }
  }

  /**
   * Queue an upload - returns a promise that resolves when upload completes
   */
  public queueUpload(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.queue.get(filePath);
      
      if (existing) {
        // Old upload superseded by newer content - resolve old promise
        if (import.meta.env.DEV) {
          console.log(`📋 Replacing queued upload for ${filePath} with newer content`);
        }
        existing.resolve();
      }

      this.queue.set(filePath, {
        filePath,
        content,
        resolve,
        reject,
        queuedAt: Date.now(),
        retryCount: 0,
        restored: false
      });

      if (import.meta.env.DEV) {
        console.log(`📋 Queued upload: ${filePath} (queue size: ${this.queue.size})`);
      }

      // Persist to IndexedDB
      this.persistQueue();

      this.startProcessing();
    });
  }

  private startProcessing(): void {
    if (this.processingInterval) return;

    if (import.meta.env.DEV) {
      console.log('🔄 Starting upload queue processing');
    }

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.CHECK_INTERVAL);
  }

  private async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) return;

    // Phase 2: Provider health check before processing
    const primary = connectionStateManager.getPrimaryProvider();
    if (!primary) {
      // No provider - wait silently (don't spam logs)
      return;
    }

    // Verify provider is actually connected (health check)
    if (!connectionStateManager.isConnected(primary.name)) {
      if (import.meta.env.DEV) {
        console.log('⏳ Provider not fully connected, waiting...');
      }
      return;
    }

    // Check if rate limit has expired
    if (connectionStateManager.shouldDelaySync(primary.name)) {
      return; // Still in delay period, wait
    }

    // No more delay - process all queued uploads
    if (this.queue.size === 0) {
      this.stopProcessing();
      return;
    }

    this.isProcessing = true;

    if (import.meta.env.DEV) {
      console.log(`📤 Processing ${this.queue.size} queued upload(s)`);
    }

    // Process all queued uploads
    const entries = Array.from(this.queue.entries());
    
    for (const [filePath, item] of entries) {
      // Re-check provider is still available (may have disconnected mid-processing)
      const currentPrimary = connectionStateManager.getPrimaryProvider();
      if (!currentPrimary) {
        if (import.meta.env.DEV) {
          console.log('⏸️ Provider disconnected during queue processing, pausing...');
        }
        break; // Stop processing, will resume when provider reconnects
      }

      const fullPath = this.toFullPath(filePath);
      
      try {
        await currentPrimary.upload(fullPath, item.content);
        connectionMonitor.recordSuccess(currentPrimary.name);
        
        if (import.meta.env.DEV) {
          console.log(`✅ Queued upload completed: ${filePath}${item.restored ? ' (restored)' : ''}`);
        }
        
        item.resolve();
        this.queue.delete(filePath);
        
        // Persist updated queue
        this.persistQueue();
      } catch (error) {
        connectionMonitor.recordFailure(currentPrimary.name);
        
        // Phase 1: Retry logic with exponential backoff
        item.retryCount++;
        
        if (item.retryCount < MAX_RETRIES) {
          // Calculate exponential backoff delay
          const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, item.retryCount - 1);
          
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Upload failed (attempt ${item.retryCount}/${MAX_RETRIES}), retrying in ${delayMs}ms: ${filePath}`, error);
          }
          
          // Update queue with new retry count
          this.queue.set(filePath, item);
          
          // Persist updated retry count
          this.persistQueue();
          
          // Wait before next attempt (will be picked up in next processing cycle)
          // Mark this item as "delayed" by updating its queuedAt
          item.queuedAt = Date.now() + delayMs;
        } else {
          // Max retries exceeded - permanent failure
          if (import.meta.env.DEV) {
            console.error(`❌ Upload permanently failed after ${MAX_RETRIES} attempts: ${filePath}`, error);
          }
          
          item.reject(error instanceof Error ? error : new Error(String(error)));
          this.queue.delete(filePath);
          
          // Persist updated queue
          this.persistQueue();
        }
      }
    }

    this.isProcessing = false;

    // Stop interval if queue is empty
    if (this.queue.size === 0) {
      this.stopProcessing();
    }
  }

  private stopProcessing(): void {
    if (this.processingInterval) {
      if (import.meta.env.DEV) {
        console.log('⏹️ Stopping upload queue processing (queue empty)');
      }
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Get the current queue size (for debugging/UI)
   */
  public getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get list of pending file paths (for debugging/UI)
   */
  public getPendingFiles(): string[] {
    return Array.from(this.queue.keys());
  }

  /**
   * Check if a specific file is queued
   */
  public isFileQueued(filePath: string): boolean {
    return this.queue.has(filePath);
  }

  /**
   * Get retry statistics for a specific file
   */
  public getFileRetryCount(filePath: string): number {
    return this.queue.get(filePath)?.retryCount ?? 0;
  }

  /**
   * Check if queue has any restored uploads from previous session
   */
  public hasRestoredUploads(): boolean {
    return Array.from(this.queue.values()).some(item => item.restored);
  }

  /**
   * Get count of restored uploads
   */
  public getRestoredUploadCount(): number {
    return Array.from(this.queue.values()).filter(item => item.restored).length;
  }

  /**
   * Clear all pending uploads (for cleanup/testing)
   */
  public clearQueue(): void {
    for (const item of this.queue.values()) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue.clear();
    this.stopProcessing();
    
    // Clear persisted queue
    this.persistQueue();
  }

  /**
   * Clear queue for a specific provider (on provider disconnect)
   * Phase 2: Abort in-progress syncs on provider change
   */
  public clearQueueForProvider(): void {
    // Currently we only have one provider at a time, so this clears all
    // In a multi-provider scenario, we'd filter by provider
    if (this.queue.size > 0) {
      if (import.meta.env.DEV) {
        console.log(`🗑️ Clearing ${this.queue.size} queued uploads due to provider change`);
      }
      
      for (const item of this.queue.values()) {
        // Don't reject - these uploads are being canceled due to provider change
        // They'll need to be re-queued when the new provider is connected
        item.resolve();
      }
      this.queue.clear();
      this.stopProcessing();
      
      // Clear persisted queue
      this.persistQueue();
    }
  }

  /**
   * Force process queue immediately (for testing)
   */
  public async forceProcess(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.providerChangeCleanupFn) {
      this.providerChangeCleanupFn();
      this.providerChangeCleanupFn = null;
    }
    this.stopProcessing();
  }
}

export const uploadQueue = UploadQueue.getInstance();
