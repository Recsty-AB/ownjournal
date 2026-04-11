// Cloud storage service - handles cloud provider file operations
// Connection management is delegated to ConnectionStateManager
// Phase 3: Added token expiration handling, queue status visibility

import { CloudProvider, CloudFile } from '@/types/cloudProvider';
import { connectionMonitor } from '@/utils/connectionMonitor';
import { connectionStateManager } from '@/services/connectionStateManager';
import { uploadQueue } from '@/services/uploadQueue';

const JOURNAL_FOLDER = '/OwnJournal';

export class CloudStorageService {
  // Normalize any incoming path to a single "/OwnJournal/..." form without duplication
  private toFullPath(p: string): string {
    const raw = (p || '').trim();

    // If the incoming path accidentally contains the WebDAV prefix, strip it
    const marker = '/remote.php/webdav/';
    let cleaned = raw;
    const markerIdx = cleaned.indexOf(marker);
    if (markerIdx !== -1) {
      cleaned = cleaned.substring(markerIdx + marker.length);
    }

    // Remove leading slashes
    let normalized = cleaned.replace(/^\/+/, '');

    // If OwnJournal appears later in the path, trim to start from there
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
   * Get connected provider names (delegates to ConnectionStateManager)
   */
  public getConnectedProviderNames(): string[] {
    return connectionStateManager.getConnectedProviderNames();
  }

  /**
   * Get cached provider names for fast startup
   */
  public getCachedProviderNames(): string[] {
    return connectionStateManager.getCachedProviderNames();
  }

  /**
   * Get the primary provider (delegates to ConnectionStateManager)
   */
  public getPrimaryProvider(): CloudProvider | null {
    return connectionStateManager.getPrimaryProvider();
  }

  /**
   * Get all connected providers
   */
  public getConnectedProviders(): CloudProvider[] {
    return connectionStateManager.getConnectedProviders();
  }

  /**
   * Get the count of connected providers
   */
  public getConnectedProviderCount(): number {
    return connectionStateManager.getConnectedCount();
  }

  /**
   * Check if a specific provider is the primary (active) one
   */
  public isPrimaryProvider(providerName: string): boolean {
    return connectionStateManager.isPrimaryProvider(providerName);
  }

  /**
   * Upload to PRIMARY provider only (single-provider sync)
   * Uses queue-based approach to ensure no uploads are silently skipped
   */
  public async uploadToAll(filePath: string, content: string): Promise<void> {
    let primary = this.getPrimaryProvider();
    
    // If no primary found, throw error
    if (!primary) {
      if (import.meta.env.DEV) console.warn('⚠️ No primary provider found for upload');
      throw new Error('No cloud storage connected');
    }

    // CRITICAL: encryption-key.json should NEVER be queued
    // It's the foundation of E2E encryption and must be uploaded immediately
    const isCriticalFile = filePath === 'encryption-key.json' ||
                           filePath.endsWith('/encryption-key.json');

    // Rate limit protection: queue uploads if provider just connected
    // Queue ensures uploads are processed once delay expires (no data loss)
    // BUT NOT for critical files like encryption-key.json
    if (!isCriticalFile && connectionStateManager.shouldDelaySync(primary.name)) {
      if (import.meta.env.DEV) {
        console.log(`📋 Queueing upload for ${filePath} (rate limit active for ${primary.name})`);
      }
      await uploadQueue.queueUpload(filePath, content);
      return;
    }
    
    if (isCriticalFile && import.meta.env.DEV) {
      console.log(`🔐 Bypassing queue for critical file: ${filePath}`);
    }

    // Immediate upload (no rate limit)
    const fullPath = this.toFullPath(filePath);
    
    try {
      await primary.upload(fullPath, content);
      connectionMonitor.recordSuccess(primary.name);
      
      if (import.meta.env.DEV) {
        const secondaryCount = this.getConnectedProviderCount() - 1;
        if (secondaryCount > 0) {
          console.log(`📤 Uploaded to primary provider (${primary.name}). ${secondaryCount} secondary provider(s) not synced.`);
        }
      }
    } catch (error: any) {
      connectionMonitor.recordFailure(primary.name);
      
      // Phase 3: Handle token expiration specifically
      this.handlePotentialTokenExpiration(error, primary.name);
      
      if (import.meta.env.DEV) {
        console.error('Upload failed:', error);
        console.log('Connection health:', connectionMonitor.getAllHealth());
      }
      throw error;
    }
  }

  public async downloadFromPrimary(filePath: string): Promise<string | null> {
    const provider = this.getPrimaryProvider();
    if (!provider) return null;

    const fullPath = this.toFullPath(filePath);
    
    try {
      const result = await provider.download(fullPath);
      connectionMonitor.recordSuccess(provider.name);
      return result;
    } catch (error: any) {
      connectionMonitor.recordFailure(provider.name);
      
      // Phase 3: Handle token expiration specifically
      this.handlePotentialTokenExpiration(error, provider.name);
      
      throw error;
    }
  }

  public async listFiles(directoryPath: string = ''): Promise<CloudFile[]> {
    const syncDebug = import.meta.env.DEV;
    let provider = this.getPrimaryProvider();
    if (!provider) {
      if (syncDebug) {
        console.log('[sync-debug] listFiles: no primary provider, waiting 200ms then re-checking once');
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      provider = this.getPrimaryProvider();
    }
    if (!provider) {
      if (syncDebug) {
        console.log('[sync-debug] listFiles: no primary provider, returning []');
      }
      return [];
    }

    const fullPath = this.toFullPath(directoryPath);

    try {
      const result = await provider.listFiles(fullPath);
      if (syncDebug) {
        console.log(`[sync-debug] listFiles(${directoryPath || '(root)'}) → ${result.length} files (provider: ${provider.name}, path: ${fullPath})`);
      }
      return result;
    } catch (error: any) {
      // Phase 3: Handle token expiration specifically
      this.handlePotentialTokenExpiration(error, provider.name);
      throw error;
    }
  }

  /**
   * Delete from PRIMARY provider only (single-provider sync)
   */
  public async deleteFromAll(filePath: string): Promise<void> {
    const primary = this.getPrimaryProvider();
    if (!primary) return;
    
    const fullPath = this.toFullPath(filePath);
    
    try {
      await primary.delete(fullPath);
    } catch (error: any) {
      // Phase 3: Handle token expiration specifically
      this.handlePotentialTokenExpiration(error, primary.name);
      
      if (import.meta.env.DEV) console.error(`Failed to delete ${filePath} from ${primary.name}:`, error);
    }
  }

  public async fileExists(filePath: string): Promise<boolean> {
    const provider = this.getPrimaryProvider();
    if (!provider) return false;

    const fullPath = this.toFullPath(filePath);
    
    try {
      return await provider.exists(fullPath);
    } catch (error: any) {
      // Phase 3: Handle token expiration specifically
      this.handlePotentialTokenExpiration(error, provider.name);
      throw error;
    }
  }

  /**
   * Phase 3: Handle token expiration - detect 401/403 and dispatch event
   * This pauses sync until user re-authenticates
   */
  private handlePotentialTokenExpiration(error: any, providerName: string): void {
    const status = error?.status || error?.statusCode;
    const message = error?.message?.toLowerCase() || '';
    
    // Detect authentication failures
    const isAuthError = 
      status === 401 || 
      status === 403 ||
      message.includes('unauthorized') ||
      message.includes('invalid_grant') ||
      message.includes('token expired') ||
      message.includes('access_token') ||
      message.includes('refresh token');
    
    if (isAuthError) {
      if (import.meta.env.DEV) {
        console.warn(`🔐 Token expiration detected for ${providerName}:`, error);
      }
      
      // Dispatch event for UI to handle
      window.dispatchEvent(new CustomEvent('token-expired', {
        detail: {
          provider: providerName,
          error: error?.message || 'Authentication failed',
          timestamp: new Date().toISOString()
        }
      }));
    }
  }

  /**
   * Get the current upload queue size (for debugging/UI)
   */
  public getUploadQueueSize(): number {
    return uploadQueue.getQueueSize();
  }

  /**
   * Get pending upload files (for debugging/UI)
   */
  public getPendingUploadFiles(): string[] {
    return uploadQueue.getPendingFiles();
  }

  /**
   * Check if there are restored uploads from a previous session
   * Phase 1: Queue persistence visibility
   */
  public hasRestoredUploads(): boolean {
    return uploadQueue.hasRestoredUploads();
  }

  /**
   * Get count of restored uploads
   * Phase 1: Queue persistence visibility
   */
  public getRestoredUploadCount(): number {
    return uploadQueue.getRestoredUploadCount();
  }
}

export const cloudStorageService = new CloudStorageService();
