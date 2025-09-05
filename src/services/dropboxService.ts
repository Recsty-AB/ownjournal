// Dropbox API service with proper token management and retry logic
import { CloudCredentialStorage, type DropboxCredentials } from '@/utils/cloudCredentialStorage';
import { SimpleModeCredentialStorage } from '@/utils/simpleModeCredentialStorage';
import { isE2EEnabled } from '@/utils/encryptionModeStorage';
import { retryWithBackoff, sanitizeFileName, getApiErrorDetails } from '@/utils/cloudRetry';
import { RequestThrottler } from '@/utils/requestThrottler';
import type { CloudProvider, CloudFile } from '@/types/cloudProvider';
import { oauthConfig, isDropboxConfigured } from '@/config/oauth';

export class DropboxService implements CloudProvider {
  name = 'Dropbox';
  isConnected = false;
  private credentials: DropboxCredentials | null = null;
  private masterKey: CryptoKey | null = null;
  private refreshPromise: Promise<void> | null = null;
  
  // Shared throttler for consistent rate limiting across all storage providers
  private throttler = new RequestThrottler();
  private createdDirectories = new Set<string>();
  
  // Debug logging flag - can be enabled to see detailed sync info in production
  private debugLogging = false;

  constructor() {}

  /**
   * Enable or disable debug logging for detailed sync information
   * Useful for troubleshooting 409 errors in production
   */
  public enableDebugLogging(enable: boolean = true): void {
    this.debugLogging = enable;
    console.log(`🔧 Dropbox debug logging ${enable ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if debug logging is enabled
   */
  public isDebugLoggingEnabled(): boolean {
    return this.debugLogging;
  }

  /**
   * Enable/disable bulk sync mode for faster writes during sync (30ms delay between uploads/deletes).
   */
  setBulkSyncMode(enabled: boolean): void {
    this.throttler.setBulkSyncMode(enabled);
  }

  private shouldLog(): boolean {
    return import.meta.env.DEV || this.debugLogging;
  }

  /**
   * Parse and log detailed 409 error information for debugging
   */
  private log409Error(
    operation: 'upload' | 'download' | 'list' | 'delete' | 'metadata',
    path: string,
    errorText: string
  ): { errorTag: string; errorSummary: string; isNotFound: boolean; isConflict: boolean; isRateLimit: boolean } {
    let errorTag = 'unknown';
    let errorSummary = errorText;
    let isNotFound = false;
    let isConflict = false;
    let isRateLimit = false;

    try {
      const errorData = JSON.parse(errorText);
      errorTag = errorData?.error?.['.tag'] || 
                 errorData?.error?.reason?.['.tag'] ||
                 errorData?.error_summary?.split('/')[0] || 
                 'unknown';
      errorSummary = errorData?.error_summary || errorText;
      
      isNotFound = errorSummary.includes('not_found') || errorTag === 'path_lookup';
      isConflict = errorSummary.includes('conflict') || errorTag === 'path';
      isRateLimit = errorSummary.includes('too_many_write_operations');
    } catch {
      // Parse failed - use raw text
      isNotFound = errorText.includes('not_found');
      isConflict = errorText.includes('conflict');
      isRateLimit = errorText.includes('too_many_write_operations');
    }

    if (this.shouldLog()) {
      console.warn(
        `⚠️ [Dropbox 409] ${operation.toUpperCase()} "${path}"\n` +
        `   Tag: ${errorTag}\n` +
        `   Summary: ${errorSummary}\n` +
        `   Type: ${isNotFound ? 'NOT_FOUND' : isConflict ? 'CONFLICT' : isRateLimit ? 'RATE_LIMIT' : 'OTHER'}`
      );
    }

    return { errorTag, errorSummary, isNotFound, isConflict, isRateLimit };
  }

  async connect(credentials: DropboxCredentials, masterKey: CryptoKey | null = null): Promise<void> {
    this.credentials = credentials;
    this.masterKey = masterKey;
    this.isConnected = true;
    
    // NOTE: Credential saving is handled by the caller (DropboxSync component or connectionStateManager)
    // Removing duplicate save here to prevent mode mismatch issues where credentials
    // get saved to the wrong storage (simple vs E2E) during auto-reconnection
  }

  async disconnect(): Promise<void> {
    // PRIVACY: Revoke token on Dropbox's side
    if (this.credentials?.accessToken) {
      try {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
          },
        });
      } catch (error) {
        // Non-critical: log but don't throw
        if (this.shouldLog()) {
          console.warn('Failed to revoke Dropbox token:', error);
        }
      }
    }
    
    // CRITICAL: Remove credentials from storage (both E2E and Simple modes)
    if (isE2EEnabled() && this.masterKey) {
      try {
        await CloudCredentialStorage.removeCredentials('dropbox', this.masterKey);
      } catch (error) {
        if (this.shouldLog()) {
          console.warn('Failed to remove encrypted Dropbox credentials:', error);
        }
      }
    } else {
      SimpleModeCredentialStorage.clearDropboxCredentials();
    }
    
    // Clear sensitive data from memory
    this.credentials = null;
    this.masterKey = null;
    this.isConnected = false;
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.credentials) throw new Error('Dropbox not connected');

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

    const clientId = oauthConfig.dropbox.clientId;

    if (!isDropboxConfigured()) {
      throw new Error('Dropbox OAuth not configured - missing client ID');
    }

    // Note: Refresh token request does NOT require client secret when using PKCE
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await getApiErrorDetails(response);
      
      // CRITICAL: Handle invalid/expired refresh token (400/401) by forcing disconnect
      if (response.status === 400 || response.status === 401) {
        if (this.shouldLog()) {
          console.error('🔴 Dropbox token refresh failed with auth error - credentials are invalid');
        }
        // Clear invalid credentials from storage
        await this.forceCleanup();
        throw new Error(`INVALID_CREDENTIALS: ${error}`);
      }
      
      throw new Error(`Token refresh failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    
    // Validate response
    if (!data.access_token || !data.expires_in) {
      throw new Error('Invalid token refresh response');
    }
    
    this.credentials = {
      provider: 'dropbox',
      accessToken: data.access_token,
      refreshToken: this.credentials.refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    // Save updated credentials based on encryption mode
    if (isE2EEnabled() && this.masterKey) {
      await CloudCredentialStorage.saveCredentials(this.credentials, this.masterKey);
    } else {
      SimpleModeCredentialStorage.saveDropboxCredentials(this.credentials);
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

  /**
   * Remove the /OwnJournal prefix for Dropbox since files are already in Apps/OwnJournal/
   * This prevents double nesting like Apps/OwnJournal/OwnJournal
   */
  private normalizeDropboxPath(filePath: string): string {
    // Strip /OwnJournal prefix since Dropbox app folder already provides organization
    let normalized = filePath.replace(/^\/OwnJournal\/?/i, '');
    
    // Return empty string for root folder (Dropbox API requirement)
    if (!normalized || normalized === '/') {
      return '';
    }
    
    // Ensure path starts with / for non-root paths
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    // Remove double slashes and sanitize each segment
    normalized = normalized.replace(/\/+/g, '/');
    const segments = normalized.split('/').filter(Boolean).map(sanitizeFileName).filter(Boolean);
    
    return segments.length > 0 ? '/' + segments.join('/') : '';
  }

  /**
   * Throttle requests to avoid rate limiting (delegates to shared throttler)
   */
  private throttledRequest<T>(operation: () => Promise<T>): Promise<T> {
    return this.throttler.throttledRequest(operation);
  }

  /**
   * Ensure parent directory exists before upload
   * Dropbox auto-creates folders on upload, but this handles edge cases
   * Uses caching to avoid redundant API calls
   * IMPROVED: Checks if folder exists FIRST to avoid 409 errors in DevTools
   */
  private async ensureDirectory(path: string): Promise<void> {
    if (!path || path === '/') return;
    
    // Extract parent directory from path
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) return; // Root level, no parent needed
    
    const parentDir = path.substring(0, lastSlash);
    if (!parentDir || parentDir === '/') return;
    
    // Skip if already created in this session (avoids redundant API calls)
    if (this.createdDirectories.has(parentDir)) {
      return;
    }
    
    try {
      // IMPROVEMENT: Check if folder exists FIRST to avoid 409 error in DevTools
      const checkResponse = await this.throttledRequest(() => 
        this.apiCall('https://api.dropboxapi.com/2/files/get_metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: parentDir })
        })
      );
      
      if (checkResponse.ok) {
        // Folder already exists - cache and return (no 409 error!)
        this.createdDirectories.add(parentDir);
        if (this.shouldLog()) {
          console.log(`📁 Dropbox: Directory ${parentDir} already exists`);
        }
        return;
      }
      
      // If 409 with path/not_found, folder doesn't exist - create it
      // Other errors will fall through to the catch block
    } catch (error) {
      // Continue to create folder if check failed
    }
    
    try {
      // Create folder since it doesn't exist
      const response = await this.throttledRequest(() => 
        this.apiCall('https://api.dropboxapi.com/2/files/create_folder_v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: parentDir, autorename: false })
        })
      );
      
      // Cache the directory as created
      this.createdDirectories.add(parentDir);
      
      if (response.ok) {
        if (this.shouldLog()) {
          console.log(`📁 Dropbox: Created directory ${parentDir}`);
        }
      }
    } catch (error) {
      // Non-critical: folder may already exist - cache it anyway
      this.createdDirectories.add(parentDir);
      if (this.shouldLog()) {
        console.log(`📁 Dropbox: Directory ${parentDir} may already exist`);
      }
    }
  }

  /**
   * Parse Dropbox error response for rate limiting details
   */
  private parseRateLimitError(errorText: string): { isTooManyWrites: boolean; retryAfter: number } {
    try {
      const errorData = JSON.parse(errorText);
      const errorSummary = errorData?.error_summary || errorData?.error?.reason?.['.tag'] || '';
      const isTooManyWrites = errorSummary.includes('too_many_write_operations') || 
                              errorText.includes('too_many_write_operations');
      const retryAfter = errorData?.error?.retry_after || 
                         errorData?.retry_after || 
                         (isTooManyWrites ? 2 : 1); // Default 2s for write operations, 1s otherwise
      return { isTooManyWrites, retryAfter };
    } catch {
      return { isTooManyWrites: errorText.includes('too_many_write_operations'), retryAfter: 2 };
    }
  }

  /**
   * Queue a write operation to serialize uploads and prevent "too_many_write_operations"
   * Delegates to shared throttler for consistent behavior across all storage providers
   */
  private queueWriteOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.throttler.queueWriteOperation(operation);
  }

  async upload(filePath: string, content: string): Promise<void> {
    // Queue upload to serialize write operations
    return this.queueWriteOperation(async () => {
      // Normalize path to avoid double OwnJournal nesting
      const sanitizedPath = this.normalizeDropboxPath(filePath);
      
      if (this.shouldLog()) {
        console.log(`📤 Dropbox upload: ${sanitizedPath}`);
      }
      
      // Ensure parent directory exists for nested paths
      if (sanitizedPath.includes('/')) {
        await this.ensureDirectory(sanitizedPath);
      }
      
      // Throttle uploads to avoid rate limiting
      const response = await this.throttledRequest(() => 
        this.apiCall('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            'Dropbox-API-Arg': JSON.stringify({
              path: sanitizedPath,
              mode: 'overwrite',
              autorename: false
            }),
            'Content-Type': 'application/octet-stream'
          },
          body: content
        })
      );

      if (!response.ok) {
        const error = await getApiErrorDetails(response);
        const { isTooManyWrites, retryAfter } = this.parseRateLimitError(error);
        
        // Enhanced 409 logging for uploads
        if (response.status === 409) {
          const { isRateLimit, isConflict, errorTag } = this.log409Error('upload', sanitizedPath, error);
          
          if (isConflict && !isRateLimit) {
            // Log detailed conflict info for debugging
            if (this.shouldLog()) {
              console.warn(`📝 [Dropbox] Conflict on upload (${errorTag}) - file may have been modified externally`);
            }
          }
        }
        
        // Check for rate limiting (429) or too_many_write_operations (409)
        if (response.status === 429 || (response.status === 409 && isTooManyWrites)) {
          if (this.shouldLog()) {
            console.log(`⏱️ Dropbox ${isTooManyWrites ? 'too many writes' : 'rate limited'}, waiting ${retryAfter}s before retry...`);
          }
          
          // Wait with exponential backoff for write rate limits
          const waitTime = isTooManyWrites ? retryAfter * 1000 * 1.5 : retryAfter * 1000;
          await new Promise(r => setTimeout(r, waitTime));
          
          // Retry once after waiting
          const retryResponse = await this.throttledRequest(() => 
            this.apiCall('https://content.dropboxapi.com/2/files/upload', {
              method: 'POST',
              headers: {
                'Dropbox-API-Arg': JSON.stringify({
                  path: sanitizedPath,
                  mode: 'overwrite',
                  autorename: false
                }),
                'Content-Type': 'application/octet-stream'
              },
              body: content
            })
          );
          if (!retryResponse.ok) {
            const retryError = await getApiErrorDetails(retryResponse);
            throw new Error(`DROPBOX_RATE_LIMITED: Dropbox upload failed after retry (${retryResponse.status}): ${retryError}`);
          }
          return;
        }
        
        throw new Error(`Dropbox upload failed (${response.status}): ${error}`);
      }
    });
  }

  async download(filePath: string): Promise<string | null> {
    // Normalize path to avoid double OwnJournal nesting
    const sanitizedPath = this.normalizeDropboxPath(filePath);
    
    if (this.shouldLog()) {
      console.log(`📥 Dropbox download: ${sanitizedPath}`);
    }
    
    // Throttle downloads to avoid rate limiting
    const response = await this.throttledRequest(() => 
      this.apiCall('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({ path: sanitizedPath })
        }
      })
    );

    if (response.ok) return await response.text();
    
    // File not found - return null (this is expected)
    if (response.status === 409) {
      const errorText = await response.text().catch(() => '');
      const { isNotFound, errorTag, errorSummary } = this.log409Error('download', sanitizedPath, errorText);
      
      if (isNotFound) {
        // Expected case: file doesn't exist
        return null;
      }
      // Other 409 error - throw to let caller handle
      throw new Error(`Dropbox download failed (409 ${errorTag}): ${errorSummary}`);
    }
    
    // STEP 5: Rate limited - throw specific error with retry info
    // This allows callers to distinguish between "file doesn't exist" and "temporarily unavailable"
    if (response.status === 429) {
      // Extract Retry-After header if present
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader 
        ? parseInt(retryAfterHeader, 10) * 1000 
        : 5000; // Default 5s
      
      if (this.shouldLog()) {
        console.log(`⏱️ Dropbox download rate limited for ${sanitizedPath}, retry after ${retryAfterMs}ms`);
      }
      
      // Throw a structured error with retry info
      const rateLimitError = new Error(`RATE_LIMITED: Dropbox API rate limit exceeded, retry after ${retryAfterMs}ms`) as Error & { 
        status: number; 
        retryAfterMs: number 
      };
      rateLimitError.status = 429;
      rateLimitError.retryAfterMs = retryAfterMs;
      throw rateLimitError;
    }
    
    const error = await getApiErrorDetails(response);
    throw new Error(`Dropbox download failed (${response.status}): ${error}`);
  }

  async listFiles(directoryPath: string): Promise<CloudFile[]> {
    // Normalize path to avoid double OwnJournal nesting
    let sanitizedPath = directoryPath 
      ? this.normalizeDropboxPath(directoryPath)
      : '';
    
    // CRITICAL: Dropbox requires empty string for root folder, not "/"
    if (sanitizedPath === '/') {
      sanitizedPath = '';
    }
    
    if (this.shouldLog()) {
      console.log(`📂 Dropbox listFiles: "${sanitizedPath}" (root=${sanitizedPath === ''})`);
    }
    
    const response = await this.apiCall('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: sanitizedPath
      })
    });

    // Folder doesn't exist - log clearly, optionally retry with legacy path (root) for entries
    if (response.status === 409) {
      const errorText = await response.text().catch(() => '');
      if (this.shouldLog()) {
        console.warn(`⚠️ Dropbox list_folder 409 for path "${sanitizedPath || '(root)'}"`, errorText);
      }
      this.log409Error('list', sanitizedPath || '(root)', errorText);
      // Legacy path: if we were listing the entries folder, retry once by listing app root and filtering to entry files
      const isEntriesPath = sanitizedPath === '/entries' || sanitizedPath === 'entries';
      if (isEntriesPath) {
        const fromRoot = await this.listFilesFromRootFilterEntries();
        if (fromRoot.length > 0 && this.shouldLog()) {
          console.log(`📂 Dropbox list_folder: 409 on /entries, found ${fromRoot.length} entry files via root listing`);
        }
        return fromRoot;
      }
      return [];
    }
    
    // Handle rate limiting on listFiles
    if (response.status === 429) {
      const rateLimitError = new Error('RATE_LIMITED: Dropbox API rate limit exceeded') as Error & { status: number };
      rateLimitError.status = 429;
      throw rateLimitError;
    }
    
    if (!response.ok) {
      const error = await getApiErrorDetails(response);
      throw new Error(`Dropbox list failed (${response.status}): ${error}`);
    }

    const data = await response.json();
    const allEntries: any[] = [...(data.entries || [])];

    // Pagination: follow cursor until all entries are fetched (fixes first-time sync returning 0 entries)
    let cursor = data.cursor;
    let hasMore = data.has_more === true;
    while (hasMore && cursor) {
      const continueResponse = await this.apiCall('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor }),
      });

      if (continueResponse.status === 409) {
        // Cursor expired or invalid - fail so sync can retry with fresh list_folder
        const errorText = await continueResponse.text().catch(() => '');
        if (this.shouldLog()) {
          console.warn('⚠️ Dropbox list_folder/continue 409 (cursor expired?), failing list:', errorText);
        }
        throw new Error('Dropbox list_folder cursor expired; sync will retry');
      }
      if (continueResponse.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Dropbox API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }
      if (!continueResponse.ok) {
        const error = await getApiErrorDetails(continueResponse);
        throw new Error(`Dropbox list_folder/continue failed (${continueResponse.status}): ${error}`);
      }

      const nextData = await continueResponse.json();
      allEntries.push(...(nextData.entries || []));
      cursor = nextData.cursor;
      hasMore = nextData.has_more === true;
    }

    return this.entriesToCloudFiles(allEntries);
  }

  /** Map raw list_folder entries to CloudFile[] (files only, path normalized). Deduplicate by path (keep latest). */
  private entriesToCloudFiles(entries: any[]): CloudFile[] {
    const files = entries
      .filter((entry: any) => entry['.tag'] === 'file')
      .map((entry: any) => {
        const dropboxPath = entry.path_display as string;
        const fullPath = dropboxPath.startsWith('/OwnJournal')
          ? dropboxPath
          : `/OwnJournal${dropboxPath}`;
        return {
          name: entry.name,
          path: fullPath,
          modifiedAt: new Date(entry.server_modified),
          size: entry.size || 0,
        };
      });
    const byPath = new Map<string, CloudFile>();
    for (const f of files) {
      const existing = byPath.get(f.path);
      if (!existing || f.modifiedAt > existing.modifiedAt) {
        byPath.set(f.path, f);
      }
    }
    return Array.from(byPath.values());
  }

  /**
   * Legacy path fallback: list app root with pagination and return only entry files.
   * Used when list_folder on /entries returns 409 (folder not found).
   */
  private async listFilesFromRootFilterEntries(): Promise<CloudFile[]> {
    const response = await this.apiCall('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '' }),
    });
    if (response.status === 409 || response.status === 429 || !response.ok) {
      return [];
    }
    const data = await response.json();
    const allEntries: any[] = [...(data.entries || [])];
    let cursor = data.cursor;
    let hasMore = data.has_more === true;
    while (hasMore && cursor) {
      const continueResponse = await this.apiCall('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor }),
      });
      if (continueResponse.status !== 200 || !continueResponse.ok) {
        break;
      }
      const nextData = await continueResponse.json();
      allEntries.push(...(nextData.entries || []));
      cursor = nextData.cursor;
      hasMore = nextData.has_more === true;
    }
    const entryFiles = allEntries.filter(
      (e: any) =>
        e['.tag'] === 'file' &&
        (String(e.path_display || '').includes('entries') || (e.name?.startsWith('entry-') && e.name?.endsWith('.json')))
    );
    return this.entriesToCloudFiles(entryFiles);
  }

  async delete(filePath: string): Promise<void> {
    // Normalize path to avoid double OwnJournal nesting
    const sanitizedPath = this.normalizeDropboxPath(filePath);
    
    if (this.shouldLog()) {
      console.log(`🗑️ Dropbox delete: ${sanitizedPath}`);
    }
    
    const response = await this.apiCall('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: sanitizedPath })
    });

    // Handle rate limiting (429) - throw specific error for caller to handle
    if (response.status === 429) {
      const rateLimitError = new Error('RATE_LIMITED: Dropbox API rate limit exceeded') as Error & { status: number };
      rateLimitError.status = 429;
      throw rateLimitError;
    }

    // Log 409 errors on delete for debugging (but don't throw - file may not exist)
    if (response.status === 409) {
      const errorText = await response.text().catch(() => '');
      this.log409Error('delete', sanitizedPath, errorText);
      return; // 409 on delete is typically "file not found" - not an error
    }
    
    if (!response.ok) {
      const error = await getApiErrorDetails(response);
      throw new Error(`Dropbox delete failed (${response.status}): ${error}`);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      // Normalize path to avoid double OwnJournal nesting
      const sanitizedPath = this.normalizeDropboxPath(filePath);
      
      if (this.shouldLog()) {
        console.log(`🔍 Dropbox exists: ${sanitizedPath}`);
      }
      
      const response = await this.apiCall('https://api.dropboxapi.com/2/files/get_metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: sanitizedPath })
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  // Force cleanup of all credentials - used when tokens are invalid
  private async forceCleanup(): Promise<void> {
    if (this.shouldLog()) {
      console.log('🧹 Dropbox: Force cleaning up invalid credentials');
    }
    
    // Clear from both storage systems
    CloudCredentialStorage.clearCredentials('dropbox');
    SimpleModeCredentialStorage.clearDropboxCredentials();
    
    // Clear memory state
    this.credentials = null;
    this.masterKey = null;
    this.isConnected = false;
  }

  // Check if credentials are valid (for external validation)
  async validateConnection(): Promise<boolean> {
    if (!this.credentials) return false;
    
    try {
      // Try to get account info - lightweight API call
      const token = await this.ensureValidToken();
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          await this.forceCleanup();
          return false;
        }
      }
      
      return response.ok;
    } catch (error) {
      if (error instanceof Error && error.message.includes('INVALID_CREDENTIALS')) {
        return false;
      }
      // Network errors shouldn't invalidate credentials
      return this.isConnected;
    }
  }
}

// Singleton instance for debug logging toggle from UI
export const dropboxService = new DropboxService();
