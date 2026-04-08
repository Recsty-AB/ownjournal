/**
 * Native iCloud service for Capacitor iOS.
 *
 * Uses a native CloudKit plugin (CKDatabase) that talks to the device's iCloud
 * account directly — no sign-in popup, no API token, no credentials to store.
 * The user just needs to be signed into iCloud on their device.
 *
 * This replaces ICloudService (CloudKit JS) on native iOS.
 */

import { registerPlugin } from '@capacitor/core';
import type { CloudProvider, CloudFile } from '@/types/cloudProvider';
import { RequestThrottler } from '@/utils/requestThrottler';
import { retryWithBackoff, sanitizeFileName } from '@/utils/cloudRetry';
import { scopedKey } from '@/utils/userScope';

// Plugin interface matching CloudKitPlugin.swift
interface CloudKitPluginInterface {
  checkAccountStatus(options?: { containerId?: string }): Promise<{ status: string }>;
  upload(options: { fileName: string; content: string; containerId?: string }): Promise<void>;
  download(options: { fileName: string; containerId?: string }): Promise<{ content: string | null }>;
  listFiles(options?: { containerId?: string }): Promise<{ files: Array<{ name: string; path: string; modifiedAt: string; size: number }> }>;
  deleteRecord(options: { fileName: string; containerId?: string }): Promise<void>;
  exists(options: { fileName: string; containerId?: string }): Promise<{ exists: boolean }>;
  openSettings(): Promise<void>;
}

const CloudKitNative = registerPlugin<CloudKitPluginInterface>('CloudKitPlugin');

const STORAGE_KEY = 'icloud_native_enabled';

function shouldRetryCloudKit(error: any): boolean {
  const msg = error?.message || String(error);
  if (msg.includes('RATE_LIMITED') || msg.includes('SERVICE_UNAVAILABLE')) return true;
  if (msg.includes('NETWORK_ERROR')) return true;
  // Don't retry auth, not-found, quota, or conflict errors
  if (msg.includes('NOT_AUTHENTICATED')) return false;
  if (msg.includes('NOT_FOUND')) return false;
  if (msg.includes('QUOTA_EXCEEDED')) return false;
  if (msg.includes('CONFLICT')) return false;
  // Retry unknown errors
  return true;
}

/**
 * Map a filePath to a sanitized fileName for CloudKit record lookup.
 * Strips the /OwnJournal/ prefix and directory components.
 */
function extractFileName(filePath: string): string {
  const name = filePath.split('/').pop() || filePath;
  return sanitizeFileName(name);
}

/**
 * Map a fileName back to its virtual path (same convention as ICloudService).
 */
function mapToPath(fileName: string): string {
  if (fileName === 'encryption-key.json') {
    return '/OwnJournal/encryption-key.json';
  } else if (fileName.startsWith('trend_analysis')) {
    return `/OwnJournal/analysis/${fileName}`;
  } else if (fileName.startsWith('entry-') && fileName.endsWith('.json')) {
    return `/OwnJournal/entries/${fileName}`;
  } else {
    return `/OwnJournal/${fileName}`;
  }
}

export class ICloudNativeService implements CloudProvider {
  name = 'iCloud';
  isConnected = false;
  private throttler = new RequestThrottler();
  private containerId: string;

  constructor(containerId?: string) {
    this.containerId = containerId || import.meta.env.VITE_APPLE_CLOUDKIT_CONTAINER_ID || 'iCloud.app.ownjournal';
  }

  setBulkSyncMode(enabled: boolean) {
    this.throttler.setBulkSyncMode(enabled);
  }

  async connect(): Promise<void> {
    const { status } = await CloudKitNative.checkAccountStatus({ containerId: this.containerId });

    if (status !== 'available') {
      const error = new Error(
        status === 'noAccount'
          ? 'NO_ICLOUD_ACCOUNT'
          : status === 'restricted'
          ? 'iCloud access is restricted on this device.'
          : status === 'couldNotDetermine'
          ? 'Could not determine iCloud account status. Please try again.'
          : status === 'temporarilyUnavailable'
          ? 'iCloud is temporarily unavailable. Please try again later.'
          : `iCloud account status: ${status}`
      );
      throw error;
    }

    this.isConnected = true;
    try {
      localStorage.setItem(scopedKey(STORAGE_KEY), 'true');
    } catch { /* localStorage may be unavailable */ }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    try {
      localStorage.removeItem(scopedKey(STORAGE_KEY));
    } catch { /* ignore */ }
  }

  async upload(filePath: string, content: string): Promise<void> {
    const fileName = extractFileName(filePath);
    return this.throttler.queueWriteOperation(async () => {
      await retryWithBackoff(
        () => CloudKitNative.upload({ fileName, content, containerId: this.containerId }),
        { shouldRetry: shouldRetryCloudKit }
      );
    });
  }

  async download(filePath: string): Promise<string | null> {
    const fileName = extractFileName(filePath);
    return this.throttler.throttledRequest(async () => {
      const result = await retryWithBackoff(
        () => CloudKitNative.download({ fileName, containerId: this.containerId }),
        { shouldRetry: shouldRetryCloudKit }
      );
      return result.content;
    });
  }

  async listFiles(_directoryPath: string): Promise<CloudFile[]> {
    return this.throttler.throttledRequest(async () => {
      const result = await retryWithBackoff(
        () => CloudKitNative.listFiles({ containerId: this.containerId }),
        { shouldRetry: shouldRetryCloudKit }
      );

      const files: CloudFile[] = result.files.map((f) => ({
        name: f.name,
        path: f.path || mapToPath(f.name),
        modifiedAt: new Date(f.modifiedAt),
        size: f.size,
      }));

      // Deduplicate by path (keep latest by modifiedAt)
      const byPath = new Map<string, CloudFile>();
      for (const f of files) {
        const existing = byPath.get(f.path);
        if (!existing || f.modifiedAt > existing.modifiedAt) {
          byPath.set(f.path, f);
        }
      }
      return Array.from(byPath.values());
    });
  }

  async delete(filePath: string): Promise<void> {
    const fileName = extractFileName(filePath);
    return this.throttler.queueWriteOperation(async () => {
      await retryWithBackoff(
        () => CloudKitNative.deleteRecord({ fileName, containerId: this.containerId }),
        { shouldRetry: shouldRetryCloudKit }
      );
    });
  }

  async exists(filePath: string): Promise<boolean> {
    const fileName = extractFileName(filePath);
    const result = await retryWithBackoff(
      () => CloudKitNative.exists({ fileName, containerId: this.containerId }),
      { shouldRetry: shouldRetryCloudKit }
    );
    return result.exists;
  }
}

/**
 * Check if the user previously enabled native iCloud sync.
 */
export function isNativeICloudEnabled(): boolean {
  try {
    return localStorage.getItem(scopedKey(STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}
