/**
 * AI Model Preloader
 * Handles background preloading of AI models on app startup
 */

import { localAI } from './localAI';
import { aiModeStorage } from '@/utils/aiModeStorage';

export type PreloadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DownloadMetrics {
  estimatedTotalMB: number;
  downloadedMB: number;
  speedMBps: number;
  remainingSeconds: number;
}

class AIPreloader {
  private status: PreloadStatus = 'idle';
  private progress: number = 0;
  private statusMessage: string = '';
  private listeners: Set<(status: PreloadStatus, progress: number, message: string, metrics?: DownloadMetrics) => void> = new Set();
  private preloadPromise: Promise<void> | null = null;
  private metrics: DownloadMetrics = {
    estimatedTotalMB: this.getEstimatedSize(), // Dynamic based on model type
    downloadedMB: 0,
    speedMBps: 0,
    remainingSeconds: 0
  };
  private startTime: number = 0;
  private lastProgress: number = 0;
  private lastProgressTime: number = 0;

  private getEstimatedSize(): number {
    const modelType = aiModeStorage.getModelType();
    return modelType === 'multilingual' ? 1900 : 550;
  }

  /**
   * Subscribe to preload status updates
   */
  subscribe(callback: (status: PreloadStatus, progress: number, message: string, metrics?: DownloadMetrics) => void) {
    this.listeners.add(callback);
    // Immediately notify of current status
    callback(this.status, this.progress, this.statusMessage, this.metrics);
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notify() {
    this.listeners.forEach(listener => {
      listener(this.status, this.progress, this.statusMessage, this.metrics);
    });
  }

  /**
   * Calculate download metrics based on progress
   */
  private updateMetrics(progress: number) {
    const now = Date.now();
    
    // Initialize timing on first progress update
    if (this.startTime === 0) {
      this.startTime = now;
      this.lastProgressTime = now;
      this.lastProgress = 0;
    }

    // Calculate downloaded amount
    this.metrics.downloadedMB = (progress / 100) * this.metrics.estimatedTotalMB;

    // Calculate speed (MB/s) based on recent progress
    const timeDelta = (now - this.lastProgressTime) / 1000; // seconds
    if (timeDelta > 0.5) { // Update speed every 500ms
      const progressDelta = progress - this.lastProgress;
      const mbDelta = (progressDelta / 100) * this.metrics.estimatedTotalMB;
      this.metrics.speedMBps = mbDelta / timeDelta;
      
      this.lastProgress = progress;
      this.lastProgressTime = now;

      // Calculate time remaining
      if (this.metrics.speedMBps > 0) {
        const remainingMB = this.metrics.estimatedTotalMB - this.metrics.downloadedMB;
        this.metrics.remainingSeconds = remainingMB / this.metrics.speedMBps;
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): PreloadStatus {
    return this.status;
  }

  /**
   * Get current progress (0-100)
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * Get current status message
   */
  getStatusMessage(): string {
    return this.statusMessage;
  }

  /**
   * Get current download metrics
   */
  getMetrics(): DownloadMetrics {
    return { ...this.metrics };
  }

  /**
   * Start preloading AI models in the background
   * This is idempotent - calling multiple times won't restart the process
   */
  async startPreload(): Promise<void> {
    // If already preloading or ready, return the existing promise
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    // Only preload if user is in local mode
    const mode = aiModeStorage.getMode();
    if (mode !== 'local') {
      this.status = 'idle';
      this.statusMessage = 'Cloud mode active';
      this.notify();
      return Promise.resolve();
    }

    // If already ready, no need to preload
    if (localAI.isReady()) {
      this.status = 'ready';
      this.progress = 100;
      this.statusMessage = 'Models ready';
      this.notify();
      return Promise.resolve();
    }

    // Check if models are cached - skip preload if they are
    try {
      const cached = await localAI.areModelsCached();
      if (cached) {
        this.status = 'ready';
        this.progress = 100;
        this.statusMessage = 'Models cached (will load instantly when needed)';
        this.notify();
        return Promise.resolve();
      }
    } catch (error) {
      console.warn('Failed to check cache status:', error);
    }

    // Start preloading
    this.status = 'loading';
    this.progress = 0;
    this.statusMessage = 'Starting model download...';
    this.startTime = 0; // Reset timing
    this.lastProgress = 0;
    this.lastProgressTime = 0;
    this.metrics = {
      estimatedTotalMB: this.getEstimatedSize(), // Refresh size estimate
      downloadedMB: 0,
      speedMBps: 0,
      remainingSeconds: 0
    };
    this.notify();

    this.preloadPromise = localAI.initialize((status, progress) => {
      this.status = 'loading';
      this.progress = progress;
      this.statusMessage = status;
      this.updateMetrics(progress);
      this.notify();
    })
      .then(() => {
        this.status = 'ready';
        this.progress = 100;
        this.statusMessage = 'Models ready';
        this.notify();
      })
      .catch((error) => {
        console.error('AI preload failed:', error);
        this.status = 'error';
        this.statusMessage = 'Failed to load models';
        this.notify();
      });

    return this.preloadPromise;
  }

  /**
   * Cancel preloading (if possible)
   * Note: Model downloads can't be cancelled mid-stream, but we can stop tracking them
   */
  cancel() {
    if (this.status === 'loading') {
      this.status = 'idle';
      this.progress = 0;
      this.statusMessage = 'Cancelled';
      this.notify();
    }
  }

  /**
   * Reset preloader state
   */
  reset() {
    this.status = 'idle';
    this.progress = 0;
    this.statusMessage = '';
    this.preloadPromise = null;
    this.startTime = 0;
    this.lastProgress = 0;
    this.lastProgressTime = 0;
    this.metrics = {
      estimatedTotalMB: 500,
      downloadedMB: 0,
      speedMBps: 0,
      remainingSeconds: 0
    };
    this.notify();
  }
}

export const aiPreloader = new AIPreloader();
