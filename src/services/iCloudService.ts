// iCloud (CloudKit) API service with proper token management and retry logic
import { CloudCredentialStorage, type ICloudCredentials } from '@/utils/cloudCredentialStorage';
import { SimpleModeCredentialStorage } from '@/utils/simpleModeCredentialStorage';
import { isE2EEnabled } from '@/utils/encryptionModeStorage';
import { retryWithBackoff, sanitizeFileName } from '@/utils/cloudRetry';
import { RequestThrottler } from '@/utils/requestThrottler';
import type { CloudProvider, CloudFile } from '@/types/cloudProvider';

/**
 * Thrown by ICloudService.connect() when the user is not signed in with Apple
 * ID and must click the Apple sign-in button rendered by CloudKit JS.
 * The caller should show the #apple-sign-in-button element and wait for
 * container.whenUserSignsIn() to resolve, then call connect() again.
 */
export class NeedsAppleSignInError extends Error {
  constructor(public readonly container: any) {
    super('Apple ID sign-in required');
    this.name = 'NeedsAppleSignInError';
  }
}

/**
 * Thrown when CloudKit rejects the current origin (e.g. 421 Misdirected Request).
 * The sign-in button is never rendered, so the user must add the origin to
 * Allowed Origins in CloudKit Dashboard.
 */
export class CloudKitOriginError extends Error {
  constructor(public readonly origin: string) {
    super(`CloudKit rejected this origin (${origin}). Add it to Allowed Origins in CloudKit Dashboard.`);
    this.name = 'CloudKitOriginError';
  }
}

/**
 * Module-level cache so that CloudKit.configure() is only called once
 * (it is a global singleton in CloudKit JS), and the authenticated container
 * is reused across service instances.
 */
let _configuredForContainer: string | null = null;
let _signedInContainer: any = null;

/**
 * Module-level cache of a rejected origin (HTTP 421 from CloudKit).
 * Once set, initCloudKit() throws immediately without making any network calls,
 * preventing repeated 421 requests on every dialog open.
 * Keyed by origin string so switching to a different URL automatically retries.
 */
let _originRejected: string | null = null;

/** Called by ICloudSync after the user successfully signs in via Apple popup. */
export function iCloudDidSignIn(container: any): void {
  _signedInContainer = container;
}

/** Called by ICloudSync on disconnect to clear the cached sign-in state. */
export function iCloudDidSignOut(): void {
  _signedInContainer = null;
  _originRejected = null;
}

/**
 * Returns true if the current window origin has already been rejected by
 * CloudKit (421 Misdirected Request). Use this to skip auto-connect attempts
 * and show the error immediately without a network round-trip.
 */
export function isCloudKitOriginRejected(): boolean {
  if (typeof window === 'undefined') return false;
  return _originRejected === window.location.origin;
}

/**
 * Returns the rejected origin string, or null if not yet rejected.
 */
export function getCloudKitRejectedOrigin(): string | null {
  return _originRejected;
}

/**
 * Clears the cached origin rejection so the next connect() attempt makes a
 * fresh network call. Call this when the user explicitly clicks "Connect"
 * so they can retry after adding their origin to CloudKit Allowed Origins.
 */
export function clearCloudKitOriginRejected(): void {
  _originRejected = null;
}

/**
 * iCloud Storage Service using CloudKit JS
 *
 * Uses the PRIVATE database. When `connect()` is called, CloudKit JS
 * authenticates the user with Apple ID via `container.setUpAuth()`. The
 * session is persisted via cookie (`persist: true`). The private database is
 * per-user so no extra scoping is needed.
 *
 * IMPORTANT: This service requires:
 * 1. Apple Developer account ($99/year)
 * 2. CloudKit container configured in Apple Developer Console
 * 3. CloudKit JS API token
 * 4. Environment variables:
 *    - VITE_APPLE_CLOUDKIT_CONTAINER_ID
 *    - VITE_APPLE_CLOUDKIT_ENVIRONMENT (development or production)
 *
 * PLATFORM SUPPORT:
 * - iOS: ✅ Full support
 * - macOS: ✅ Full support
 * - Web: ✅ Full support (requires CloudKit JS + Apple ID sign-in)
 * - Android: ❌ NOT SUPPORTED (Apple policy)
 */

/**
 * Check if a CloudKit error means the JournalEntry record type doesn't exist yet.
 * In development, the schema is auto-created on the first saveRecords() call.
 * Until then, queries and fetches fail with NOT_FOUND / ObjectNotFoundException.
 * Module-level so it can be used in shouldRetry callbacks.
 */
function isSchemaNotFoundError(error: any): boolean {
  const code = error?.serverErrorCode || error?.ckErrorCode || '';
  const reason = error?.reason || String(error?.message || '');
  const str = String(error || '');
  return (
    code === 'RECORD_TYPE_NOT_FOUND' ||
    code === 'OBJECT_NOT_FOUND' ||
    code === 'NOT_FOUND' ||
    reason.includes('record_type') ||
    reason.includes('ObjectNotFoundException') ||
    str.includes('NOT_FOUND') ||
    str.includes('ObjectNotFoundException')
  );
}

export class ICloudService implements CloudProvider {
  name = 'iCloud';
  isConnected = false;
  private credentials: ICloudCredentials | null = null;
  private masterKey: CryptoKey | null = null;
  private cloudKit: any = null; // CloudKit JS instance
  
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
   * Initialize CloudKit JS and authenticate user via Apple ID.
   *
   * CloudKit JS requires `container.setUpAuth()` before any database
   * operation — even to the public database. Without it the server returns
   * 401 AUTHENTICATION_FAILED. The auth flow opens an Apple ID sign-in
   * popup; the session is persisted via cookie when `persist: true`.
   */
  private async initCloudKit(): Promise<void> {
    // Reuse the authenticated container from a previous connection in this session.
    if (_signedInContainer) {
      this.cloudKit = _signedInContainer;
      return;
    }
    if (this.cloudKit) return;

    // Short-circuit: if this origin was already rejected by CloudKit (421), throw
    // immediately without making any network calls to avoid repeated request spam.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    if (_originRejected === origin) {
      throw new CloudKitOriginError(origin);
    }

    // Prefer env vars so updating .env takes effect without clearing saved credentials.
    const envContainer = import.meta.env.VITE_APPLE_CLOUDKIT_CONTAINER_ID;
    const envEnvironment = import.meta.env.VITE_APPLE_CLOUDKIT_ENVIRONMENT;
    const envToken = import.meta.env.VITE_APPLE_CLOUDKIT_API_TOKEN;
    const containerId = envContainer || this.credentials?.containerId;
    const environment = (envEnvironment as 'development' | 'production') || this.credentials?.environment || 'development';
    const apiToken = envToken || this.credentials?.apiToken || '';

    if (!containerId) throw new Error('iCloud not configured - missing container ID');
    if (!apiToken) throw new Error('iCloud not configured - missing API token');

    if (typeof window === 'undefined' || !(window as any).CloudKit) {
      throw new Error('CloudKit JS not loaded. Please include the CloudKit JS library.');
    }

    const CloudKit = (window as any).CloudKit;

    // CloudKit.configure() is a global singleton – only call it once per container.
    // ICloudSync renders #apple-sign-in-button in its JSX when the connect/sign-in UI is shown.
    // ensureAuthButtonContainers() creates off-screen fallbacks only when those elements
    // do not exist yet (e.g. before first render or during auto-reconnect).
    this.ensureAuthButtonContainers();

    if (_configuredForContainer !== containerId) {
      CloudKit.configure({
        containers: [{
          containerIdentifier: containerId,
          apiTokenAuth: {
            apiToken,
            persist: true,
            signInButton: { id: 'apple-sign-in-button', theme: 'black' },
            signOutButton: { id: 'apple-sign-out-button', theme: 'black' },
          },
          environment,
        }],
      });
      _configuredForContainer = containerId;
    }

    const container = CloudKit.getDefaultContainer();

    // Try to restore a persisted session (cookie). Returns null when sign-in is needed.
    const userIdentity = await container.setUpAuth();

    if (userIdentity) {
      if (import.meta.env.DEV) console.log('✅ [iCloud] Already signed in with Apple ID');
      _signedInContainer = container;
      this.cloudKit = container;
    } else {
      // setUpAuth() returned null. CloudKit JS may have rendered a sign-in <a> into
      // #apple-sign-in-button, or the request may have failed (e.g. 421) and nothing rendered.
      //
      // Set tentative rejection IMMEDIATELY so any concurrent initCloudKit() calls (e.g. the
      // ICloudSync mount effect opening during startup's wait) see a blocked origin and skip
      // their HTTP call. If the sign-in link appears within 6s we clear it — that means
      // this is the NeedsAppleSignIn case, not a true origin rejection.
      //
      // NOTE: CloudKit returns HTTP 421 for BOTH "origin not allowed" AND
      // "AUTHENTICATION_REQUIRED" (user needs to sign in). We distinguish the two by
      // checking whether CloudKit JS renders a sign-in <a> into #apple-sign-in-button
      // after setUpAuth() returns null. CloudKit JS renders this asynchronously, so we
      // must poll long enough (up to 6s) to avoid misclassifying sign-in-required as
      // origin-rejected.
      _originRejected = origin;
      let hasSignInButton: Element | null | undefined = null;
      for (let i = 0; i < 60; i++) {
        const area = typeof document !== 'undefined' ? document.getElementById('apple-sign-in-button') : null;
        // CloudKit JS renders a <div class="apple-auth-button"> (not an <a>) into this container.
        hasSignInButton = area?.querySelector?.('.apple-auth-button');
        if (hasSignInButton) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (hasSignInButton) {
        _originRejected = null; // clear tentative rejection — this is the sign-in case, not 421
        if (import.meta.env.DEV) console.log('🔐 [iCloud] Apple ID sign-in required');
        throw new NeedsAppleSignInError(container);
      }
      // Check if running on a native platform (Capacitor) where the origin is non-HTTPS
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      if (isNative) {
        if (import.meta.env.DEV) console.warn(`🔐 [iCloud] CloudKit JS does not support native app origins (${origin}). Add "${origin}" to Allowed Origins in CloudKit Dashboard, or use "Any Domain".`);
        _originRejected = null; // Don't cache — user might fix it in dashboard
        throw new Error(`CloudKit JS is not supported on native iOS/Android. The app origin "${origin}" is not recognized by CloudKit. In CloudKit Dashboard → API Tokens → Allowed Origins, add "${origin}" or select "Any Domain".`);
      }
      if (import.meta.env.DEV) console.warn(`🔐 [iCloud] Sign-in link not rendered after 6s — origin ${origin} likely not in Allowed Origins (421)`);
      // _originRejected is already set above; confirmed 421.
      throw new CloudKitOriginError(origin);
    }
  }

  /**
   * Ensure off-screen fallback containers exist for the CloudKit sign-in /
   * sign-out buttons. ICloudSync renders #apple-sign-in-button in its JSX when
   * showing the connect or Apple sign-in UI; this method only creates elements
   * when they do not already exist (e.g. before the component has mounted them).
   */
  private ensureAuthButtonContainers(): void {
    if (!document.getElementById('apple-sign-in-button')) {
      const el = document.createElement('div');
      el.id = 'apple-sign-in-button';
      // Off-screen but NOT visibility:hidden – hidden elements can interfere with CloudKit rendering.
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
      document.body.appendChild(el);
    }
    if (!document.getElementById('apple-sign-out-button')) {
      const el = document.createElement('div');
      el.id = 'apple-sign-out-button';
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
      document.body.appendChild(el);
    }
  }

  async connect(credentials: ICloudCredentials, masterKey: CryptoKey | null = null): Promise<void> {
    this.credentials = credentials;
    this.masterKey = masterKey;
    this.isConnected = true;
    
    // Initialize CloudKit with credentials
    await this.initCloudKit();
    
    // Save credentials based on encryption mode
    if (isE2EEnabled() && masterKey) {
      // E2E mode: Encrypt credentials
      await CloudCredentialStorage.saveCredentials(credentials, masterKey);
    } else {
      // Simple mode: Store in plain text
      SimpleModeCredentialStorage.saveICloudCredentials(credentials);
    }
  }

  async disconnect(): Promise<void> {
    // Clear module-level sign-in cache so next connect() starts fresh.
    iCloudDidSignOut();

    // Store references before clearing for credential removal
    const wasE2EEnabled = isE2EEnabled();
    const masterKeyRef = this.masterKey;

    // Clear sensitive data from memory
    this.credentials = null;
    this.masterKey = null;
    this.cloudKit = null;
    this.isConnected = false;
    
    // CRITICAL: Remove credentials from storage (both E2E and Simple modes)
    // FIXED: Check wasE2EEnabled and masterKeyRef BEFORE clearing them
    if (wasE2EEnabled && masterKeyRef) {
      try {
        await CloudCredentialStorage.removeCredentials('icloud', masterKeyRef);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to remove encrypted iCloud credentials:', error);
        }
      }
    } else {
      SimpleModeCredentialStorage.clearICloudCredentials();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.cloudKit) {
      await this.initCloudKit();
    }
    
    if (!this.cloudKit) {
      throw new Error('CloudKit not initialized');
    }
  }

  /**
   * Get the database instance. After setUpAuth() the user is signed in with
   * Apple ID, so we can use the private database (per-user, no scoping needed).
   */
  private getDatabase() {
    if (!this.cloudKit) {
      throw new Error('CloudKit not initialized');
    }
    return this.cloudKit.privateCloudDatabase;
  }

  async upload(filePath: string, content: string): Promise<void> {
    await this.ensureInitialized();

    return this.throttler.queueWriteOperation(async () => {
      const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
      const database = this.getDatabase();

      const recordName = `journal_${fileName.replace(/\./g, '_')}`;
      const record = {
        recordType: 'JournalEntry',
        recordName,
        fields: {
          fileName: { value: fileName },
          content: { value: content },
          modifiedAt: { value: new Date().toISOString() },
        },
      };

      await retryWithBackoff(async () => {
        // If the JournalEntry record type doesn't exist, saveRecords() returns NOT_FOUND.
        // This must surface as an error — silently returning would lose data.
        const response = await database.saveRecords(record);

        if (response.hasErrors) {
          const error = response.errors?.[0];

          // CONFLICT means the record already exists — fetch its recordChangeTag and retry as update
          if (error?.serverErrorCode === 'CONFLICT') {
            let existingTag: string | undefined;
            try {
              const fetchResp = await database.fetchRecords(recordName);
              existingTag = fetchResp.records?.[0]?.recordChangeTag;
            } catch { /* ignore fetch errors */ }

            if (existingTag) {
              const updateRecord = { ...record, recordChangeTag: existingTag };
              const updateResp = await database.saveRecords(updateRecord);
              if (updateResp.hasErrors) {
                const updateErr = updateResp.errors?.[0];
                throw new Error(`iCloud upload failed: ${updateErr?.serverErrorCode || 'Unknown error'}`);
              }
              return updateResp;
            }
            throw new Error('iCloud upload failed: CONFLICT and could not fetch existing record');
          }

          if (isSchemaNotFoundError(error)) {
            const schemaErr = new Error(
              'iCloud upload failed: JournalEntry record type does not exist. ' +
              'If using production environment, deploy the schema from CloudKit Dashboard first.'
            ) as Error & { serverErrorCode: string };
            schemaErr.serverErrorCode = 'NOT_FOUND';
            throw schemaErr;
          }
          if (error?.serverErrorCode === 'THROTTLED' || error?.serverErrorCode === 'TOO_MANY_REQUESTS') {
            const rateLimitError = new Error('RATE_LIMITED: iCloud CloudKit rate limit exceeded') as Error & { status: number; serverErrorCode: string };
            rateLimitError.status = 429;
            rateLimitError.serverErrorCode = error.serverErrorCode;
            throw rateLimitError;
          }
          throw new Error(`iCloud upload failed: ${error?.serverErrorCode || 'Unknown error'}`);
        }

        return response;
      }, {
        shouldRetry: (error) => {
          // Don't retry schema-not-found — record type must be created in CloudKit Dashboard
          if (isSchemaNotFoundError(error)) return false;
          if (error?.serverErrorCode === 'THROTTLED' ||
              error?.serverErrorCode === 'TOO_MANY_REQUESTS' ||
              error?.serverErrorCode === 'SERVICE_UNAVAILABLE') {
            return true;
          }
          return !error?.serverErrorCode || error.serverErrorCode >= 500;
        },
      });
    });
  }

  async download(filePath: string): Promise<string | null> {
    if (import.meta.env.DEV) console.log('[iCloud] download:', filePath);
    await this.ensureInitialized();

    return this.throttler.throttledRequest(async () => {
      const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
      const database = this.getDatabase();
      const recordName = `journal_${fileName.replace(/\./g, '_')}`;

      const retryOpts = {
        shouldRetry: (error: any) => {
          if (error?.serverErrorCode === 'RECORD_NOT_FOUND' || isSchemaNotFoundError(error)) return false;
          if (error?.serverErrorCode === 'THROTTLED' ||
              error?.serverErrorCode === 'TOO_MANY_REQUESTS' ||
              error?.serverErrorCode === 'SERVICE_UNAVAILABLE') {
            return true;
          }
          return !error?.serverErrorCode || error.serverErrorCode >= 500;
        },
      };

      // Handle schema-not-found and record-not-found INSIDE the callback
      // so retryWithBackoff never sees the error and never retries it.
      const response = await retryWithBackoff(async () => {
        let resp: any;
        try {
          resp = await database.fetchRecords(recordName);
        } catch (e: any) {
          if (e?.serverErrorCode === 'RECORD_NOT_FOUND' || isSchemaNotFoundError(e)) {
            return { hasErrors: false, records: [] };
          }
          throw e;
        }
        if (resp.hasErrors) {
          const err = resp.errors?.[0];
          if (err?.serverErrorCode === 'RECORD_NOT_FOUND' || isSchemaNotFoundError(err)) {
            return { hasErrors: false, records: [] };
          }
          if (err?.serverErrorCode === 'THROTTLED' || err?.serverErrorCode === 'TOO_MANY_REQUESTS') {
            const rateLimitError = new Error('RATE_LIMITED: iCloud CloudKit rate limit exceeded') as Error & { status: number; serverErrorCode: string };
            rateLimitError.status = 429;
            rateLimitError.serverErrorCode = err.serverErrorCode;
            throw rateLimitError;
          }
          throw err;
        }
        return resp;
      }, retryOpts);

      const record = response.records?.[0];
      return record?.fields?.content?.value || null;
    });
  }

  async listFiles(directoryPath: string): Promise<CloudFile[]> {
    if (import.meta.env.DEV) console.log('[iCloud] listFiles:', directoryPath);
    await this.ensureInitialized();

    const retryOptions = {
      shouldRetry: (error: any) => {
        if (isSchemaNotFoundError(error)) return false;
        if (error?.serverErrorCode === 'THROTTLED' ||
            error?.serverErrorCode === 'TOO_MANY_REQUESTS' ||
            error?.serverErrorCode === 'SERVICE_UNAVAILABLE') {
          return true;
        }
        return !error?.serverErrorCode || error.serverErrorCode >= 500;
      },
    };

    return this.throttler.throttledRequest(async () => {
      const database = this.getDatabase();
      const query = {
        recordType: 'JournalEntry',
        sortBy: [{ fieldName: 'modifiedAt', ascending: false }],
      };

      const emptyResponse = { hasErrors: false, records: [] as any[], moreComing: false };

      // Helper: run a query and handle schema-not-found INSIDE the callback
      // so retryWithBackoff never sees the error and never retries it.
      const safeQuery = (q: any) => retryWithBackoff(async () => {
        let resp: any;
        try {
          resp = await database.performQuery(q);
        } catch (e: any) {
          if (isSchemaNotFoundError(e)) return emptyResponse;
          throw e;
        }
        if (resp.hasErrors) {
          const err = resp.errors?.[0];
          if (isSchemaNotFoundError(err)) return emptyResponse;
          if (err?.serverErrorCode === 'THROTTLED' || err?.serverErrorCode === 'TOO_MANY_REQUESTS') {
            const rateLimitError = new Error('RATE_LIMITED: iCloud CloudKit rate limit exceeded') as Error & { status: number; serverErrorCode: string };
            rateLimitError.status = 429;
            rateLimitError.serverErrorCode = err.serverErrorCode;
            throw rateLimitError;
          }
          // Throw the raw CloudKit error object so shouldRetry can inspect serverErrorCode
          throw err;
        }
        return resp;
      }, retryOptions);

      const allRecords: any[] = [];
      let response = await safeQuery(query);

      // Pagination: follow moreComing so sync fetches all records
      while (true) {
        allRecords.push(...(response.records || []));
        if (!response.moreComing) break;
        response = await safeQuery(response);
      }

      const files: CloudFile[] = allRecords.map((record: any) => {
        const name = record.fields?.fileName?.value || 'unknown';
        let path: string;
        if (name === 'encryption-key.json') {
          path = '/OwnJournal/encryption-key.json';
        } else if (name.startsWith('trend_analysis')) {
          path = `/OwnJournal/analysis/${name}`;
        } else if (name.startsWith('entry-') && name.endsWith('.json')) {
          path = `/OwnJournal/entries/${name}`;
        } else if (name === 'operations.log') {
          path = `/OwnJournal/${name}`;
        } else {
          path = `/OwnJournal/${name}`;
        }
        return {
          name,
          path,
          modifiedAt: new Date(record.fields?.modifiedAt?.value || Date.now()),
          size: record.fields?.content?.value?.length || 0,
        };
      });

      // Deduplicate by path (keep latest by modifiedAt) - matches other providers
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
    await this.ensureInitialized();

    return this.throttler.queueWriteOperation(async () => {
      const fileName = sanitizeFileName(filePath.split('/').pop() || filePath);
      const database = this.getDatabase();
      const recordName = `journal_${fileName.replace(/\./g, '_')}`;

      await retryWithBackoff(async () => {
        let response: any;
        try {
          response = await database.deleteRecords(recordName);
        } catch (thrown: any) {
          // CloudKit JS may throw on 404 — treat schema/record-not-found as no-op
          if (thrown?.serverErrorCode === 'RECORD_NOT_FOUND' || isSchemaNotFoundError(thrown)) {
            return;
          }
          throw thrown;
        }

        if (response.hasErrors) {
          const error = response.errors?.[0];
          // Ignore NOT_FOUND errors (already deleted)
          if (error?.serverErrorCode === 'RECORD_NOT_FOUND' || isSchemaNotFoundError(error)) {
            return response;
          }
          // CONFLICT means the record was modified — fetch latest recordChangeTag and retry delete
          if (error?.serverErrorCode === 'CONFLICT') {
            let existingTag: string | undefined;
            try {
              const fetchResp = await database.fetchRecords(recordName);
              existingTag = fetchResp.records?.[0]?.recordChangeTag;
            } catch { /* ignore fetch errors */ }

            if (existingTag) {
              const deleteResp = await database.deleteRecords({ recordName, recordChangeTag: existingTag });
              if (deleteResp.hasErrors) {
                const deleteErr = deleteResp.errors?.[0];
                if (deleteErr?.serverErrorCode === 'RECORD_NOT_FOUND') return deleteResp;
                throw new Error(`iCloud delete failed: ${deleteErr?.serverErrorCode || 'Unknown error'}`);
              }
              return deleteResp;
            }
            throw new Error('iCloud delete failed: CONFLICT and could not fetch existing record');
          }
          // Handle throttling/rate limiting (CloudKit specific codes)
          if (error?.serverErrorCode === 'THROTTLED' || error?.serverErrorCode === 'TOO_MANY_REQUESTS') {
            const rateLimitError = new Error('RATE_LIMITED: iCloud CloudKit rate limit exceeded') as Error & { status: number; serverErrorCode: string };
            rateLimitError.status = 429;
            rateLimitError.serverErrorCode = error.serverErrorCode;
            throw rateLimitError;
          }
          throw new Error(`iCloud delete failed: ${error?.serverErrorCode || 'Unknown error'}`);
        }

        return response;
      }, {
        shouldRetry: (error) => {
          if (error?.serverErrorCode === 'RECORD_NOT_FOUND' || isSchemaNotFoundError(error)) {
            return false;
          }
          if (error?.serverErrorCode === 'THROTTLED' ||
              error?.serverErrorCode === 'TOO_MANY_REQUESTS' ||
              error?.serverErrorCode === 'SERVICE_UNAVAILABLE') {
            return true;
          }
          return !error?.serverErrorCode || error.serverErrorCode >= 500;
        },
      });
    });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const content = await this.download(filePath);
      return content !== null;
    } catch {
      return false;
    }
  }
}
