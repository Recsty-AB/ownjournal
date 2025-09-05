// Google Drive API service with proper token management and retry logic
import { CloudCredentialStorage, type GoogleDriveCredentials } from '@/utils/cloudCredentialStorage';
import { SimpleModeCredentialStorage } from '@/utils/simpleModeCredentialStorage';
import { isE2EEnabled } from '@/utils/encryptionModeStorage';
import { retryWithBackoff, sanitizeFileName, getApiErrorDetails } from '@/utils/cloudRetry';
import { RequestThrottler } from '@/utils/requestThrottler';
import type { CloudProvider, CloudFile } from '@/types/cloudProvider';
import { oauthConfig, isGoogleDriveConfigured } from '@/config/oauth';
import { SUPABASE_CONFIG } from '@/config/supabase';

export class GoogleDriveService implements CloudProvider {
  name = 'Google Drive';
  isConnected = false;
  private credentials: GoogleDriveCredentials | null = null;
  private masterKey: CryptoKey | null = null;
  private refreshPromise: Promise<void> | null = null;
  
  // Shared throttler for consistent rate limiting across all storage providers
  private throttler = new RequestThrottler();
  
  // File ID cache to avoid redundant search API calls during sync
  // Populated by listFiles(), used by download() to skip search
  private fileIdCache = new Map<string, string>();
  
  // Bulk sync mode: use faster throttling for reads during sync
  private bulkSyncMode = false;

  constructor() {}
  
  /**
   * Enable/disable bulk sync mode for faster read and write operations during sync.
   * When enabled: fast reads (throttler.fastRead) and lower write delay (30ms) between uploads/deletes.
   */
  setBulkSyncMode(enabled: boolean): void {
    this.bulkSyncMode = enabled;
    this.throttler.setBulkSyncMode(enabled);
    if (import.meta.env.DEV) {
      console.log(`📦 Google Drive bulk sync mode: ${enabled ? 'ON (fast reads + fast writes)' : 'OFF'}`);
    }
  }
  
  // Throttle requests to avoid rate limiting (uses fast read in bulk sync mode)
  private throttledRequest<T>(operation: () => Promise<T>): Promise<T> {
    if (this.bulkSyncMode) {
      return this.throttler.fastRead(operation);
    }
    return this.throttler.throttledRequest(operation);
  }
  
  // Queue write operations to prevent rate limiting on uploads/deletes
  private queueWriteOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.throttler.queueWriteOperation(operation);
  }

  async connect(credentials: GoogleDriveCredentials, masterKey: CryptoKey | null = null): Promise<void> {
    this.credentials = credentials;
    this.masterKey = masterKey;
    this.isConnected = true;
    
    // NOTE: Credential saving is handled by the caller (GoogleDriveSync component or connectionStateManager)
    // Removing duplicate save here to prevent mode mismatch issues where credentials
    // get saved to the wrong storage (simple vs E2E) during auto-reconnection
  }

  async disconnect(): Promise<void> {
    // PRIVACY: Revoke token on Google's side
    if (this.credentials?.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.credentials.accessToken}`, {
          method: 'POST',
        });
      } catch (error) {
        // Non-critical: log but don't throw
        if (import.meta.env.DEV) {
          console.warn('Failed to revoke Google Drive token:', error);
        }
      }
    }
    
    // CRITICAL: Remove credentials from storage (both E2E and Simple modes)
    if (isE2EEnabled() && this.masterKey) {
      try {
        await CloudCredentialStorage.removeCredentials('google-drive', this.masterKey);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to remove encrypted Google Drive credentials:', error);
        }
      }
    } else {
      SimpleModeCredentialStorage.clearGoogleDriveCredentials();
    }
    
    // Clear sensitive data from memory
    this.credentials = null;
    this.masterKey = null;
    this.isConnected = false;
    this.fileIdCache.clear();
    this.bulkSyncMode = false;
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.credentials) throw new Error('Google Drive not connected');

    // Check if refresh already in progress
    if (this.refreshPromise) {
      await this.refreshPromise;
      return this.credentials!.accessToken;
    }

    // Check if token needs refresh (5 min buffer)
    const expiresIn = this.credentials.expiresAt - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      this.refreshPromise = this.refreshToken();
      try {
        await this.refreshPromise;
      } finally {
        this.refreshPromise = null;
      }
    }

    return this.credentials.accessToken;
  }

  private async refreshToken(): Promise<void> {
    // CONCURRENCY: Check if refresh already in progress (prevent race condition)
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }
    
    if (!this.credentials) {
      throw new Error('Cannot refresh: missing credentials');
    }

    if (!isGoogleDriveConfigured()) {
      throw new Error('Google OAuth not configured - missing client ID');
    }

    // Use edge function to refresh token (keeps client_secret server-side)
    const supabaseUrl = SUPABASE_CONFIG.url;
    
    // Get auth token for edge function authentication
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required for token refresh');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/google-drive-token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.credentials.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await getApiErrorDetails(response);
      throw new Error(`Token refresh failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    
    // Validate response
    if (!data.access_token || !data.expires_in) {
      throw new Error('Invalid token refresh response');
    }
    
    this.credentials = {
      provider: 'google-drive',
      accessToken: data.access_token,
      refreshToken: this.credentials.refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    // Save updated credentials based on encryption mode
    if (isE2EEnabled() && this.masterKey) {
      await CloudCredentialStorage.saveCredentials(this.credentials, this.masterKey);
    } else {
      SimpleModeCredentialStorage.saveGoogleDriveCredentials(this.credentials);
    }
  }

  private async apiCall(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.ensureValidToken();
    
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      // BUG FIX: Only refresh on 401 if not already refreshing
      // Prevents race condition with multiple concurrent 401 responses
      if (res.status === 401 && !this.refreshPromise) {
        await this.refreshToken();
        const newToken = await this.ensureValidToken();
        return fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${newToken}`,
            ...options.headers,
          },
        });
      }

      return res;
    }, {
      shouldRetry: (error) => {
        const status = error?.status;
        return !status || status >= 500 || status === 429;
      },
    });

    return response;
  }

  async upload(filePath: string, content: string): Promise<void> {
    // Use write queue to serialize uploads and prevent rate limiting
    return this.queueWriteOperation(async () => {
      const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
      
      // Check if file already exists to UPDATE instead of creating duplicate
      // This prevents checksum mismatches during transfer verification
      let existingFileId: string | null = this.fileIdCache.get(fileName) || null;
      
      if (!existingFileId) {
        const escapedName = fileName.replace(/'/g, "\\'");
        const searchResponse = await this.apiCall(
          `https://www.googleapis.com/drive/v3/files?q=name='${escapedName}' and 'appDataFolder' in parents&spaces=appDataFolder&fields=files(id)`
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.files?.length > 0) {
            existingFileId = searchData.files[0].id;
          }
        }
      }
      
      let response: Response;
      
      if (existingFileId) {
        // UPDATE existing file (prevents duplicates)
        response = await this.apiCall(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
          { 
            method: 'PATCH', 
            body: content, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
        
        // Handle 404 - file was deleted between search and update, fall back to create
        if (response.status === 404) {
          console.log(`📝 File not found on update (deleted?), creating new: ${fileName}`);
          existingFileId = null; // Clear so we fall through to create
          this.fileIdCache.delete(fileName); // Remove stale cache entry
        }
      }
      
      if (!existingFileId) {
        // CREATE new file
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
          parents: ['appDataFolder']
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        response = await this.apiCall(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          { method: 'POST', body: form }
        );
        
        // Cache the new file ID
        if (response.ok) {
          const data = await response.clone().json();
          if (data.id) {
            this.fileIdCache.set(fileName, data.id);
          }
        }
      }

      // Handle rate limiting on upload
      if (response.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!response.ok) {
        const error = await getApiErrorDetails(response);
        throw new Error(`Google Drive upload failed (${response.status}): ${error}`);
      }
    });
  }

  async download(filePath: string): Promise<string | null> {
    const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
    
    // Check file ID cache first (populated by listFiles during sync)
    const fileId = this.fileIdCache.get(fileName);
    
    // FAST PATH: File ID is cached, use minimal throttling for maximum speed
    if (fileId) {
      return this.throttler.fastRead(async () => {
        const downloadResponse = await this.apiCall(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
        );

        if (downloadResponse.status === 429) {
          const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
          rateLimitError.status = 429;
          throw rateLimitError;
        }

        if (!downloadResponse.ok) {
          if (downloadResponse.status === 404) return null;
          const error = await getApiErrorDetails(downloadResponse);
          throw new Error(`Google Drive download failed (${downloadResponse.status}): ${error}`);
        }

        return await downloadResponse.text();
      });
    }
    
    // SLOW PATH: Need to search first (uses regular throttle)
    return this.throttledRequest(async () => {
      if (import.meta.env.DEV) {
        console.log(`📂 File ID not in cache, searching: ${fileName}`);
      }
      
      const escapedName = fileName.replace(/'/g, "\\'");
      const searchResponse = await this.apiCall(
        `https://www.googleapis.com/drive/v3/files?q=name='${escapedName}' and 'appDataFolder' in parents&spaces=appDataFolder&fields=files(id,modifiedTime)`
      );

      if (searchResponse.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!searchResponse.ok) {
        const error = await getApiErrorDetails(searchResponse);
        throw new Error(`Google Drive search failed (${searchResponse.status}): ${error}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.files || searchData.files.length === 0) return null;

      // Pick latest by modifiedTime (same logic as listFiles dedup) - not arbitrary files[0]
      const sorted = (searchData.files as { id: string; modifiedTime?: string }[]).sort(
        (a: { modifiedTime?: string }, b: { modifiedTime?: string }) =>
          (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
      );
      const foundFileId = sorted[0].id;
      this.fileIdCache.set(fileName, foundFileId);
      
      const downloadResponse = await this.apiCall(
        `https://www.googleapis.com/drive/v3/files/${foundFileId}?alt=media`
      );

      if (downloadResponse.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!downloadResponse.ok) {
        if (downloadResponse.status === 404) return null;
        const error = await getApiErrorDetails(downloadResponse);
        throw new Error(`Google Drive download failed (${downloadResponse.status}): ${error}`);
      }

      return await downloadResponse.text();
    });
  }

  async listFiles(directoryPath: string): Promise<CloudFile[]> {
    return this.throttledRequest(async () => {
      const allFiles: any[] = [];
      let pageToken: string | undefined;

      // Pagination: fetch all pages so sync never completes with partial/empty list
      do {
        const query = new URLSearchParams({
          spaces: 'appDataFolder',
          pageSize: '1000',
          fields: 'files(id,name,modifiedTime,size),nextPageToken',
          ...(pageToken ? { pageToken } : {}),
        });
        const response = await this.apiCall(
          `https://www.googleapis.com/drive/v3/files?${query.toString()}`
        );

        if (response.status === 429) {
          const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
          rateLimitError.status = 429;
          throw rateLimitError;
        }

        if (!response.ok) {
          const error = await getApiErrorDetails(response);
          throw new Error(`Google Drive list failed (${response.status}): ${error}`);
        }

        const data = await response.json();
        allFiles.push(...(data.files || []));
        pageToken = data.nextPageToken || undefined;
      } while (pageToken);

      // Google Drive uses flat appDataFolder - simulate folder structure for consistency
      const files: CloudFile[] = allFiles.map((file: any) => {
        let path: string;
        if (file.name === 'encryption-key.json') {
          path = '/OwnJournal/encryption-key.json';
        } else if (file.name.startsWith('trend_analysis')) {
          path = `/OwnJournal/analysis/${file.name}`;
        } else if (file.name.startsWith('entry-') && file.name.endsWith('.json')) {
          path = `/OwnJournal/entries/${file.name}`;
        } else if (file.name === 'operations.log') {
          path = `/OwnJournal/${file.name}`;
        } else if (file.name.startsWith('op-device-') && file.name.endsWith('.json')) {
          path = `/OwnJournal/operations/${file.name}`;
        } else if (file.name === 'state-snapshot.json') {
          path = `/OwnJournal/operations/${file.name}`;
        } else {
          path = `/OwnJournal/${file.name}`;
        }
        return {
          name: file.name,
          path,
          modifiedAt: new Date(file.modifiedTime),
          size: parseInt(file.size) || 0,
        };
      });

      // Deduplicate by file name (keep latest) - Google Drive can have duplicate names
      const filesByName = new Map<string, CloudFile>();
      for (const cloudFile of files) {
        const existing = filesByName.get(cloudFile.name);
        if (!existing || cloudFile.modifiedAt > existing.modifiedAt) {
          filesByName.set(cloudFile.name, cloudFile);
        }
      }

      // Rebuild fileIdCache from DEDUPLICATED list so download() always targets the same file as listFiles()
      this.fileIdCache.clear();
      for (const cloudFile of filesByName.values()) {
        const rawFile = allFiles.find(
          (f: any) =>
            f.name === cloudFile.name &&
            new Date(f.modifiedTime).getTime() === cloudFile.modifiedAt.getTime()
        );
        if (rawFile) this.fileIdCache.set(rawFile.name, rawFile.id);
      }

      return Array.from(filesByName.values());
    });
  }

  async delete(filePath: string): Promise<void> {
    // Use write queue to serialize deletes and prevent rate limiting
    return this.queueWriteOperation(async () => {
      const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
      const escapedName = fileName.replace(/'/g, "\\'");
      
      const searchResponse = await this.apiCall(
        `https://www.googleapis.com/drive/v3/files?q=name='${escapedName}' and 'appDataFolder' in parents&spaces=appDataFolder&fields=files(id)`
      );

      // Handle rate limiting on search
      if (searchResponse.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!searchResponse.ok) {
        const error = await getApiErrorDetails(searchResponse);
        throw new Error(`Google Drive search failed (${searchResponse.status}): ${error}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.files || searchData.files.length === 0) return;

      // Delete ALL files matching this name (appDataFolder can have duplicates)
      const BATCH_DELAY_MS = 50;
      for (let i = 0; i < searchData.files.length; i++) {
        const fileId = searchData.files[i].id;
        const deleteResponse = await this.apiCall(
          `https://www.googleapis.com/drive/v3/files/${fileId}`,
          { method: 'DELETE' }
        );

        if (deleteResponse.status === 429) {
          const rateLimitError = new Error('RATE_LIMITED: Google Drive API rate limit exceeded') as Error & { status: number };
          rateLimitError.status = 429;
          throw rateLimitError;
        }

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const error = await getApiErrorDetails(deleteResponse);
          throw new Error(`Google Drive delete failed (${deleteResponse.status}): ${error}`);
        }

        if (i < searchData.files.length - 1) {
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    });
  }

  async exists(filePath: string): Promise<boolean> {
    return this.throttledRequest(async () => {
      try {
        const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
        const escapedName = fileName.replace(/'/g, "\\'");
        
        const response = await this.apiCall(
          `https://www.googleapis.com/drive/v3/files?q=name='${escapedName}' and 'appDataFolder' in parents&spaces=appDataFolder&fields=files(id)`
        );

        if (!response.ok) return false;

        const data = await response.json();
        return data.files && data.files.length > 0;
      } catch {
        return false;
      }
    });
  }
}
