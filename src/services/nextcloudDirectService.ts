// Direct WebDAV client for Nextcloud - Privacy-first, no backend proxy
import { CloudProvider, CloudFile } from '@/types/cloudProvider';
import { isSSLError } from '@/utils/cloudRetry';
import { RequestThrottler } from '@/utils/requestThrottler';
import { CloudErrorCode, createCloudError } from '@/utils/cloudErrorCodes';
interface NextcloudConfig {
  serverUrl: string;
  username: string;
  appPassword: string;
}

export class NextcloudDirectService implements CloudProvider {
  name = 'Nextcloud';
  isConnected = false;
  private config: NextcloudConfig | null = null;
  
  // Shared throttler for consistent rate limiting across all storage providers
  private throttler = new RequestThrottler();

  constructor() {}

  /**
   * Enable/disable bulk sync mode for faster writes during sync (30ms delay between uploads/deletes).
   */
  setBulkSyncMode(enabled: boolean): void {
    this.throttler.setBulkSyncMode(enabled);
  }

  /**
   * Connect with credentials
   */
  connect(config: NextcloudConfig): void {
    this.config = config;
    this.isConnected = true;
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.config = null;
    this.isConnected = false;
  }

  /**
   * Get display config (serverUrl and username only, no password)
   */
  getDisplayConfig(): { serverUrl: string; username: string } | null {
    if (!this.config) return null;
    return {
      serverUrl: this.config.serverUrl,
      username: this.config.username
    };
  }

  /**
   * Get WebDAV URL for a path
   */
  private getWebdavUrl(path: string): string {
    if (!this.config) throw new Error('Not connected');
    
    let baseUrl = this.config.serverUrl.replace(/\/$/, '');
    
    // Defensive: ensure URL has protocol to prevent relative path issues
    if (!baseUrl.match(/^https?:\/\//i)) {
      baseUrl = `https://${baseUrl}`;
    }
    
    const cleanPath = path.replace(/^\/+/, '');
    return `${baseUrl}/remote.php/webdav/${cleanPath}`;
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): string {
    if (!this.config) throw new Error('Not connected');
    return 'Basic ' + btoa(`${this.config.username}:${this.config.appPassword}`);
  }

  /**
   * Ensure directory exists - handles missing folders gracefully
   */
  private async ensureDirectory(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      const url = this.getWebdavUrl(dirPath);

      // 1) Check if it already exists (cheap and avoids noisy MKCOL errors)
      try {
        const head = await fetch(url.endsWith('/') ? url : `${url}/`, {
          method: 'PROPFIND',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Depth': '0',
          },
        });
        if (head.ok || head.status === 207) {
          continue; // directory exists
        }
        // If 404, folder doesn't exist, we'll create it below
      } catch (_) {
        // Ignore network hiccups here, we'll try MKCOL next
      }

      // 2) Try to create the directory
      const mkcol = await fetch(url, {
        method: 'MKCOL',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      // Success: 201 Created. Also treat 405 (Method Not Allowed) as "already exists"
      if (mkcol.status === 201 || mkcol.status === 405) {
        continue;
      }

      // Handle 403 Forbidden - likely Nextcloud encryption issue
      if (mkcol.status === 403) {
        const errorText = await mkcol.text().catch(() => '');
        if (errorText.toLowerCase().includes('decrypt') || errorText.toLowerCase().includes('encryption')) {
          throw new Error(`Nextcloud server-side encryption blocking folder creation for ${dirPath}. Please create the OwnJournal folder manually via Nextcloud web interface, or disable server-side encryption in Nextcloud settings.`);
        }
        // If 403 on a subfolder (like operations), treat as non-fatal - folder might exist with permission issues
        if (dirPath !== 'OwnJournal') {
          if (import.meta.env.DEV) console.warn(`Permission denied creating ${dirPath}, treating as existing`);
          continue;
        }
        throw new Error(`Permission denied creating ${dirPath}. Check Nextcloud folder permissions.`);
      }

      // If we get 500 error, it might be Nextcloud encryption issue
      if (mkcol.status === 500) {
        const errorText = await mkcol.text().catch(() => '');
        if (errorText.toLowerCase().includes('decrypt') || errorText.toLowerCase().includes('encryption')) {
          throw new Error(`Nextcloud server-side encryption error creating ${dirPath}. Please create the OwnJournal folder manually via Nextcloud web interface, or disable server-side encryption in Nextcloud settings.`);
        }
        throw new Error(`Nextcloud server error (500) creating directory ${dirPath}. This may be due to server-side encryption issues.`);
      }

      // If parent not found (409) something is off with path ordering, but loop builds parents first
      if (!mkcol.ok) {
        throw new Error(`Failed to ensure directory ${dirPath}: ${mkcol.status} ${mkcol.statusText}`);
      }
    }
  }

  /**
   * Test connection
   */
  async test(): Promise<boolean> {
    if (!this.config) return false;

    try {
      const url = this.getWebdavUrl('');
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Depth': '0',
        },
      });

      // 207 Multi-Status is success for WebDAV PROPFIND
      if (response.ok || response.status === 207) {
        return true;
      }

      // Surface auth and other HTTP errors explicitly
      const status = response.status;
      const statusText = response.statusText || 'Request failed';
      if (status === 401) {
        throw new Error('401 Unauthorized');
      }
      throw new Error(`${status} ${statusText}`);
    } catch (error) {
      // Detect SSL certificate errors and throw specific error
      if (isSSLError(error)) {
        throw new Error('SSL_CERTIFICATE_ERROR: The server\'s SSL certificate is invalid, expired, or untrusted. Please check your server\'s HTTPS configuration.');
      }
      // Important: rethrow so callers can detect CORS/Network errors
      throw error;
    }
  }

  /**
   * Upload file - uses write queue to serialize uploads
   */
  async upload(filePath: string, content: string): Promise<void> {
    if (!this.config) throw new Error('Not connected to Nextcloud');

    // Use write queue to serialize uploads and prevent rate limiting
    return this.throttler.queueWriteOperation(async () => {
      // Ensure parent directory exists
      const pathParts = filePath.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join('/');
        await this.ensureDirectory(parentPath);
      }

      const url = this.getWebdavUrl(filePath);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: content,
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Nextcloud API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!response.ok) {
        // Provide more specific error messages using CloudErrorCodes
        if (response.status === 500) {
          // Try to get more details from response body
          const errorText = await response.text().catch(() => '');
          
          // Check for Nextcloud encryption errors in response
          if (errorText.toLowerCase().includes('decrypt') || errorText.toLowerCase().includes('encryption')) {
            throw createCloudError(CloudErrorCode.ENCRYPTION_ERROR, { 
              file: filePath, 
              status: 500,
              provider: 'Nextcloud'
            });
          } else {
            throw createCloudError(CloudErrorCode.SERVER_ERROR, { 
              file: filePath, 
              status: 500,
              provider: 'Nextcloud'
            });
          }
        } else if (response.status === 503) {
          throw createCloudError(CloudErrorCode.SERVER_UNAVAILABLE, { file: filePath, status: 503, provider: 'Nextcloud' });
        } else if (response.status === 507) {
          throw createCloudError(CloudErrorCode.STORAGE_FULL, { file: filePath, status: 507, provider: 'Nextcloud' });
        } else if (response.status === 401) {
          throw createCloudError(CloudErrorCode.AUTH_FAILED, { file: filePath, status: 401, provider: 'Nextcloud' });
        } else if (response.status === 403) {
          throw createCloudError(CloudErrorCode.PERMISSION_DENIED, { file: filePath, status: 403, provider: 'Nextcloud' });
        } else if (response.status === 404) {
          throw createCloudError(CloudErrorCode.NOT_FOUND, { file: filePath, status: 404, provider: 'Nextcloud' });
        } else {
          throw createCloudError(CloudErrorCode.UPLOAD_FAILED, { 
            file: filePath, 
            status: response.status,
            provider: 'Nextcloud',
            originalMessage: `Upload failed: ${response.status} ${response.statusText}`
          });
        }
      }
    });
  }

  /**
   * Download file - uses throttler for read operations
   */
  async download(filePath: string): Promise<string | null> {
    if (!this.config) throw new Error('Not connected to Nextcloud');

    // Use throttler for read operations
    return this.throttler.throttledRequest(async () => {
      const url = this.getWebdavUrl(filePath);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      if (response.status === 404) {
        return null;
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Nextcloud API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      // Handle server errors (5xx) - check body for encryption markers (same as upload)
      if (response.status >= 500 && response.status < 600) {
        const errorText = await response.text().catch(() => '');
        if (errorText.toLowerCase().includes('decrypt') || errorText.toLowerCase().includes('encryption')) {
          throw createCloudError(CloudErrorCode.ENCRYPTION_ERROR, {
            file: filePath,
            status: response.status,
            provider: 'Nextcloud',
          });
        }
        throw createCloudError(CloudErrorCode.SERVER_ERROR, {
          file: filePath,
          status: response.status,
          provider: 'Nextcloud',
        });
      }

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    });
  }

  /**
   * List files in directory - uses throttler for read operations
   */
  async listFiles(directoryPath: string): Promise<CloudFile[]> {
    if (!this.config) throw new Error('Not connected to Nextcloud');

    // Use throttler for read operations
    const syncDebug = import.meta.env.DEV;
    return this.throttler.throttledRequest(async () => {
      const url = this.getWebdavUrl(directoryPath);
      const response = await fetch(url.endsWith('/') ? url : `${url}/`, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Depth': '1',
          'Content-Type': 'text/xml',
        },
      });

      if (response.status === 404) {
        if (syncDebug) {
          console.log(`[sync-debug] Nextcloud listFiles: 404 for path (folder may not exist yet): ${directoryPath}`);
        }
        return [];
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Nextcloud API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!response.ok && response.status !== 207) {
        throw new Error(`List files failed: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      
      // Parse WebDAV XML response
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const responses = doc.getElementsByTagNameNS('DAV:', 'response');
      
      const files: CloudFile[] = [];
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || '';
        const resourcetype = response.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
        const isCollection = resourcetype?.getElementsByTagNameNS('DAV:', 'collection').length > 0;
        
        // Skip directories only
        if (isCollection) continue;
        
        const decodedHref = decodeURIComponent(href);
        // Normalize href to a path relative to WebDAV root
        let pathname = decodedHref;
        try {
          const base = this.config?.serverUrl || '';
          pathname = new URL(decodedHref, base).pathname;
        } catch {}

        const marker = '/remote.php/webdav/';
        const markerIdx = pathname.indexOf(marker);
        let relative = markerIdx !== -1
          ? pathname.substring(markerIdx + marker.length)
          : pathname.replace(/^\/+/, '');

        // If path contains extra prefix before OwnJournal, trim to start at OwnJournal
        const ownIdx = relative.toLowerCase().indexOf('ownjournal/');
        if (ownIdx > -1) {
          relative = relative.substring(ownIdx);
        }

        const name = relative.split('/').filter(Boolean).pop() || '';
        const fullPath = '/' + relative.replace(/^\/+/, '');
        
        // Get modified date if available
        const lastModified = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent;
        const modifiedAt = lastModified ? new Date(lastModified) : new Date();
        
        files.push({ name, path: fullPath, modifiedAt });
      }

      // Deduplicate by path (keep latest by modifiedAt) - handles WebDAV duplicate responses
      const byPath = new Map<string, { name: string; path: string; modifiedAt: Date }>();
      for (const f of files) {
        const existing = byPath.get(f.path);
        if (!existing || f.modifiedAt > existing.modifiedAt) {
          byPath.set(f.path, f);
        }
      }
      const deduped = Array.from(byPath.values());

      if (syncDebug) {
        console.log(`[sync-debug] Nextcloud listFiles(${directoryPath}) → ${deduped.length} files`);
      }
      return deduped;
    });
  }

  /**
   * Delete file - uses write queue to serialize deletes
   */
  async delete(filePath: string): Promise<void> {
    if (!this.config) throw new Error('Not connected to Nextcloud');

    // Use write queue to serialize deletes and prevent rate limiting
    return this.throttler.queueWriteOperation(async () => {
      const url = this.getWebdavUrl(filePath);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      // Handle rate limiting (429) - throw specific error for caller to handle
      if (response.status === 429) {
        const rateLimitError = new Error('RATE_LIMITED: Nextcloud API rate limit exceeded') as Error & { status: number };
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (!response.ok && response.status !== 404) {
        throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
      }
    });
  }

  /**
   * Check if file exists using PROPFIND (more reliable than HEAD for WebDAV)
   * Uses throttler for read operations
   */
  async exists(filePath: string): Promise<boolean> {
    if (!this.config) return false;

    // Use throttler for read operations
    return this.throttler.throttledRequest(async () => {
      try {
        const url = this.getWebdavUrl(filePath);
        const response = await fetch(url, {
          method: 'PROPFIND',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Depth': '0',
            'Content-Type': 'text/xml',
          },
        });

        // 207 Multi-Status = file exists
        // 404 = not found
        // 412 = precondition failed (treat as not found for existence check)
        if (response.status === 404 || response.status === 412) {
          return false;
        }
        
        return response.ok || response.status === 207;
      } catch (error) {
        return false;
      }
    });
  }
}
