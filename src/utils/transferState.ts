/**
 * Transfer state management - persists progress for resume capability
 * PRIVACY: Stored locally, cleared after completion
 */

export interface TransferProgress {
  id: string;
  sourceProvider: string;
  targetProvider: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: string[];
  startedAt: number;
  lastUpdatedAt: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  phase: 'copying' | 'cleaning';
  cleanupFiles?: number;
  cleanedFiles?: number;
}

export class TransferStateManager {
  private static readonly STORAGE_KEY = 'transfer_progress';
  
  static save(progress: TransferProgress): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to save transfer progress:', error);
      }
    }
  }
  
  static load(): TransferProgress | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      const progress = JSON.parse(stored) as TransferProgress;
      if (Date.now() - progress.startedAt > 24 * 60 * 60 * 1000) {
        this.clear();
        return null;
      }
      return progress;
    } catch {
      return null;
    }
  }
  
  static clear(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
  
  static generateId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
