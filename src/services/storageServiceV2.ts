// Complete refactored storage service - Cloud-first with bidirectional sync
import { JournalEntryData } from '@/components/journal/JournalEntry';
import { cloudStorageService } from './cloudStorageService';
import type { CloudFile, CloudProvider } from '@/types/cloudProvider';
import {
  generateMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  encryptData,
  decryptData,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  generateSalt,
  deriveKeyFromPassword,
  getMasterKeyFingerprint,
} from '@/utils/encryption';
import { openDB, saveToIndexedDB, getFromIndexedDB } from '@/utils/pwa';
import { isE2EEnabled } from '@/utils/encryptionModeStorage';
import { scopedKey } from '@/utils/userScope';
import { hasStoredPassword as hasStoredPasswordUtil } from '@/utils/passwordStorage';
import { aiMetadataService } from './aiMetadataService';
import { cloudRateLimiter, AdaptiveRateLimiter } from '@/utils/adaptiveRateLimiter';
import { CloudErrorCode, createCloudError, getCloudErrorCode, isCloudError } from '@/utils/cloudErrorCodes';

// ============= CONSTANTS =============
const ENCRYPTION_CONSTANTS = {
  // KEY_CACHE_TTL_MS removed - cache indefinitely until explicit password change
  KEY_DOWNLOAD_RETRY_DELAY_MS: 3000,             // 3 seconds base delay
  KEY_DOWNLOAD_MAX_RETRIES: 5,
  KEY_CHECK_RETRIES: 5,
  KEY_CHECK_DELAY_MS: 5000,                      // 5 seconds between key checks
  SYNC_INTERVAL_MS: 5 * 60 * 1000,               // 5 minutes
  RATE_LIMIT_BACKOFF_BASE_MS: 3000,
  OPERATION_COMPACTION_DAYS: 180,                // Keep operations for 180 days (Phase 2: extended for long-offline devices)
  CIRCUIT_BREAKER_COOLDOWN_MS: 5 * 60 * 1000,    // 5 minutes
  CIRCUIT_BREAKER_THRESHOLD: 5,                  // Open after 5 failures
  SYNC_TIMESTAMP_TOLERANCE_MS: 2000,             // 2 seconds tolerance for sync
  BATCH_SIZE: 50,                                // Batch size for parallel downloads
  THROTTLE_DELAY_MS: 50,                         // Delay between deletions
} as const;

if (import.meta.env.DEV) console.log('[storageServiceV2] module loaded — v2025-02-22');

/**
 * Encrypted key data structure with versioning for multi-device sync
 * Version is incremented on password change to detect stale cached keys
 */
interface EncryptedKeyData {
  encryptedKey: string;
  salt: string;
  iv: string;
  version: number;       // Increment on password change to detect stale keys
  createdAt: string;     // ISO timestamp when key was first created
  updatedAt: string;     // ISO timestamp when password was last changed
}

// ============= PHASE 1: Exponential Backoff Retry Logic =============

/**
 * Retry a cloud operation with exponential backoff and jitter
 * Handles transient network errors (500, 502, 503, 504, network failures)
 * @param maxAttempts - Total number of attempts (including initial try)
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = 4
): Promise<T> {
  let lastError: any;
  
  // Circuit breaker check
  const breaker = circuitBreakers.get(operationName);
  if (breaker && Date.now() < breaker.openUntil) {
    const errorMsg = `Circuit breaker open for ${operationName} until ${new Date(breaker.openUntil).toISOString()}`;
    addDiagnosticEntry('circuit_breaker', operationName, errorMsg, { openUntil: breaker.openUntil });
    throw new Error(errorMsg);
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // FIXED: Check circuit breaker before each attempt, not just at start
    if (attempt > 1) {
      const breaker = circuitBreakers.get(operationName);
      if (breaker && Date.now() < breaker.openUntil) {
        storageServiceV2Instance?.activeRetries.delete(operationName);
        const errorMsg = `Circuit breaker opened during retry for ${operationName}`;
        addDiagnosticEntry('circuit_breaker', operationName, errorMsg, { openUntil: breaker.openUntil });
        throw new Error(errorMsg);
      }
    }
    
    try {
      // Track active retry only on attempts > 1
      if (attempt > 1) {
        storageServiceV2Instance?.activeRetries.add(operationName);
      }
      
      addDiagnosticEntry('operation', operationName, `Attempting operation (${attempt}/${maxAttempts})`, undefined, attempt);
      
      const result = await operation();
      
      // Success - reset circuit breaker COMPLETELY (not just delete)
      const breaker = circuitBreakers.get(operationName);
      if (breaker) {
        breaker.failures = 0;
        breaker.openUntil = 0;
        circuitBreakers.set(operationName, breaker);
      }
      
      if (attempt > 1) {
        storageServiceV2Instance?.activeRetries.delete(operationName);
      }
      
      addDiagnosticEntry('success', operationName, `Operation succeeded`, undefined, attempt);
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      const isLastAttempt = attempt === maxAttempts;
      
      if (!isRetryable || isLastAttempt) {
        // Clear retry tracking on failure
        if (attempt > 1) {
          storageServiceV2Instance?.activeRetries.delete(operationName);
        }
        
        // Track failures for circuit breaker
        const current = circuitBreakers.get(operationName) || { failures: 0, openUntil: 0 };
        current.failures++;
        
        // Open circuit after 5 consecutive failures (5 min cooldown)
        if (current.failures >= 5) {
          current.openUntil = Date.now() + (5 * 60 * 1000);
          addDiagnosticEntry(
            'circuit_breaker',
            operationName,
            `Circuit breaker opened until ${new Date(current.openUntil).toLocaleTimeString()}`,
            { failures: current.failures, openUntil: current.openUntil }
          );
          if (import.meta.env.DEV) {
            console.warn(`🔌 Circuit breaker opened for ${operationName} until ${new Date(current.openUntil).toLocaleTimeString()}`);
          }
        }
        circuitBreakers.set(operationName, current);
        
        addDiagnosticEntry(
          'error',
          operationName,
          isLastAttempt ? 'Operation failed after max attempts' : 'Operation failed (not retryable)',
          { error: error.message || String(error), isRetryable, attempt },
          attempt
        );
        
        throw error;
      }
      
      // Check for Retry-After header (429 rate limiting)
      const retryAfter = getRetryAfterMs(error);
      let delayMs: number;
      
      if (retryAfter) {
        delayMs = retryAfter;
        addDiagnosticEntry('retry', operationName, `Rate limited, retrying after ${Math.round(delayMs / 1000)}s`, { retryAfter }, attempt, delayMs);
        if (import.meta.env.DEV) {
          console.log(`⏱️ Rate limited on ${operationName}, respecting Retry-After: ${Math.round(delayMs / 1000)}s`);
        }
      } else {
        // Calculate exponential backoff with jitter: base 1s, 2s, 4s
        // Add random jitter (±25%) to prevent thundering herd
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
        delayMs = Math.max(100, baseDelay + jitter);
        
        addDiagnosticEntry('retry', operationName, `Retrying in ${Math.round(delayMs)}ms`, { error: error.message || String(error) }, attempt, delayMs);
      }
      
      if (import.meta.env.DEV) {
        console.log(`⚠️ ${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delayMs)}ms...`, error.message || error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Final cleanup - should never reach here but be safe
  if (storageServiceV2Instance) {
    storageServiceV2Instance.activeRetries.delete(operationName);
  }
  throw lastError;
}

// Circuit breaker state for failing services
const circuitBreakers = new Map<string, { failures: number; openUntil: number }>();

// Forward declaration for diagnostics tracking
let storageServiceV2Instance: StorageServiceV2 | null = null;

/**
 * Check if an error is retryable (transient network issue)
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // CRITICAL: Browser CORS errors often mask 429 rate limits
  // When Dropbox/etc returns 429, browsers show "CORS error" instead
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (msg.includes('cors') || msg.includes('network') || msg.includes('failed to fetch')) {
      return true; // Likely a masked 429 - treat as retryable
    }
  }
  
  // HTTP status codes that indicate transient errors
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    return status === 500 || status === 502 || status === 503 || status === 504 || status === 429;
  }
  
  // WebDAV/Nextcloud specific errors and Dropbox rate limiting
  if (error.message) {
    const msg = error.message.toLowerCase();
    return msg.includes('network') || 
           msg.includes('timeout') || 
           msg.includes('internal server error') ||
           msg.includes('bad gateway') ||
           msg.includes('service unavailable') ||
           msg.includes('gateway timeout') ||
           msg.includes('too_many_write_operations') ||
           msg.includes('dropbox_rate_limited') ||
           msg.includes('rate_limit') ||
           msg.includes('cors') ||
           msg.includes('cross-origin');
  }
  
  return false;
}

/**
 * Extract Retry-After header value from error (for 429 rate limiting)
 */
function getRetryAfterMs(error: any): number | null {
  if (error.headers && error.headers['retry-after']) {
    const value = error.headers['retry-after'];
    // Can be seconds (number) or HTTP date
    if (!isNaN(Number(value))) {
      return Number(value) * 1000;
    }
  }
  return null;
}


// Wrapped cloud storage operations with retry logic
// Write operations (upload/delete) get more retries than read operations
const cloudStorageWithRetry = {
  async uploadToAll(filePath: string, content: string): Promise<void> {
    return retryWithBackoff(
      () => cloudStorageService.uploadToAll(filePath, content),
      `Upload ${filePath}`,
      3 // Fewer retries so failures surface faster
    );
  },
  
  async downloadFromPrimary(filePath: string): Promise<string | null> {
    return retryWithBackoff(
      () => cloudStorageService.downloadFromPrimary(filePath),
      `Download ${filePath}`,
      3 // Read operations can fail faster
    );
  },
  
  async listFiles(directoryPath: string = ''): Promise<any[]> {
    return retryWithBackoff(
      () => cloudStorageService.listFiles(directoryPath),
      `List files in ${directoryPath}`,
      3 // Read operations can fail faster
    );
  },
  
  async deleteFromAll(filePath: string): Promise<void> {
    return retryWithBackoff(
      () => cloudStorageService.deleteFromAll(filePath),
      `Delete ${filePath}`,
      3 // Faster failure for deletions too
    );
  },
  
  async fileExists(filePath: string): Promise<boolean> {
    return retryWithBackoff(
      () => cloudStorageService.fileExists(filePath),
      `Check existence of ${filePath}`,
      3 // Read operations can fail faster
    );
  }
};

/**
 * Clean up old circuit breaker entries to prevent memory leaks
 * IMPROVED: Also remove breakers that have been closed for more than 1 hour
 */
function cleanupCircuitBreakers(): void {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [name, breaker] of circuitBreakers.entries()) {
    // Remove if breaker is closed and has no failures for 1 hour
    if (breaker.openUntil < now && breaker.failures === 0) {
      circuitBreakers.delete(name);
    }
    // Remove if breaker has been closed (openUntil passed) for more than 1 hour
    else if (breaker.openUntil > 0 && breaker.openUntil < now && (now - breaker.openUntil) > ONE_HOUR) {
      circuitBreakers.delete(name);
    }
  }
}

// Run cleanup every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(cleanupCircuitBreakers, 30 * 60 * 1000);
  
  // FIXED: Clean up on page unload to free memory
  window.addEventListener('beforeunload', () => {
    circuitBreakers.clear();
  });
}

// ============= End of Phase 1 =============

// ============= PHASE 2: Cloud-Based Append-Only Operation Log =============

/**
 * Operation log entry - stored in cloud operations.log
 * Replaces deletions.json with a complete audit trail
 * This append-only log is the source of truth for all changes
 */
interface OperationLogEntry {
  id: string; // Unique operation ID: "op-{deviceId}-{timestamp}-{counter}"
  entryId: string; // Journal entry ID this operation affects
  type: 'create' | 'update' | 'delete'; // Type of operation
  timestamp: string; // ISO timestamp when operation occurred
  deviceId: string; // Device that performed the operation
}

/**
 * Compacted state derived from operation log
 * Used to determine which entries should exist and which are deleted
 */
interface OperationLogState {
  deleted: Set<string>; // Entry IDs that have been deleted
  lastOperation: Map<string, OperationLogEntry>; // Last operation per entry
}

/**
 * State snapshot - permanent tombstones for compaction
 * Written during compaction; never deleted. Ensures delete info is never lost.
 */
interface StateSnapshot {
  version: 1;
  deletedEntryIds: string[];
  snapshotTimestamp: string;
  coveredUpTo: string;
  createdBy: string;
}

const STATE_SNAPSHOT_PATH = 'operations/state-snapshot.json';

// ============= End of Phase 2 Interfaces =============

// ============= PHASE 4: Version Vectors & Conflict Detection =============

/**
 * Version vector - tracks latest operation ID from each device
 * Used to detect conflicts caused by concurrent edits on different devices
 */
interface VersionVector {
  [deviceId: string]: string; // deviceId -> last operation ID from that device
}

/**
 * Conflict log entry - records when conflicts are detected and resolved
 */
export interface ConflictLogEntry {
  id: string;
  entryId: string;
  timestamp: string;
  resolvedBy: 'lww'; // Resolution strategy used
  winner: {
    deviceId: string;
    operationId: string;
    timestamp: string;
    preview: string; // First 100 chars of content
  };
  loser: {
    deviceId: string;
    operationId: string;
    timestamp: string;
    preview: string;
    fullEntry: JournalEntryData; // Full entry for potential restore
  };
  reason: string; // Human-readable explanation (fallback)
  reasonKey?: 'usingCloud' | 'usingLocal'; // Translation key
  reasonParams?: { keptTime: string; discardedTime: string }; // Params for i18n
}

// Global conflict log storage
const conflictLog: ConflictLogEntry[] = [];
const MAX_CONFLICT_ENTRIES = 100;
let conflictIdCounter = 0;

/**
 * Add a conflict log entry
 * FIXED: Safe preview generation with null checks
 */
function addConflictLogEntry(
  entryId: string,
  winner: { deviceId: string; operationId: string; timestamp: string; entry: JournalEntryData },
  loser: { deviceId: string; operationId: string; timestamp: string; entry: JournalEntryData },
  reasonKey: 'usingCloud' | 'usingLocal',
  reasonParams: { keptTime: string; discardedTime: string }
) {
  // Generate fallback reason for backward compatibility
  const reason = `Concurrent edits detected. Using ${reasonKey === 'usingCloud' ? 'cloud' : 'local'} version (edited ${reasonParams.keptTime}) over ${reasonKey === 'usingCloud' ? 'local' : 'cloud'} version (edited ${reasonParams.discardedTime})`;
  // Safe preview generation with fallbacks
  const winnerTitle = (winner.entry.title || '').substring(0, 50);
  const winnerBody = (winner.entry.body || '').substring(0, 50);
  const loserTitle = (loser.entry.title || '').substring(0, 50);
  const loserBody = (loser.entry.body || '').substring(0, 50);
  
  const entry: ConflictLogEntry = {
    id: `conflict-${++conflictIdCounter}`,
    entryId,
    timestamp: new Date().toISOString(),
    resolvedBy: 'lww',
    winner: {
      deviceId: winner.deviceId,
      operationId: winner.operationId,
      timestamp: winner.timestamp,
      preview: `${winnerTitle}${winnerTitle.length >= 50 ? '...' : ''} ${winnerBody}${winnerBody.length >= 50 ? '...' : ''}`
    },
    loser: {
      deviceId: loser.deviceId,
      operationId: loser.operationId,
      timestamp: loser.timestamp,
      preview: `${loserTitle}${loserTitle.length >= 50 ? '...' : ''} ${loserBody}${loserBody.length >= 50 ? '...' : ''}`,
      fullEntry: loser.entry
    },
    reason,
    reasonKey,
    reasonParams
  };
  
  conflictLog.unshift(entry);
  
  // Keep only recent conflicts
  if (conflictLog.length > MAX_CONFLICT_ENTRIES) {
    conflictLog.length = MAX_CONFLICT_ENTRIES;
  }
  
  if (import.meta.env.DEV) {
    console.warn(`⚠️ [Conflict] ${reason}`, { entryId, winner: winner.deviceId, loser: loser.deviceId });
  }
  
  // Phase 4: Notify listeners about the conflict (with error handling)
  if (storageServiceV2Instance) {
    try {
      storageServiceV2Instance['notifyConflictDetected'](entry);
    } catch (notifyError) {
      // Don't let notification errors break the sync
      if (import.meta.env.DEV) {
        console.error('Failed to notify conflict listeners:', notifyError);
      }
    }
  }
}

/**
 * Check if two journal entries have identical content
 * Used to skip false conflicts when content is the same (e.g., after provider transfer)
 */
function entriesAreIdentical(a: JournalEntryData, b: JournalEntryData): boolean {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.mood === b.mood &&
    JSON.stringify((a.tags || []).slice().sort()) === JSON.stringify((b.tags || []).slice().sort())
  );
}

  /**
   * Check if two version vectors indicate a conflict
   * Conflict = both devices have made changes since their last common state
   * FIXED: Now checks ALL local changes, not just current device
   */
  function detectConflict(
    localVector: VersionVector,
    remoteVector: VersionVector,
    localDeviceId: string
  ): boolean {
    // If either vector is empty, no conflict (first sync)
    if (Object.keys(localVector).length === 0 || Object.keys(remoteVector).length === 0) {
      return false;
    }
    
    // Check if remote has changes local hasn't seen (any device)
    let remoteHasNewChanges = false;
    for (const deviceId in remoteVector) {
      if (!localVector[deviceId] || localVector[deviceId] !== remoteVector[deviceId]) {
        remoteHasNewChanges = true;
        break;
      }
    }
    
    // Check if local has changes remote hasn't seen (ANY device, not just current)
    let localHasNewChanges = false;
    for (const deviceId in localVector) {
      if (!remoteVector[deviceId] || remoteVector[deviceId] !== localVector[deviceId]) {
        localHasNewChanges = true;
        break;
      }
    }
    
    // Conflict = both have changes the other hasn't seen
    return remoteHasNewChanges && localHasNewChanges;
  }

/**
 * Merge version vectors - take the latest operation ID from each device
 */
function mergeVersionVectors(v1: VersionVector, v2: VersionVector): VersionVector {
  const merged: VersionVector = { ...v1 };
  
  for (const deviceId in v2) {
    // For each device, keep the lexicographically larger operation ID (more recent)
    if (!merged[deviceId] || v2[deviceId] > merged[deviceId]) {
      merged[deviceId] = v2[deviceId];
    }
  }
  
  return merged;
}

// ============= End of Phase 4 =============

// Encrypted entry format in cloud
interface EncryptedEntry {
  id: string;
  encryptedData: string;
  iv: string;
  metadata: {
    date: string;
    tags: string[];
    mood: string;
    createdAt: string;
    updatedAt: string;
    aiMetadata?: import('@/types/aiMetadata').EntryAIMetadata; // AI analysis metadata
  };
  // Phase 4: Version vector for conflict detection
  versionVector?: VersionVector;
}

// Sync state tracking
interface SyncState {
  lastSyncTimestamp: string;
  deviceId: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

// ============= ENCRYPTION READINESS =============

/**
 * Consolidated encryption readiness state
 * Use getEncryptionReadiness() for a single source of truth instead of checking multiple flags
 */
export enum EncryptionReadiness {
  READY = 'ready',                         // Good to go - can read/write entries
  NEED_PASSWORD = 'need_password',         // E2E mode, no password set
  NEED_CLOUD_KEY = 'need_cloud_key',       // E2E mode, password set, no cloud key yet
  MIXED_MODE_ENTRIES = 'mixed_mode',       // E2E mode but unencrypted entries exist
  NETWORK_ERROR = 'network_error',         // Can't verify state due to network
  NOT_INITIALIZED = 'not_initialized',     // Service not initialized yet
}

// ============= SYNC PROGRESS TRACKING =============

/**
 * Sync progress for resumable syncs
 * Stored in IndexedDB to survive page reloads
 */
export interface SyncProgress {
  id: string;                              // Unique sync operation ID
  startedAt: string;                       // ISO timestamp
  totalEntries: number;                    // Total entries to sync
  processedEntries: string[];              // IDs successfully processed
  failedEntries: string[];                 // IDs that failed
  completed: boolean;                      // Whether sync finished
  lastUpdated: string;                     // Last progress update
}

// ============= GRANULAR SYNC PROGRESS (for UI) =============

/**
 * Granular sync progress for real-time UI updates
 * Emitted during sync operations to show detailed progress
 */
export type SyncPhase = 'preparing' | 'checking-cloud' | 'downloading' | 'uploading' | 'finalizing';

export interface GranularSyncProgress {
  phase: SyncPhase;
  currentFile?: string;
  filesProcessed: number;
  totalFiles: number;
  percentComplete: number;
  message?: string;
}

/**
 * Progress callback for account deletion operations
 */
export interface DeletionProgress {
  phase: 'local' | 'cloud';
  current: number;
  total: number;
  currentFile?: string;
}

// ============= PHASE 3: Sync Diagnostics =============

/**
 * Diagnostic entry for tracking sync operations
 */
export interface DiagnosticEntry {
  id: string;
  timestamp: string;
  type: 'operation' | 'retry' | 'error' | 'success' | 'circuit_breaker';
  operationName: string;
  message: string;
  details?: any;
  attemptNumber?: number;
  delayMs?: number;
}

/**
 * Sync diagnostics statistics
 */
export interface SyncDiagnostics {
  recentEntries: DiagnosticEntry[];
  successCount: number;
  failureCount: number;
  retryCount: number;
  circuitBreakerStatus: Map<string, { failures: number; openUntil: number }>;
  activeRetries: Set<string>;
}

// Global diagnostics storage
const diagnostics: DiagnosticEntry[] = [];
const MAX_DIAGNOSTIC_ENTRIES = 200;
let diagnosticIdCounter = 0;

/**
 * Add a diagnostic entry
 */
function addDiagnosticEntry(
  type: DiagnosticEntry['type'],
  operationName: string,
  message: string,
  details?: any,
  attemptNumber?: number,
  delayMs?: number
) {
  const entry: DiagnosticEntry = {
    id: `diag-${++diagnosticIdCounter}`,
    timestamp: new Date().toISOString(),
    type,
    operationName,
    message,
    details,
    attemptNumber,
    delayMs
  };
  
  diagnostics.unshift(entry); // Add to beginning
  
  // Keep only recent entries (more efficient than pop())
  if (diagnostics.length > MAX_DIAGNOSTIC_ENTRIES) {
    diagnostics.length = MAX_DIAGNOSTIC_ENTRIES;
  }
  
  if (import.meta.env.DEV && type === 'error') {
    console.error(`📊 [Diagnostics] ${operationName}: ${message}`, details);
  }
}

// ============= End of Phase 3 =============

/**
 * StorageServiceV2 - Cloud-first journal storage with bidirectional sync
 * 
 * SYNC DEDUPLICATION & RACE CONDITION PREVENTION:
 * - performFullSync() uses isSyncing flag to prevent concurrent syncs
 * - New sync requests while syncing are queued (pendingSyncRequest flag)
 * - After sync completes, queued request executes automatically
 * - startAutoSync() is idempotent - clears existing interval before creating new one
 * - Auto-sync only restarts on reconnect if interval was explicitly stopped
 * - Debug logging tracks sync operations and auto-sync intervals
 */
class StorageServiceV2 {
  private masterKey: CryptoKey | null = null;
  private syncInterval: number | null = null;
  private syncStatus: SyncStatus = 'idle';
  private lastSyncTime: Date | null = null;
  private isOnline: boolean = navigator.onLine;
  private deviceId: string = '';
  private statusListeners: Array<(status: SyncStatus, lastSync: Date | null) => void> = [];
  private isSyncing: boolean = false; // Flag to prevent concurrent syncs
  private pendingSyncRequest: boolean = false; // Queue one sync request while another is running
  private entriesChangedListeners: Array<() => void> = []; // Listeners for when entries change
  
  // Phase 2: Last timestamp to ensure unique operation IDs
  private lastOperationTimestamp: number = 0;
  
  // Phase 3: Track active retry operations (public for diagnostics)
  public activeRetries: Set<string> = new Set();
  
  // Phase 4: Conflict notification listeners
  private conflictListeners: Array<(conflictCount: number, latestConflict: ConflictLogEntry) => void> = [];
  
  // Granular sync progress listeners (for UI updates)
  private progressListeners: Array<(progress: GranularSyncProgress) => void> = [];
  
  // Quick sync tracking
  private lastFullSyncTime: number = 0;
  private static readonly FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  // Track initialization state
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  // Password/cloud-key state gates
  private passwordProvided: boolean = false;
  private cloudKeyProvisioned: boolean = false;
  
  // CRITICAL: Sync lock - blocks all sync operations during provider disconnect
  // This prevents re-uploading entries during the disconnect flow
  private syncDisabled: boolean = false;
  private keyDebugDecryptEntryLogged: boolean = false;
  private decryptDebugFirstFailureLogged: boolean = false;

  // Track entry IDs that failed decryption so the event only fires for NEW failures
  private knownFailedEntryIds: Set<string> = new Set();

  // Auto-sync management
  private autoSyncStartCount: number = 0; // Track how many times startAutoSync was called

  // Mutation locking: Prevent concurrent writes to the same entry
  private entryLocks: Map<string, Promise<void>> = new Map();
  private lockQueue: Map<string, Array<() => void>> = new Map();

  // Master key change listeners (event-based instead of polling)
  private masterKeyListeners: Array<(key: CryptoKey | null) => void> = [];

  // RECONCILIATION DEDUPLICATION: Prevent concurrent reconcileEntries calls
  private reconciliationPromise: Promise<void> | null = null;
  private lastReconciliationTime: number = 0;
  private static readonly RECONCILIATION_COOLDOWN_MS = 5000; // 5 seconds between reconciliations

  constructor() {
    // Set the global instance for diagnostics tracking
    storageServiceV2Instance = this;
    
    // Listen for rate limiter circuit breaker events for diagnostics
    if (typeof window !== 'undefined') {
      window.addEventListener('rate-limiter-circuit-open', ((e: CustomEvent) => {
        addDiagnosticEntry(
          'circuit_breaker',
          'Rate Limiter',
          `Circuit breaker opened: ${e.detail.consecutiveFailures} consecutive failures detected`,
          {
            consecutiveFailures: e.detail.consecutiveFailures,
            circuitOpenDurationMs: e.detail.circuitOpenDurationMs,
            waitDurationSec: Math.round(e.detail.circuitOpenDurationMs / 1000)
          }
        );
      }) as EventListener);
    }
    
    // Bind event listeners with proper cleanup tracking
    const handleOnline = () => {
      this.isOnline = true;
      if (this.isSyncing) {
        this.notifyStatusListeners();
        return;
      }
      this.syncStatus = 'idle';
      this.notifyStatusListeners();
      
      // FIXED: Sync when coming back online. Simple mode has no masterKey; require it only in E2E.
      const e2eMode = isE2EEnabled();
      const canSync = this.isInitialized && !this.isSyncing && cloudStorageService.getPrimaryProvider() && (e2eMode ? !!this.masterKey : true);
      if (canSync) {
        if (import.meta.env.DEV) console.log('🌐 Back online - triggering sync');
        this.performFullSync().catch(err => {
          if (import.meta.env.DEV) console.error('Sync on reconnect failed:', err);
        });
        
        // Only restart auto-sync if the interval was cleared (e.g., manually stopped)
        if (!this.syncInterval) {
          if (import.meta.env.DEV) console.log('🔄 Restarting auto-sync after reconnect');
          this.startAutoSync();
        }
      }
    };
    
    const handleOffline = () => {
      this.isOnline = false;
      this.syncStatus = 'offline';
      this.notifyStatusListeners();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Re-validate sync status when app becomes visible: clear stale "success" if we can't sync (offline or no provider).
    const revalidateSyncStatusOnVisible = () => {
      if (this.syncStatus !== 'success') return;
      if (!navigator.onLine) {
        this.syncStatus = 'offline';
        this.notifyStatusListeners();
        if (import.meta.env.DEV) console.log('📱 Visible: revalidated – offline, clearing success');
        return;
      }
      if (!cloudStorageService.getPrimaryProvider()) {
        this.syncStatus = 'idle';
        this.notifyStatusListeners();
        if (import.meta.env.DEV) console.log('📱 Visible: no provider, clearing success');
      }
    };

    // When app becomes visible, re-validate so we don't show "success" when actually offline or without provider.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidateSyncStatusOnVisible();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on instance destruction (though singleton, good practice)
    if (typeof window !== 'undefined') {
      const cleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
      // Store cleanup for potential future use
      (this as any).__cleanup = cleanup;
    }
  }

  /**
   * Get the current master key (for use by components that need it)
   */
  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  /**
   * Clear master key from memory (e.g., on logout or password clear)
   * SECURITY: This prevents sync operations after password is cleared
   */
  clearMasterKey(): void {
    if (import.meta.env.DEV) console.log('🗑️ Clearing master key from memory');
    this.masterKey = null;
    this.isInitialized = false;
    this.passwordProvided = false;
    this.cloudKeyProvisioned = false;
    // Notify listeners that master key was cleared
    this.notifyMasterKeyListeners();
  }

  /**
   * Reset encryption state after provider migration
   * Forces the service to reload encryption key from the new primary provider
   * CRITICAL: Call this after migrating to a new storage provider OR when disconnecting the LAST provider
   * WARNING: Do NOT call this if other providers are still connected - it will cause decryption failures!
   * @param force - Set to true to bypass the safety check (e.g., for explicit user action)
   * @param skipEncryptedEntriesCheck - Set to true to skip the encrypted entries check (dangerous!)
   * @param reason - Context for why reset is being called (pre-initialize, disconnect, recovery)
   */
  resetEncryptionState(force: boolean = false, skipEncryptedEntriesCheck: boolean = false, reason?: 'pre-initialize' | 'disconnect' | 'recovery'): void {
    // SAFETY CHECK: Warn if called while other providers are still connected
    // This helps prevent the bug where master key is cleared while other providers need it
    const connectedCount = cloudStorageService.getConnectedProviderNames?.()?.length ?? 0;
    
    if (!force && connectedCount > 0 && import.meta.env.DEV) {
      console.warn(`⚠️ resetEncryptionState called with ${connectedCount} provider(s) still connected. This may cause decryption failures!`);
      if (import.meta.env.DEV) {
        console.trace('Call stack for debugging:');
      }
    }
    
    // CRITICAL SAFETY: Don't clear encryption state if encrypted entries exist in cache
    // Skip warning for 'pre-initialize' since we're about to load the key anyway
    if (!skipEncryptedEntriesCheck && !force && reason !== 'pre-initialize') {
      // Async check - log warning if entries exist (actual blocking done in async methods)
      this.hasEncryptedEntriesInCache().then(hasEncrypted => {
        if (hasEncrypted && import.meta.env.DEV) {
          console.error('❌ CRITICAL: resetEncryptionState called but encrypted entries exist in cache! This may cause data loss!');
        }
      }).catch(() => {
        // Ignore errors in this safety check
      });
    }
    
    this.masterKey = null;
    this.isInitialized = false;
    this.passwordProvided = false;
    this.cloudKeyProvisioned = false;
    this.initializationPromise = null;
    // Clear any pending sync operations
    this.isSyncing = false;
    this.pendingSyncRequest = false;
    // Notify listeners that master key was cleared
    this.notifyMasterKeyListeners();
  }
  
  /**
   * Check if there are encrypted entries in the local IndexedDB cache
   * Used to prevent accidental key loss when entries need decryption
   */
  async hasEncryptedEntriesInCache(): Promise<boolean> {
    try {
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      
      return new Promise<boolean>((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const entries = request.result || [];
          // Check if any entry has an IV (indicating E2E encryption)
          const hasEncrypted = entries.some((e: any) => e.iv && e.iv.length > 0);
          if (import.meta.env.DEV && hasEncrypted) {
            console.log(`📊 Found ${entries.filter((e: any) => e.iv && e.iv.length > 0).length} encrypted entries in cache`);
          }
          resolve(hasEncrypted);
        };
        request.onerror = () => {
          resolve(false); // Assume no entries on error
        };
      });
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to check for encrypted entries:', error);
      return false;
    }
  }

  /**
   * Check if a valid cached encryption key exists
   * Used to prevent clearing valid cached keys on app restart
   */
  async hasCachedEncryptionKey(): Promise<boolean> {
    try {
      const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      if (cachedKey?.value) {
        const parsedData = JSON.parse(cachedKey.value);
        // Check if cache has required fields for a valid key
        if (parsedData.encryptedKey && parsedData.iv && parsedData.salt) {
          if (import.meta.env.DEV) console.log('✅ Valid cached encryption key exists');
          return true;
        }
      }
      return false;
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to check for cached encryption key:', error);
      return false;
    }
  }


  /**
   * Clear all local sync state - call on disconnect to prevent stale operations
   * This clears pending operations and sync timestamps to ensure a clean reconnect
   */
  async clearLocalSyncState(): Promise<void> {
    if (import.meta.env.DEV) console.log('🧹 Clearing local sync state...');
    
    // Clear pending operations to prevent stale uploads after reconnect
    await saveToIndexedDB('settings', { key: 'pendingOperations', value: [] });
    
    // Clear last sync time to force fresh sync on reconnect
    await saveToIndexedDB('settings', { key: 'lastSyncTime', value: null });
    
    if (import.meta.env.DEV) console.log('✅ Local sync state cleared');
  }

  /**
   * Validate cached encryption key version against cloud
   * If cloud has newer version (password changed on another device), re-load from cloud
   */
  private async validateCachedKeyVersion(password: string): Promise<void> {
    try {
      const keyPath = 'encryption-key.json';
      const cloudKeyData = await cloudStorageWithRetry.downloadFromPrimary(keyPath);
      if (!cloudKeyData) {
        // No cloud key - cache is invalid, should have been caught earlier
        return;
      }
      
      const cloudParsed: EncryptedKeyData = JSON.parse(cloudKeyData);
      const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      
      if (cachedKey?.value) {
        const cachedParsed = JSON.parse(cachedKey.value);
        // Check version - if cloud is newer, password was changed on another device
        if (cloudParsed.version && cachedParsed.version && cloudParsed.version > cachedParsed.version) {
          if (import.meta.env.DEV) console.log(`🔄 Cloud key version (${cloudParsed.version}) > cache (${cachedParsed.version}), re-loading...`);
          await this.loadMasterKeyFromCloud(password);
        }
      }
    } catch (error) {
      // Background validation - log but don't throw
      if (import.meta.env.DEV) console.warn('⚠️ Cloud key version check failed:', error);
    }
  }

  /**
   * Subscribe to master key changes (event-based, replaces polling)
   * Returns an unsubscribe function
   */
  onMasterKeyChanged(listener: (key: CryptoKey | null) => void): () => void {
    this.masterKeyListeners.push(listener);
    return () => {
      const index = this.masterKeyListeners.indexOf(listener);
      if (index >= 0) {
        this.masterKeyListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all master key listeners of a change
   */
  private notifyMasterKeyListeners(): void {
    for (const listener of this.masterKeyListeners) {
      try {
        listener(this.masterKey);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Master key listener error:', error);
      }
    }
  }

  /**
   * Subscribe to granular sync progress events (for UI updates)
   * Returns an unsubscribe function
   */
  onSyncProgress(listener: (progress: GranularSyncProgress) => void): () => void {
    this.progressListeners.push(listener);
    return () => {
      const index = this.progressListeners.indexOf(listener);
      if (index >= 0) {
        this.progressListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all progress listeners of sync progress update
   */
  private notifyProgressListeners(progress: GranularSyncProgress): void {
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Progress listener error:', error);
      }
    }
  }

  /**
   * Get the current granular sync progress (for components that mount during sync)
   */
  getCurrentSyncProgress(): GranularSyncProgress | null {
    if (!this.isSyncing) return null;
    return this.currentProgress;
  }

  private currentProgress: GranularSyncProgress | null = null;

  /**
   * Helper to update and notify sync progress
   */
  private updateProgress(
    phase: SyncPhase,
    filesProcessed: number,
    totalFiles: number,
    percentComplete: number,
    message?: string
  ): void {
    this.currentProgress = {
      phase,
      filesProcessed,
      totalFiles,
      percentComplete,
      message
    };
    this.notifyProgressListeners(this.currentProgress);
  }

  /**
   * Reconcile entries with progress tracking wrapper
   */
  private async reconcileEntriesWithProgress(
    cloudFiles: any[],
    localEntries: Map<string, EncryptedEntry>,
    syncState: SyncState,
    deletedIds: Set<string>,
    totalFiles: number
  ): Promise<void> {
    this.updateProgress('downloading', 0, 0, 35, 'syncProgress.preparingSync');
    
    // Track actual counts for consistent progress reporting
    let downloadTotal = 0;
    let uploadTotal = 0;
    
    // Pass progress callback to enable per-file updates
    const onDownloadProgress = (completed: number, total: number) => {
      // Update total on first call (when we know actual count)
      if (downloadTotal === 0 && total > 0) downloadTotal = total;
      // Map download progress: 35% to 75% of total sync
      const progressPercent = 35 + Math.floor((completed / Math.max(downloadTotal, 1)) * 40);
      this.updateProgress('downloading', completed, downloadTotal, progressPercent, 'syncProgress.downloadingEntries');
    };
    
    const onUploadProgress = (completed: number, total: number) => {
      // Update total on first call (when we know actual count)
      if (uploadTotal === 0 && total > 0) uploadTotal = total;
      // Map upload progress: 75% to 90% of total sync
      const progressPercent = 75 + Math.floor((completed / Math.max(uploadTotal, 1)) * 15);
      this.updateProgress('uploading', completed, uploadTotal, progressPercent, 'syncProgress.uploadingEntries');
    };
    
    await this.reconcileEntries(cloudFiles, localEntries, syncState, deletedIds, onDownloadProgress, onUploadProgress);
    
    this.updateProgress('finalizing', 0, 0, 90, 'syncProgress.syncComplete');
  }

  /**
   * Check if service is fully initialized and ready for sync
   * This ensures both masterKey exists and initialization is complete
   */
  isFullyInitialized(): boolean {
    return this.isInitialized && this.masterKey !== null;
  }

  /**
   * Can we perform the initial sync? Requires initialization + key + password provided or cloud key provisioned
   */
  canInitialSync(): boolean {
    return this.isInitialized && this.masterKey !== null && (this.passwordProvided || this.cloudKeyProvisioned);
  }

  /**
   * Track if initialization is currently in progress
   * Used to prevent race conditions with OAuth callbacks
   */
  private initializationInProgress = false;
  
  /**
   * Password stored temporarily during pending-oauth initialization
   * Used when we need to defer key loading until provider connects
   */
  private pendingE2EPassword: string | null = null;
  
  /**
   * Initialization state machine for E2E with OAuth
   * - 'idle': Not initialized
   * - 'initializing': Initialization in progress
   * - 'pending-oauth': Password set but waiting for OAuth to complete
   * - 'complete': Fully initialized with master key
   */
  private initializationState: 'idle' | 'initializing' | 'pending-oauth' | 'complete' = 'idle';

  /**
   * Check if initialization is currently in progress
   * CRITICAL: OAuth callbacks should check this and wait instead of requesting password
   */
  get isInitializationInProgress(): boolean {
    return this.initializationInProgress;
  }
  
  /**
   * Check if initialization is waiting for OAuth to complete
   * When true, the password is stored and will be used once provider connects
   * Components should NOT request password again in this state
   */
  get isPendingOAuth(): boolean {
    return this.initializationState === 'pending-oauth';
  }

  /**
   * Initialize the storage service with a password
   * FIXED: Guard against concurrent initializations
   * Now supports both Simple (no encryption) and E2E (encrypted) modes
   */
  async initialize(password?: string): Promise<void> {
    const e2eMode = isE2EEnabled();
    
    // Simple mode - no master key needed
    if (!e2eMode) {
      await openDB();
      this.deviceId = await this.getOrCreateDeviceId();
      this.isInitialized = true;
      if (import.meta.env.DEV) console.log('📝 Simple mode initialized (no encryption)');
      return;
    }
    
    // E2E mode - require password
    if (!password) {
      throw new Error('Password required for E2E encryption mode');
    }
    
    // If already initialized with a master key, just return
    if (this.isInitialized && this.masterKey) {
      this.passwordProvided = !!password;
      if (import.meta.env.DEV) console.log('Storage service already initialized with master key');
      return;
    }
    
    // If initialized but missing master key, re-derive it
    if (this.isInitialized && !this.masterKey && password) {
      const hasCloudProvider = cloudStorageService.getPrimaryProvider() !== null;
      const e2eMode = isE2EEnabled();
      
      if (e2eMode && hasCloudProvider) {
        // CLOUD E2E MODE: Use cloud key data (cached or downloaded)
        // This ensures the correct salt is used for key derivation
        if (import.meta.env.DEV) console.log('🔐 Re-deriving master key from cloud (E2E mode)');
        await this.loadMasterKeyFromCloud(password);
        this.passwordProvided = true;
        return;
      }
      
      // OFFLINE-ONLY MODE: Use local salt (no cloud provider configured)
      const storedSaltRecord = await getFromIndexedDB('settings', 'localKeySalt');
      if (storedSaltRecord && typeof storedSaltRecord.value === 'string') {
        const salt = new Uint8Array(base64ToArrayBuffer(storedSaltRecord.value));
        this.masterKey = await deriveKeyFromPassword(password, salt);
        this.passwordProvided = true;
        if (import.meta.env.DEV) console.log('🔐 Re-derived from local salt (offline mode)');
        // Cache the derived key so it survives page reload (e.g., during OAuth redirect)
        try {
          const encrypted = await encryptMasterKey(this.masterKey, password);
          await saveToIndexedDB('settings', {
            key: 'cachedEncryptionKeyData',
            value: JSON.stringify({
              encryptedKey: encrypted.encryptedKey,
              iv: encrypted.iv,
              salt: encrypted.salt,
              version: 1,
              createdAt: new Date().toISOString(),
            }),
            timestamp: Date.now(),
            version: 1,
          });
          if (import.meta.env.DEV) console.log('💾 Local-only key cached for page reload survival');
        } catch (cacheErr) {
          if (import.meta.env.DEV) console.warn('⚠️ Failed to cache local-only key:', cacheErr);
        }
        return;
      }
      const saltError = new Error('SALT_NOT_FOUND');
      (saltError as Error & { code: string }).code = 'SALT_NOT_FOUND';
      throw saltError;
    }

    // If initialization in progress, wait for it
    if (this.initializationPromise) {
      if (import.meta.env.DEV) console.log('Waiting for ongoing initialization...');
      return this.initializationPromise;
    }
    
    // Start initialization - set flag BEFORE async work
    this.initializationInProgress = true;
    
    this.initializationPromise = (async () => {
      try {
        await openDB();
        this.passwordProvided = !!password;
        this.deviceId = await this.getOrCreateDeviceId();
        
        const e2eMode = isE2EEnabled();
        
        // STEP 1: Try to load master key from LOCAL CACHE first (no cloud needed)
        // This allows credential decryption for provider connection in E2E mode
        let keyLoadedFromCache = false;
        if (e2eMode && password) {
          let hasCachedKeyData = false;
          try {
            const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
            // Cache indefinitely - only invalidated by explicit password change
            if (cachedKey?.value) {
              const parsedData = JSON.parse(cachedKey.value);
              if (parsedData.encryptedKey && parsedData.iv && parsedData.salt) {
                hasCachedKeyData = true; // Track that we found cached data
                this.masterKey = await decryptMasterKey(
                  parsedData.encryptedKey,
                  parsedData.salt,
                  parsedData.iv,
                  password
                );
                keyLoadedFromCache = true;
                if (import.meta.env.DEV) {
                  console.log('🔐 Master key pre-loaded from cache (indefinite)');
                  getMasterKeyFingerprint(this.masterKey!).then((fp) => console.log('[key-debug] masterKey fingerprint (init cache):', fp));
                }
              }
            }
          } catch (cacheError) {
            // If cached data exists but decryption failed, it's a wrong password
            if (hasCachedKeyData) {
              if (import.meta.env.DEV) console.error('❌ Cached key decryption failed - password is incorrect');
              throw new Error('CACHED_PASSWORD_INCORRECT');
            }
          }
        }
        
        // STEP 2: Connect providers WITH the loaded key (if available)
        // This allows credential decryption in E2E mode
        const { connectionStateManager } = await import('@/services/connectionStateManager');
        await connectionStateManager.ensureConnections(this.masterKey);

        // STEP 3: Detect cloud availability and load/validate key appropriately
        const hasCloudProvider = cloudStorageService.getPrimaryProvider() !== null;
        
        if (hasCloudProvider && e2eMode) {
          if (keyLoadedFromCache) {
            // Key loaded from cache - validate version and fingerprint against cloud (blocking)
            // loadMasterKeyFromCloud compares versions and fingerprints; if they differ, picks the key that decrypts entries
            try {
              await this.loadMasterKeyFromCloud(password);
              if (import.meta.env.DEV) console.log('✅ Using cached key (validated against cloud)');
            } catch (err) {
              if (import.meta.env.DEV) console.warn('⚠️ Key validation against cloud failed, using cached key:', err);
            }
          } else {
            // No cached key - try to load from cloud, or generate new if first-time E2E setup
            try {
              await this.loadMasterKeyFromCloud(password);
              if (import.meta.env.DEV) console.log('✅ Loaded key from cloud');
            } catch (error) {
              if (error instanceof Error && error.message === 'NO_CLOUD_KEY') {
                // FIRST-TIME E2E SETUP: No cloud key exists yet
                if (import.meta.env.DEV) console.log('🔑 First-time E2E setup - generating new master key...');
                
                // Check for Simple mode entries before generating key
                let hasSimpleModeEntries = false;
                try {
                  // Ensure primary provider is registered before listFiles (avoids "no primary" race)
                  if (!cloudStorageService.getPrimaryProvider()) {
                    const { connectionStateManager } = await import('@/services/connectionStateManager');
                    await connectionStateManager.ensureConnections(this.masterKey ?? null);
                  }
                  if (!cloudStorageService.getPrimaryProvider()) {
                    if (import.meta.env.DEV) console.log('⏭️ No primary provider for Simple-mode check, skipping listFiles');
                  } else {
                  const cloudEntries = await cloudStorageWithRetry.listFiles('entries');
                  if (cloudEntries.length > 0) {
                    const entryFiles = cloudEntries.filter(f => f.name.startsWith('entry-') && f.name.endsWith('.json'));
                    if (entryFiles.length > 0) {
                      const sampleData = await cloudStorageWithRetry.downloadFromPrimary(entryFiles[0].path);
                      if (sampleData) {
                        const parsed = JSON.parse(sampleData);
                        // No IV = Simple mode entry
                        if (!parsed.iv || parsed.iv === '') {
                          hasSimpleModeEntries = true;
                          if (import.meta.env.DEV) console.log('📝 Found Simple mode entries - will migrate after key setup');
                        } else {
                          // Encrypted entries without key = data loss situation
                          if (import.meta.env.DEV) console.error('❌ Found encrypted entries but no encryption key');
                          throw new Error('ENTRIES_WITHOUT_KEY');
                        }
                      }
                    }
                  }
                  }
                } catch (checkError) {
                  if (checkError instanceof Error && 
                      (checkError.message === 'ENTRIES_WITHOUT_KEY' || 
                       checkError.message === 'NETWORK_ERROR_RETRY')) {
                    throw checkError;
                  }
                  // Unknown error checking entries — DON'T generate new key, ask user to retry
                  if (import.meta.env.DEV) console.error('❌ Error while checking for existing entries:', checkError);
                  throw new Error('NETWORK_ERROR_RETRY');
                }
                
                // Try other connected providers for existing key before generating new one
                if (!this.masterKey) {
                  const otherProviderKey = await this.tryLoadKeyFromOtherProviders();
                  if (otherProviderKey) {
                    await this.loadMasterKeyFromCloud(password, otherProviderKey);
                  } else {
                    // Defense-in-depth: verify cloud has no encrypted entries before generating
                    if (await this.hasCloudEncryptedEntries()) {
                      if (import.meta.env.DEV) console.error('❌ BLOCKED: Cloud has encrypted entries but no encryption key — refusing to generate new key');
                      throw new Error('ENTRIES_WITHOUT_KEY');
                    }
                    this.masterKey = await generateMasterKey();
                    this.notifyMasterKeyListeners();
                    if (import.meta.env.DEV) {
                      const fp = await getMasterKeyFingerprint(this.masterKey!);
                      console.log('[key-debug] NEW master key generated! fp=' + fp);
                    }
                  }
                }
                // Upload to cloud
                await this.saveMasterKeyToCloud(password);
                this.cloudKeyProvisioned = true;
                if (import.meta.env.DEV) console.log('✅ New encryption key generated and uploaded');
                
                // Migrate Simple mode entries if any exist
                if (hasSimpleModeEntries) {
                  if (import.meta.env.DEV) console.log('🔐 Migrating Simple mode entries to E2E...');
                  await this.migrateSimpleModeEntriesToE2E();
                }
              } else if (error instanceof Error && error.message === 'DECRYPTION_FAILED') {
                // Wrong password
                throw error;
              } else {
                // Network or other error
                throw new Error('NETWORK_ERROR_RETRY');
              }
            }
          }
        } else if (hasCloudProvider) {
          try {
            // CLOUD IS THE SINGLE SOURCE OF TRUTH
            // The salt and encrypted master key come from cloud's encryption-key.json
            await this.loadMasterKeyFromCloud(password);
          } catch (error) {
            // Handle first-time E2E setup: no cloud key yet
            if (error instanceof Error && error.message === 'NO_CLOUD_KEY') {
              // CRITICAL: Before creating a new key, check if cloud has existing entries
              // If entries exist but no key, check if they're encrypted or plain (Simple mode)
              let hasSimpleModeEntries = false;
              try {
                // Ensure primary provider is registered before listFiles (avoids "no primary" race)
                if (!cloudStorageService.getPrimaryProvider()) {
                  const { connectionStateManager } = await import('@/services/connectionStateManager');
                  await connectionStateManager.ensureConnections(this.masterKey ?? null);
                }
                if (!cloudStorageService.getPrimaryProvider()) {
                  if (import.meta.env.DEV) console.log('⏭️ No primary provider for Simple-mode check, skipping listFiles');
                } else {
                const cloudEntries = await cloudStorageWithRetry.listFiles('entries');
                if (cloudEntries.length > 0) {
                  // Download a sample entry to check if it's encrypted
                  const entryFiles = cloudEntries.filter(f => f.name.startsWith('entry-') && f.name.endsWith('.json'));
                  if (entryFiles.length > 0) {
                    const sampleFile = entryFiles[0];
                    try {
                      const sampleData = await cloudStorageWithRetry.downloadFromPrimary(sampleFile.path);
                      if (sampleData) {
                        const parsed = JSON.parse(sampleData);
                        // Check if entry has IV - if empty/missing, it's a Simple mode entry
                        if (!parsed.iv || parsed.iv === '') {
                          if (import.meta.env.DEV) console.log('📝 Found Simple mode entries in cloud - safe to create E2E key');
                          hasSimpleModeEntries = true;
                          // Mark for migration after key generation
                        } else {
                          // Entry has IV = encrypted. Before throwing ENTRIES_WITHOUT_KEY,
                          // do an extended check for the encryption key with retries
                          if (import.meta.env.DEV) console.log('🔍 Found encrypted entries, doing extended key check...');
                          
                          let keyFound = false;
                          
                          for (let keyAttempt = 1; keyAttempt <= ENCRYPTION_CONSTANTS.KEY_CHECK_RETRIES; keyAttempt++) {
                            try {
                              const keyExists = !!(await this.checkCloudHasEncryptionKey());
                              if (keyExists) {
                                keyFound = true;
                                if (import.meta.env.DEV) console.log('🔑 Found encryption key on retry ' + keyAttempt);
                                break;
                              }
                              // Key confirmed not to exist
                              if (import.meta.env.DEV) console.log('🔍 Key check ' + keyAttempt + ': key not found');
                              break; // Don't retry if we got a clean "not found" response
                            } catch (keyCheckError: any) {
                              // Network error - wait and retry
                              if (keyAttempt < ENCRYPTION_CONSTANTS.KEY_CHECK_RETRIES) {
                                if (import.meta.env.DEV) {
                                  console.log(`⏳ Key check failed (attempt ${keyAttempt}/${ENCRYPTION_CONSTANTS.KEY_CHECK_RETRIES}), waiting ${ENCRYPTION_CONSTANTS.KEY_CHECK_DELAY_MS/1000}s...`);
                                }
                                await new Promise(r => setTimeout(r, ENCRYPTION_CONSTANTS.KEY_CHECK_DELAY_MS));
                              } else {
                                // Exhausted retries - this is a network issue, not missing key
                                if (import.meta.env.DEV) console.error('❌ Could not verify key existence due to network errors');
                                throw new Error('NETWORK_ERROR_RETRY');
                              }
                            }
                          }
                          
                          if (keyFound) {
                            // Key exists - this is a password issue, not missing key
                            // Re-throw with a different error so UI can prompt for password
                            if (import.meta.env.DEV) console.error('❌ Encryption key found but could not decrypt - password may be wrong');
                            throw new Error('DECRYPTION_FAILED');
                          }
                          
                          // Key confirmed missing, entries are orphaned
                          if (import.meta.env.DEV) console.error('❌ Cloud has encrypted entries but no encryption key - data may be inaccessible');
                          throw new Error('ENTRIES_WITHOUT_KEY');
                        }
                      }
                    } catch (sampleError) {
                      if (sampleError instanceof Error && 
                          (sampleError.message === 'ENTRIES_WITHOUT_KEY' || 
                           sampleError.message === 'DECRYPTION_FAILED' ||
                           sampleError.message === 'NETWORK_ERROR_RETRY')) {
                        throw sampleError;
                      }
                      // Check if this is a rate limit error
                      const errMsg = (sampleError instanceof Error ? sampleError.message : '').toLowerCase();
                      if (errMsg.includes('rate_limit') || errMsg.includes('429') || errMsg.includes('network')) {
                        if (import.meta.env.DEV) console.error('❌ Network error while checking sample entry');
                        throw new Error('NETWORK_ERROR_RETRY');
                      }
                      // JSON parse error or other download error - check if it might be encrypted binary
                      if (import.meta.env.DEV) console.warn('⚠️ Could not parse sample entry, assuming encrypted:', sampleError);
                      if (import.meta.env.DEV) console.error('❌ Cloud has entries that could not be parsed - may be encrypted without key');
                      throw new Error('ENTRIES_WITHOUT_KEY');
                    }
                  }
                }
                }
              } catch (listError) {
                if (listError instanceof Error && 
                    (listError.message === 'ENTRIES_WITHOUT_KEY' || 
                     listError.message === 'DECRYPTION_FAILED' ||
                     listError.message === 'NETWORK_ERROR_RETRY')) {
                  throw listError;
                }
                // Network error while checking - DON'T generate new key, ask user to retry
                if (import.meta.env.DEV) console.error('❌ Network error while checking for existing entries:', listError);
                throw new Error('NETWORK_ERROR_RETRY');
              }
              
              // Cloud is truly empty OR has only Simple mode entries - safe to generate new master key
              if (import.meta.env.DEV) console.log('🔑 No cloud key found - first-time E2E setup...');
              
              // Log provider state for debugging
              const provider = cloudStorageService.getPrimaryProvider();
              if (import.meta.env.DEV) {
                console.log('🔐 E2E Setup - Provider state:');
                console.log('   - Primary provider:', provider?.name || 'NONE');
                console.log('   - Has any provider:', cloudStorageService.getConnectedProviderCount() > 0);
              }
              
              if (!this.masterKey) {
                const otherProviderKey = await this.tryLoadKeyFromOtherProviders();
                if (otherProviderKey) {
                  await this.loadMasterKeyFromCloud(password, otherProviderKey);
                } else {
                  if (await this.hasCloudEncryptedEntries()) {
                    if (import.meta.env.DEV) console.error('❌ BLOCKED: Cloud has encrypted entries but no encryption key — refusing to generate new key');
                    throw new Error('ENTRIES_WITHOUT_KEY');
                  }
                  this.masterKey = await generateMasterKey();
                  this.notifyMasterKeyListeners();
                  if (import.meta.env.DEV) {
                    const fp = await getMasterKeyFingerprint(this.masterKey!);
                    console.log('[key-debug] NEW master key generated! fp=' + fp);
                    console.log('🔐 Master key generated, attempting cloud upload...');
                  }
                }
              }
              // Upload the new key to cloud (password encrypts the master key)
              await this.saveMasterKeyToCloud(password);
              this.cloudKeyProvisioned = true;
              if (import.meta.env.DEV) console.log('✅ New encryption key generated and uploaded to cloud');
              
              // If we had Simple mode entries, migrate them to E2E encryption
              if (hasSimpleModeEntries) {
                if (import.meta.env.DEV) console.log('🔐 Migrating Simple mode entries to E2E encryption...');
                await this.migrateSimpleModeEntriesToE2E();
              }
            } else if (error instanceof Error && error.message === 'DECRYPTION_FAILED') {
              // Wrong password - re-throw without modification
              throw error;
            } else {
              // Unknown error (likely network) - DON'T generate new key
              if (import.meta.env.DEV) console.error('❌ Error loading cloud key:', error);
              throw new Error('NETWORK_ERROR_RETRY');
            }
          }
        } else if (!keyLoadedFromCache) {
        // NO CLOUD PROVIDER AND NO CACHED KEY
          // FIRST-TIME E2E SETUP: Check if there's a pending OAuth ready to connect
          // In onboarding flow, OAuth completes before password is set, so tokens are "pending"
          // Check ALL possible pending OAuth markers:
          // - onboarding-pending-oauth: Set by SyncCheckStep when E2E password-first flow (before OAuth starts)
          // - pending-oauth-provider: Set by DropboxSync/GoogleDriveSync when OAuth returns without key
          // - onboarding-provider: Legacy marker
          const hasPendingOAuth = sessionStorage.getItem('onboarding-pending-oauth') !== null ||
                                  sessionStorage.getItem('pending-oauth-provider') !== null ||
                                  sessionStorage.getItem('onboarding-provider') !== null ||
                                  window.location.search.includes('code=');
          
          if (hasPendingOAuth && e2eMode) {
            // CRITICAL FIX: Do NOT generate a new key yet!
            // Wait for OAuth to complete and provider to connect, then load cloud key.
            // Generating a local key here causes all existing cloud entries to fail decryption.
            if (import.meta.env.DEV) {
              console.log('🔑 [Init] Pending OAuth detected - deferring key loading until provider connects');
              console.log('   (Password stored, will derive key with cloud salt after provider connects)');
            }
            
            // Store password so onCloudProviderConnected can use it later
            this.pendingE2EPassword = password;
            
            // Mark initialization as pending OAuth completion
            // This is a special state: initialized enough for components to render,
            // but key will be properly derived once cloud provider connects
            this.initializationState = 'pending-oauth';
            
            // Dispatch event so OAuth callbacks know we're ready for them
            window.dispatchEvent(new CustomEvent('encryption-pending-oauth', {
              detail: { hasPassword: true }
            }));
            
            // NOTE: We do NOT set masterKey here - that happens in onCloudProviderConnected
            // The provider sync components will call onCloudProviderConnected after OAuth completes
          } else {
            // Not first-time setup with pending OAuth - check for encrypted entries
            const hasEncryptedEntries = await this.hasEncryptedEntriesInCache();
            
            if (hasEncryptedEntries) {
              // Entries exist that were encrypted with a cloud key we don't have
              // DO NOT generate a new key - that would make entries permanently unreadable
              if (import.meta.env.DEV) console.error('❌ Encrypted entries exist but no cloud key available. Connect to cloud storage to decrypt.');
              throw new Error('CLOUD_KEY_REQUIRED');
            }
            
            // No encrypted entries - safe to use local-only mode with local salt
            if (import.meta.env.DEV) console.log('📴 No cloud provider, no encrypted entries - using local-only encryption');
            const storedSaltRecord = await getFromIndexedDB('settings', 'localKeySalt');
            let salt: Uint8Array;
            
            if (storedSaltRecord && typeof storedSaltRecord.value === 'string') {
              salt = new Uint8Array(base64ToArrayBuffer(storedSaltRecord.value));
            } else {
              salt = generateSalt();
              await saveToIndexedDB('settings', { key: 'localKeySalt', value: arrayBufferToBase64(salt.buffer) });
            }
            
            this.masterKey = await deriveKeyFromPassword(password, salt);
            this.notifyMasterKeyListeners();

            // Cache the derived key so it survives page reload (e.g., during OAuth redirect)
            try {
              const encrypted = await encryptMasterKey(this.masterKey, password);
              await saveToIndexedDB('settings', {
                key: 'cachedEncryptionKeyData',
                value: JSON.stringify({
                  encryptedKey: encrypted.encryptedKey,
                  iv: encrypted.iv,
                  salt: encrypted.salt,
                  version: 1,
                  createdAt: new Date().toISOString(),
                }),
                timestamp: Date.now(),
                version: 1,
              });
              if (import.meta.env.DEV) console.log('💾 Local-only key cached for page reload survival');
            } catch (cacheErr) {
              if (import.meta.env.DEV) console.warn('⚠️ Failed to cache local-only key:', cacheErr);
            }
          }
        } else {
          // Key was loaded from cache but no cloud provider connected
          // Keep using the cached key - it's likely from a previous session with cloud
          if (import.meta.env.DEV) console.log('✅ Using cached key (no active cloud provider)');
        }

        // FIXED: Don't start sync during initialization - let onCloudProviderConnected handle it
        // This prevents race conditions where sync starts before window bindings are ready
        // The sync will be triggered properly when the provider calls onCloudProviderConnected
        
        this.isInitialized = true;
        
        // Clear initialization state BEFORE notifying so getEncryptionState().isReady is true
        this.initializationPromise = null;
        this.initializationInProgress = false;
        
        this.notifyMasterKeyListeners();
        
        const { encryptionStateManager } = await import('@/services/encryptionStateManager');
        encryptionStateManager.notifyStateChanged();
        
        window.dispatchEvent(new CustomEvent('encryption-initialized', { 
          detail: { hasMasterKey: this.masterKey !== null }
        }));
        
        if (import.meta.env.DEV) console.log('✅ Encryption initialized, dispatched event');
      } finally {
        this.initializationPromise = null;
        this.initializationInProgress = false;
      }
    })();
    
    return this.initializationPromise;
  }

  /**
   * Verify if a password can decrypt the cached or cloud encryption key
   * Returns { valid: true/false, source: 'cache' | 'cloud' | 'none' }
   * Does NOT modify any internal state - safe for pre-validation
   * Works OFFLINE by checking local cache first
   */
  async verifyPasswordWithLocalCache(password: string): Promise<{ valid: boolean; source: 'cache' | 'cloud' | 'none' }> {
    // STEP 1: Try local cache first (works offline)
    try {
      const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      if (cachedKey?.value) {
        const parsedData = JSON.parse(cachedKey.value);
        if (parsedData.encryptedKey && parsedData.iv && parsedData.salt) {
          // Try to decrypt the master key with this password
          await decryptMasterKey(
            parsedData.encryptedKey,
            parsedData.salt,
            parsedData.iv,
            password
          );
          // If we got here, password is correct
          if (import.meta.env.DEV) console.log('✅ Password verified against local cache');
          return { valid: true, source: 'cache' };
        }
      }
    } catch (cacheError) {
      // Password doesn't work with cache - might be wrong or cache corrupted
      if (import.meta.env.DEV) console.log('⚠️ Password verification failed against cache:', cacheError);
    }
    
    // STEP 2: Try cloud if online and has provider
    if (this.isOnline && cloudStorageService.getPrimaryProvider()) {
      try {
        const cloudKey = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
        if (cloudKey) {
          const parsed = JSON.parse(cloudKey);
          await decryptMasterKey(
            parsed.encryptedKey,
            parsed.salt,
            parsed.iv,
            password
          );
          if (import.meta.env.DEV) console.log('✅ Password verified against cloud key');
          return { valid: true, source: 'cloud' };
        }
      } catch (cloudError) {
        if (import.meta.env.DEV) console.log('⚠️ Password verification failed against cloud:', cloudError);
      }
    }
    
    return { valid: false, source: 'none' };
  }

  /**
   * Reinitialize encryption with a verified password
   * Used by recovery dialog after password verification
   * Does NOT call resetEncryptionState() - preserves cached entries
   */
  async reinitializeWithPassword(password: string): Promise<void> {
    if (import.meta.env.DEV) console.log('🔐 Reinitializing with verified password...');
    
    // Open DB if not already
    await openDB();
    this.deviceId = await this.getOrCreateDeviceId();
    
    // STEP 1: Try to load from local cache first (offline-capable)
    let keyFromCacheValid = false;
    try {
      const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      if (cachedKey?.value) {
        const parsedData = JSON.parse(cachedKey.value);
        if (parsedData.encryptedKey && parsedData.iv && parsedData.salt) {
          this.masterKey = await decryptMasterKey(
            parsedData.encryptedKey,
            parsedData.salt,
            parsedData.iv,
            password
          );
          keyFromCacheValid = await this.trySampleDecrypt();
          if (keyFromCacheValid) {
            this.passwordProvided = true;
            this.isInitialized = true;
            this.notifyMasterKeyListeners();
            const { encryptionStateManager } = await import('@/services/encryptionStateManager');
            encryptionStateManager.notifyStateChanged();
            if (import.meta.env.DEV) console.log('✅ Reinitialized from local cache');
            return;
          }
          if (import.meta.env.DEV) console.log('⚠️ Cached key cannot decrypt entries, trying cloud/other providers');
          this.masterKey = null;
          await saveToIndexedDB('settings', { key: 'cachedEncryptionKeyData', value: null, timestamp: 0, version: 0 });
        }
      }
    } catch (cacheError) {
      if (import.meta.env.DEV) console.log('⚠️ Cache load failed, trying cloud:', cacheError);
    }

    // STEP 2: Try cloud and other providers
    if (this.isOnline && cloudStorageService.getPrimaryProvider()) {
      try {
        await this.loadMasterKeyFromCloud(password);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message === 'NO_CLOUD_KEY') {
          const otherProviderKey = await this.tryLoadKeyFromOtherProviders();
          if (otherProviderKey) {
            await this.loadMasterKeyFromCloud(password, otherProviderKey);
          }
        } else {
          throw loadError;
        }
      }
      const keyValid = this.masterKey && await this.trySampleDecrypt();
      if (keyValid) {
        this.passwordProvided = true;
        this.isInitialized = true;
        this.notifyMasterKeyListeners();
        const { encryptionStateManager } = await import('@/services/encryptionStateManager');
        encryptionStateManager.notifyStateChanged();
        if (import.meta.env.DEV) console.log('✅ Reinitialized from cloud key');
        return;
      }
      this.masterKey = null;
      throw new Error('KEY_MISMATCH_ALL_PROVIDERS');
    }

    // No source available
    throw new Error('NO_CACHED_KEY');
  }

  /**
   * Called when a cloud provider is first connected
   * Handles both Simple (no encryption) and E2E (encrypted) modes
   * CRITICAL: Also handles pending-oauth state from deferred initialization
   */
  async onCloudProviderConnected(password?: string): Promise<{ requiresPassword?: boolean; reason?: string }> {
    const e2eMode = isE2EEnabled();
    
    // CRITICAL FIX: Check for pending OAuth from sessionStorage (survives page reload)
    // The in-memory initializationState and pendingE2EPassword are lost after OAuth redirect
    const hasPendingOnboardingOAuth = sessionStorage.getItem('onboarding-pending-oauth') !== null ||
                                       sessionStorage.getItem('pending-oauth-provider') !== null;
    
    // Try to get password from multiple sources:
    // 1. Explicitly passed password parameter
    // 2. In-memory pendingE2EPassword (if no page reload happened)
    // 3. Persistent storage via retrievePassword() (survives page reload)
    let effectivePassword = password || this.pendingE2EPassword;
    
    if (!effectivePassword && hasPendingOnboardingOAuth && e2eMode) {
      // Password was stored before OAuth redirect - retrieve it from persistent storage
      const { retrievePassword } = await import('@/utils/passwordStorage');
      effectivePassword = await retrievePassword();
      if (import.meta.env.DEV) {
        console.log('🔑 [onCloudProviderConnected] Retrieved password from persistent storage:', !!effectivePassword);
      }
    }

    // Wait for primary provider to be registered before any cloud use (avoids "no primary" race)
    const { connectionStateManager } = await import('@/services/connectionStateManager');
    if (!cloudStorageService.getPrimaryProvider()) {
      await connectionStateManager.ensureConnections(this.masterKey ?? null);
    }
    const PRIMARY_WAIT_MS = 80;
    const PRIMARY_WAIT_MAX_MS = 640;
    const startWait = Date.now();
    while (!cloudStorageService.getPrimaryProvider() && Date.now() - startWait < PRIMARY_WAIT_MAX_MS) {
      if (import.meta.env.DEV) {
        console.log('⏳ [onCloudProviderConnected] No primary provider yet, waiting...');
      }
      await new Promise(resolve => setTimeout(resolve, PRIMARY_WAIT_MS));
      await connectionStateManager.ensureConnections(this.masterKey ?? null);
    }
    if (import.meta.env.DEV && !cloudStorageService.getPrimaryProvider()) {
      console.log('⚠️ [onCloudProviderConnected] Proceeding without primary provider after wait');
    }
    
    // Handle deferred E2E initialization (either from in-memory state OR sessionStorage markers)
    const shouldCompleteDeferredInit = 
      (this.initializationState === 'pending-oauth' && effectivePassword) ||
      (hasPendingOnboardingOAuth && effectivePassword && e2eMode && !this.masterKey);
    
    if (shouldCompleteDeferredInit) {
      if (import.meta.env.DEV) {
        console.log('🔑 [onCloudProviderConnected] Completing deferred E2E initialization...');
        console.log('   Source:', this.initializationState === 'pending-oauth' ? 'in-memory state' : 'sessionStorage marker');
        console.log('   Cloud provider now connected, loading cloud key with stored password');
      }
      
      // Clear ALL pending state markers (both in-memory and sessionStorage)
      this.pendingE2EPassword = null;
      this.initializationState = 'complete';
      this.passwordProvided = true;
      sessionStorage.removeItem('onboarding-pending-oauth');
      sessionStorage.removeItem('pending-oauth-provider');
      sessionStorage.removeItem('onboarding-provider');
      
      // Now that provider is connected, load the cloud key (or create if first time)
      try {
        // Download key once and reuse — avoids a second Dropbox request that triggers 429
        // NETWORK_ERROR_CHECKING_KEY means transient error — fall back to cache-only mode
        let preloadedKeyDeferred: string | null | undefined;
        try {
          preloadedKeyDeferred = await this.checkCloudHasEncryptionKey();
        } catch (keyCheckErr) {
          if (keyCheckErr instanceof Error && keyCheckErr.message === 'NETWORK_ERROR_CHECKING_KEY') {
            preloadedKeyDeferred = undefined; // undefined = "unknown", not null = "confirmed absent"
          } else {
            throw keyCheckErr;
          }
        }
        const cloudHasKey = !!preloadedKeyDeferred;

        if (cloudHasKey) {
          // Load existing cloud key, passing preloaded data to avoid re-download
          await this.loadMasterKeyFromCloud(effectivePassword, preloadedKeyDeferred);
          if (import.meta.env.DEV) console.log('✅ [onCloudProviderConnected] Cloud key loaded after deferred init');
        } else {
          // Cloud reports no key — but local cache (IndexedDB) may have the correct key
          // (e.g. user switched primary provider or Dropbox/Nextcloud path lookup failed).
          // loadMasterKeyFromCloud checks local cache first; if found, it uploads the key
          // to the new provider in the background and returns successfully.
          // Only generate a brand-new key when NO_CLOUD_KEY is thrown (truly first-time setup).
          try {
            // Pass null so loadMasterKeyFromCloud skips its cloud download loop
            await this.loadMasterKeyFromCloud(effectivePassword, null);
            if (import.meta.env.DEV) console.log('✅ [onCloudProviderConnected] Key loaded from local cache (deferred init)');
            // saveMasterKeyToCloud is already fired in background by loadMasterKeyFromCloud
          } catch (cacheError) {
            if (cacheError instanceof Error && cacheError.message === 'NO_CLOUD_KEY') {
              // Truly first-time setup, or in-memory key may be wrong (e.g. from local generation)
              const inMemoryKeyValid = this.masterKey && await this.trySampleDecrypt();
              if (!this.masterKey || !inMemoryKeyValid) {
                if (this.masterKey && !inMemoryKeyValid && import.meta.env.DEV) {
                  console.log('🔑 [onCloudProviderConnected] In-memory key cannot decrypt entries - trying other providers');
                }
                const otherProviderKey = await this.tryLoadKeyFromOtherProviders();
                if (otherProviderKey) {
                  await this.loadMasterKeyFromCloud(effectivePassword, otherProviderKey);
                } else if (!this.masterKey) {
                  if (await this.hasCloudEncryptedEntries()) {
                    if (import.meta.env.DEV) console.error('❌ BLOCKED: Cloud has encrypted entries but no encryption key — refusing to generate new key');
                    throw new Error('ENTRIES_WITHOUT_KEY');
                  }
                  if (import.meta.env.DEV) console.log('🔑 [onCloudProviderConnected] No cloud key or cache - generating new one');
                  this.masterKey = await generateMasterKey();
                  if (import.meta.env.DEV) {
                    const fp = await getMasterKeyFingerprint(this.masterKey!);
                    console.log('[key-debug] NEW master key generated! fp=' + fp);
                  }
                }
              }
              if (this.masterKey) await this.saveMasterKeyToCloud(effectivePassword);
            } else {
              throw cacheError;
            }
          }
        }
        
        this.isInitialized = true;
        this.notifyMasterKeyListeners();
        
        // Dispatch encryption-initialized now that we have the real key
        window.dispatchEvent(new CustomEvent('encryption-initialized', {
          detail: { hasMasterKey: true }
        }));
        
        // Notify encryption state manager
        const { encryptionStateManager } = await import('@/services/encryptionStateManager');
        encryptionStateManager.notifyStateChanged();
        
        // Continue with sync (fall through to sync logic below)
      } catch (error) {
        if (import.meta.env.DEV) console.error('❌ [onCloudProviderConnected] Failed to complete deferred init:', error);
        
        if (error instanceof Error && error.message === 'DECRYPTION_FAILED') {
          // Wrong password stored - clear and request new password
          this.pendingE2EPassword = null;
          this.initializationState = 'idle';
          return {
            requiresPassword: true,
            reason: 'wrong_password'
          };
        }
        throw error;
      }
    }
    
    if (!e2eMode) {
      // Simple mode - check if cloud has encrypted data
      // NETWORK_ERROR_CHECKING_KEY = transient error; proceed with simple mode
      let cloudHasKeySimple: boolean;
      try {
        cloudHasKeySimple = !!(await this.checkCloudHasEncryptionKey());
      } catch (keyCheckErr) {
        if (keyCheckErr instanceof Error && keyCheckErr.message === 'NETWORK_ERROR_CHECKING_KEY') {
          cloudHasKeySimple = false;
          if (import.meta.env.DEV) console.log('⚠️ Network error checking cloud key in simple mode, proceeding');
        } else {
          throw keyCheckErr;
        }
      }
      if (cloudHasKeySimple) {
        if (import.meta.env.DEV) console.log('⚠️ Cloud has encrypted data but Simple mode selected');
        return { 
          requiresPassword: true, 
          reason: 'cloud_has_encrypted_data' 
        };
      }
      
      // Simple mode - no encryption needed
      if (import.meta.env.DEV) console.log('📝 Simple mode - no encryption, starting sync...');
      this.isInitialized = true;
      await this.performFullSync();
      this.startAutoSync();
      return {};
    }
    
    // E2E mode - check for password and cloud encryption key
    // Use effectivePassword to support deferred initialization
    const passwordToUse = effectivePassword || password;
    if (!passwordToUse) {
      // NETWORK_ERROR_CHECKING_KEY = transient error; either way we need a password
      let cloudHasKeyE2E: boolean;
      try {
        cloudHasKeyE2E = !!(await this.checkCloudHasEncryptionKey());
      } catch (keyCheckErr) {
        if (keyCheckErr instanceof Error && keyCheckErr.message === 'NETWORK_ERROR_CHECKING_KEY') {
          cloudHasKeyE2E = false;
          if (import.meta.env.DEV) console.log('⚠️ Network error checking cloud key in E2E mode without password');
        } else {
          throw keyCheckErr;
        }
      }
      if (cloudHasKeyE2E) {
        // Cloud has encrypted data but no password provided
        return {
          requiresPassword: true,
          reason: 'cloud_has_e2e_data'
        };
      }
      // No cloud key and no password - can't proceed
      return {
        requiresPassword: true,
        reason: 'e2e_mode_requires_password'
      };
    }
    
    // E2E mode with password - proceed with encryption setup
    this.passwordProvided = !!passwordToUse;

    // Save current local key before checking cloud
    const localMasterKey = this.masterKey;

    // Download the encryption key file once and reuse it throughout this function.
    // Avoids a second (and third) Dropbox request that triggers 429 rate-limiting.
    // NETWORK_ERROR_CHECKING_KEY means a transient error (rate limit, CORS, 5xx) —
    // fall back to cache-only mode rather than risking new-key generation.
    let preloadedCloudKey: string | null | undefined;
    try {
      preloadedCloudKey = await this.checkCloudHasEncryptionKey();
    } catch (keyCheckErr) {
      if (keyCheckErr instanceof Error && keyCheckErr.message === 'NETWORK_ERROR_CHECKING_KEY') {
        preloadedCloudKey = undefined; // undefined = "unknown", not null = "confirmed absent"
      } else {
        throw keyCheckErr;
      }
    }
    const cloudHasKey = !!preloadedCloudKey;
    if (cloudHasKey) {
      // Load existing cloud key, passing preloaded data to avoid re-download
      if (import.meta.env.DEV) console.log('🔑 Cloud key exists, loading it...');
      await this.loadMasterKeyFromCloud(passwordToUse, preloadedCloudKey);

      // If we had local entries, re-encrypt them with the cloud key
      if (localMasterKey) {
        await this.reEncryptAllEntries(localMasterKey);
      }
    } else {
      // Cloud reports no key (or network error) — but local cache (IndexedDB) may have
      // the correct key (e.g. user switched primary provider or Dropbox/Nextcloud path
      // lookup failed). loadMasterKeyFromCloud checks local cache first; if found, it
      // uploads the key to the new provider in the background and returns successfully.
      // Only generate a brand-new key when NO_CLOUD_KEY is thrown (truly first-time setup).
      try {
        // preloadedCloudKey is null (confirmed absent) or undefined (network error — let
        // loadMasterKeyFromCloud decide whether to retry the download)
        await this.loadMasterKeyFromCloud(passwordToUse, preloadedCloudKey);
        if (import.meta.env.DEV) console.log('🔑 [onCloudProviderConnected] Key loaded from local cache, uploading to cloud in background');
        // saveMasterKeyToCloud is already fired in background by loadMasterKeyFromCloud
      } catch (cacheError) {
        if (cacheError instanceof Error && cacheError.message === 'NO_CLOUD_KEY') {
          // Truly first-time setup, or in-memory key may be wrong (e.g. from local generation)
          const inMemoryKeyValid = this.masterKey && await this.trySampleDecrypt();
          if (!this.masterKey || !inMemoryKeyValid) {
            if (this.masterKey && !inMemoryKeyValid && import.meta.env.DEV) {
              console.log('🔑 [onCloudProviderConnected] In-memory key cannot decrypt entries - trying other providers');
            }
            const otherProviderKey = await this.tryLoadKeyFromOtherProviders();
            if (otherProviderKey) {
              await this.loadMasterKeyFromCloud(passwordToUse, otherProviderKey);
            } else if (!this.masterKey) {
              if (await this.hasCloudEncryptedEntries()) {
                if (import.meta.env.DEV) console.error('❌ BLOCKED: Cloud has encrypted entries but no encryption key — refusing to generate new key');
                throw new Error('ENTRIES_WITHOUT_KEY');
              }
              if (import.meta.env.DEV) console.log('🔑 Generating new master key...');
              this.masterKey = await generateMasterKey();
              this.notifyMasterKeyListeners();
              if (import.meta.env.DEV) {
                const fp = await getMasterKeyFingerprint(this.masterKey!);
                console.log('[key-debug] NEW master key generated! fp=' + fp);
              }
            }
          } else {
            if (import.meta.env.DEV) console.log('🔑 Using existing in-memory key...');
          }
          if (this.masterKey) await this.saveMasterKeyToCloud(passwordToUse);
        } else {
          throw cacheError;
        }
      }
    }

    // Upload all local entries to cloud (uses current masterKey)
    await this.uploadAllLocalEntries();

    // Notify encryption state manager so UI knows encryption is ready
    const { encryptionStateManager } = await import('@/services/encryptionStateManager');
    encryptionStateManager.notifyStateChanged();

    // CRITICAL: Perform immediate full sync to download existing cloud entries
    // Without this, entries only download when auto-sync triggers later
    if (import.meta.env.DEV) console.log('🔄 Performing initial sync to download cloud entries...');
    await this.performFullSync();
    
    // FIXED: Clean up any duplicate entries that might exist from previous bug
    await this.deduplicateIndexedDB();
    
    if (import.meta.env.DEV) console.log('✅ Initial sync complete, starting auto-sync...');
    
    // CRITICAL: Dispatch entries-changed event so UI reloads after initial sync
    window.dispatchEvent(new CustomEvent('entries-changed'));
    
    // Start automatic sync for subsequent changes
    this.startAutoSync();
    
    return {};
  }

  /**
   * Subscribe to sync status changes
   */
  onStatusChange(listener: (status: SyncStatus, lastSync: Date | null) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to entries changed events (triggered after sync completes)
   */
  onEntriesChanged(listener: () => void): () => void {
    this.entriesChangedListeners.push(listener);
    return () => {
      this.entriesChangedListeners = this.entriesChangedListeners.filter(l => l !== listener);
    };
  }

  private notifyEntriesChanged(): void {
    this.entriesChangedListeners.forEach(listener => listener());
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => listener(this.syncStatus, this.lastSyncTime));
  }
  
  /**
   * Phase 4: Notify conflict listeners when conflicts are detected
   */
  private notifyConflictDetected(latestConflict: ConflictLogEntry): void {
    const conflictCount = conflictLog.length;
    this.conflictListeners.forEach(listener => listener(conflictCount, latestConflict));
  }
  
  /**
   * Phase 4: Register a listener for conflict notifications
   */
  onConflictDetected(callback: (conflictCount: number, latestConflict: ConflictLogEntry) => void): () => void {
    this.conflictListeners.push(callback);
    return () => {
      const index = this.conflictListeners.indexOf(callback);
      if (index > -1) {
        this.conflictListeners.splice(index, 1);
      }
    };
  }

  private async getOrCreateDeviceId(): Promise<string> {
    // FIXED: Use a lock to prevent race conditions when creating device ID
    const LOCK_KEY = 'deviceIdLock';
    const MAX_LOCK_WAIT = 5000; // 5 seconds
    const startTime = Date.now();
    
    // Simple spin-lock with timeout
    while (true) {
      const lock = await getFromIndexedDB('settings', LOCK_KEY);
      if (!lock?.value || Date.now() - lock.value > 1000) {
        // Lock is free or stale, acquire it
        await saveToIndexedDB('settings', { key: LOCK_KEY, value: Date.now() });
        break;
      }
      
      // Check timeout
      if (Date.now() - startTime > MAX_LOCK_WAIT) {
        // Force acquire lock after timeout
        await saveToIndexedDB('settings', { key: LOCK_KEY, value: Date.now() });
        break;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    try {
      // Check again after acquiring lock
      const stored = await getFromIndexedDB('settings', 'deviceId');
      if (stored?.value) {
        return stored.value;
      }

      const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await saveToIndexedDB('settings', { key: 'deviceId', value: newId });
      return newId;
    } finally {
      // Release lock
      await saveToIndexedDB('settings', { key: LOCK_KEY, value: null });
    }
  }

  /**
   * FIXED: Remove any duplicate entries from IndexedDB
   * This can happen if sync had a race condition and downloaded an entry twice
   */
  private async deduplicateIndexedDB(): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(['entries'], 'readwrite');
    const store = transaction.objectStore('entries');

    const request = store.getAll();
    const allEntries: EncryptedEntry[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Group by ID and keep only the entry with the latest updatedAt
    const entriesByIdMap = new Map<string, EncryptedEntry[]>();
    for (const entry of allEntries) {
      const existing = entriesByIdMap.get(entry.id) || [];
      existing.push(entry);
      entriesByIdMap.set(entry.id, existing);
    }

    let deduplicatedCount = 0;
    for (const [id, entries] of entriesByIdMap) {
      if (entries.length > 1) {
        // Sort by updatedAt descending and keep the newest
        entries.sort((a, b) => {
          const aTime = new Date(a.metadata?.updatedAt || a.metadata?.createdAt || 0).getTime();
          const bTime = new Date(b.metadata?.updatedAt || b.metadata?.createdAt || 0).getTime();
          return bTime - aTime;
        });

        const newest = entries[0];
        
        // Clear all entries for this ID
        await new Promise<void>((resolve, reject) => {
          const delRequest = store.delete(id);
          delRequest.onsuccess = () => resolve();
          delRequest.onerror = () => reject(delRequest.error);
        });

        // Re-add only the newest one
        await new Promise<void>((resolve, reject) => {
          const putRequest = store.put(newest);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        });

        deduplicatedCount += entries.length - 1;
        
        if (import.meta.env.DEV) {
          console.log(`🧹 Removed ${entries.length - 1} duplicate(s) for entry ${id}, kept newest version`);
        }
      }
    }

    if (deduplicatedCount > 0 && import.meta.env.DEV) {
      console.log(`🧹 Deduplicated ${deduplicatedCount} total duplicate entries`);
    }
  }

  // ============= PHASE 2: Individual Operation Files (Instant & Race-Free) =============

  /**
   * Generate a unique operation ID with guaranteed uniqueness
   * Uses monotonically increasing timestamps + longer random component
   * Persists last timestamp to survive page reloads
   */
  private async generateOperationId(): Promise<string> {
    const now = Date.now();
    
    // Load persisted timestamp to survive page reloads
    const persisted = await getFromIndexedDB('settings', 'lastOperationTimestamp');
    const persistedTimestamp = persisted?.value || 0;
    
    // Ensure timestamp is always increasing, even within same millisecond and across reloads
    this.lastOperationTimestamp = Math.max(now, this.lastOperationTimestamp, persistedTimestamp) + 1;
    
    // Persist for next reload
    await saveToIndexedDB('settings', { key: 'lastOperationTimestamp', value: this.lastOperationTimestamp });
    
    // Add longer random component (8 chars = 36^8 = 2.8 trillion possibilities)
    const random = Math.random().toString(36).substring(2, 10);
    return `op-${this.deviceId}-${this.lastOperationTimestamp}-${random}`;
  }

  /**
   * Append an operation - writes a single file instantly (no download needed)
   * This is INSTANT and race-free since each operation is a separate file
   */
  private async appendOperationToLog(
    entryId: string,
    type: 'create' | 'update' | 'delete'
  ): Promise<void> {
    const opId = await this.generateOperationId();
    const operation: OperationLogEntry = {
      id: opId,
      entryId,
      type,
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId,
    };

    if (!this.isOnline || !cloudStorageService.getPrimaryProvider()) {
      // Store pending operation locally if offline
      await this.addPendingOperation(operation);
      if (import.meta.env.DEV) console.log(`📝 Queued ${type} operation offline: ${entryId}`);
      return;
    }

    try {
      // INSTANT: Write single operation file (no download needed!)
      await cloudStorageWithRetry.uploadToAll(
        `operations/${opId}.json`,
        JSON.stringify(operation)
      );

      if (import.meta.env.DEV) {
        console.log(`📝 Logged ${type} operation for entry ${entryId} → operations/${opId}.json`);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to write operation file:', error);
      // Store as pending if cloud write fails
      await this.addPendingOperation(operation);
    }
  }

  /**
   * Read state snapshot from cloud (permanent tombstones from compaction).
   * Returns null if file does not exist or parse fails.
   */
  private async readStateSnapshot(): Promise<StateSnapshot | null> {
    try {
      const data = await cloudStorageWithRetry.downloadFromPrimary(STATE_SNAPSHOT_PATH);
      if (!data) return null;
      const parsed = JSON.parse(data) as StateSnapshot;
      if (parsed?.version === 1 && Array.isArray(parsed.deletedEntryIds)) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Write state snapshot to cloud. Overwrites existing; used during compaction.
   */
  private async writeStateSnapshot(snapshot: StateSnapshot): Promise<void> {
    await cloudStorageWithRetry.uploadToAll(STATE_SNAPSHOT_PATH, JSON.stringify(snapshot));
    if (import.meta.env.DEV) {
      console.log(`📸 Wrote state snapshot: ${snapshot.deletedEntryIds.length} tombstones`);
    }
  }

  /**
   * Read all operation files from cloud and build current state
   * Only called during sync, not on every write
   * Optimized with parallel downloads and batch size limits
   */
  private async readOperationLog(): Promise<OperationLogState> {
    try {
      // 1. Read state snapshot first (permanent tombstones from compaction)
      const snapshot = await this.readStateSnapshot();
      const deleted = new Set<string>(snapshot?.deletedEntryIds ?? []);

      // 2. List all operation files and replay incremental ops
      const files = await cloudStorageWithRetry.listFiles('operations');
      const operations: OperationLogEntry[] = [];

      if (files.length > 0) {
        // Download and parse all operations in parallel (batch of 50 at a time to avoid overwhelming the connection)
        const opFiles = files.filter(f => f.name.startsWith('op-') && f.name.endsWith('.json'));
        
        if (import.meta.env.DEV && opFiles.length > 200) {
          console.warn(`⚠️ Large number of operation files (${opFiles.length}). Compaction runs automatically.`);
        }
        
        const batchSize = 50;
        for (let i = 0; i < opFiles.length; i += batchSize) {
          const batch = opFiles.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(
            batch.map(async file => {
              try {
                const data = await cloudStorageWithRetry.downloadFromPrimary(file.path);
                if (!data) return null;
                
                // FIXED: Better error handling for corrupted operation files
                try {
                  return JSON.parse(data);
                } catch (parseError) {
                  // Nextcloud server-side/E2E encryption returns HBEGIN:oc_... instead of JSON
                  if (typeof data === 'string' && data.trim().toLowerCase().startsWith('hbegin:oc_') && cloudStorageService.getPrimaryProvider()?.name === 'Nextcloud') {
                    throw createCloudError(CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT, { file: file.path, provider: 'Nextcloud' });
                  }
                  if (import.meta.env.DEV) {
                    console.error(`Failed to parse operation file ${file.path}:`, parseError);
                  }
                  return null;
                }
              } catch (downloadError) {
                if (getCloudErrorCode(downloadError) === CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT) {
                  throw downloadError;
                }
                if (import.meta.env.DEV) {
                  console.error(`Failed to download operation file ${file.path}:`, downloadError);
                }
                return null;
              }
            })
          );
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              operations.push(result.value);
            } else if (result.status === 'rejected') {
              if (getCloudErrorCode(result.reason) === CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT) {
                throw result.reason;
              }
              if (import.meta.env.DEV) {
                console.warn('Failed to read operation file:', result.reason);
              }
            }
          }
        }
      }

      // Merge local pending operations so offline deletes (and other ops) are included in state
      const pending = await this.getPendingOperations();
      operations.push(...pending);

      // Sort by operation ID (which includes timestamp) for deterministic replay
      operations.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      // Replay operations into state (snapshot already initialized deleted set)
      const lastOperation = new Map<string, OperationLogEntry>();

      for (const op of operations) {
        lastOperation.set(op.entryId, op);
        if (op.type === 'delete') {
          deleted.add(op.entryId);
        } else if (op.type === 'create' || op.type === 'update') {
          deleted.delete(op.entryId);
        }
      }

      if (import.meta.env.DEV) {
        console.log(`📋 Replayed ${operations.length} operations: ${deleted.size} deleted entries${snapshot ? ' (incl. snapshot tombstones)' : ''}`);
      }

      return { deleted, lastOperation };
    } catch (error) {
      if (getCloudErrorCode(error) === CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT) {
        throw error;
      }
      if (import.meta.env.DEV) console.warn('Failed to read operation files:', error);
      return { deleted: new Set(), lastOperation: new Map() };
    }
  }

  /**
   * Compact operation files: fold old ops into state snapshot, then remove old files.
   * Ensures delete information is never lost (snapshot is permanent tombstones).
   */
  private async compactOperationLog(): Promise<void> {
    try {
      const files = await cloudStorageWithRetry.listFiles('operations');
      const retentionCutoff = new Date();
      retentionCutoff.setDate(retentionCutoff.getDate() - ENCRYPTION_CONSTANTS.OPERATION_COMPACTION_DAYS);

      const opFilesToCompact = files.filter(
        f => f.name.startsWith('op-') && f.name.endsWith('.json') && f.modifiedAt
      ).filter(f => {
        const fileDate = new Date(f.modifiedAt!);
        return !isNaN(fileDate.getTime()) && fileDate < retentionCutoff;
      });

      if (opFilesToCompact.length === 0) {
        return;
      }

      // 1. Read existing snapshot and collect deleted IDs from old op files
      const existingSnapshot = await this.readStateSnapshot();
      const tombstoneIds = new Set<string>(existingSnapshot?.deletedEntryIds ?? []);
      let coveredUpTo = existingSnapshot?.coveredUpTo ?? new Date(0).toISOString();
      const filesSuccessfullyRead: typeof opFilesToCompact = [];

      for (const file of opFilesToCompact) {
        try {
          const data = await cloudStorageWithRetry.downloadFromPrimary(file.path);
          if (!data) continue;
          const op = JSON.parse(data) as OperationLogEntry;
          if (op?.type === 'delete' && op.entryId) tombstoneIds.add(op.entryId);
          if (op?.timestamp && op.timestamp > coveredUpTo) coveredUpTo = op.timestamp;
          filesSuccessfullyRead.push(file);
        } catch {
          // Skip unreadable file; do not delete it so next compaction can retry
        }
      }

      // 2. Write updated snapshot (merge into permanent tombstones)
      const snapshot: StateSnapshot = {
        version: 1,
        deletedEntryIds: Array.from(tombstoneIds),
        snapshotTimestamp: new Date().toISOString(),
        coveredUpTo,
        createdBy: this.deviceId,
      };
      await this.writeStateSnapshot(snapshot);

      // 3. Delete only op files we successfully read (safe: their delete info is in snapshot)
      await Promise.allSettled(
        filesSuccessfullyRead.map(f =>
          cloudStorageWithRetry.deleteFromAll(f.path).catch(err => {
            if (import.meta.env.DEV) console.warn(`Failed to delete ${f.name}:`, err);
          })
        )
      );
      if (import.meta.env.DEV && filesSuccessfullyRead.length > 0) {
        console.log(`🗜️ Compacted operations: removed ${filesSuccessfullyRead.length} old files, snapshot has ${tombstoneIds.size} tombstones`);
      }

      // 4. Orphan cleanup: best-effort delete entry files for tombstoned IDs
      for (const id of tombstoneIds) {
        cloudStorageWithRetry.deleteFromAll(`entries/entry-${id}.json`).catch(() => {});
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to compact operation files:', error);
    }
  }

  /**
   * Sync pending operations when coming back online
   * Uploads all queued operations as individual files
   * CRITICAL: Validates encryption state before uploading to prevent corrupted entries
   */
  private async syncPendingOperations(): Promise<void> {
    const pending = await this.getPendingOperations();
    if (pending.length === 0) return;

    // CRITICAL: Don't upload pending ops if encryption state is invalid
    // This prevents uploading entries encrypted with wrong/missing key
    const e2eMode = isE2EEnabled();
    if (e2eMode && !this.masterKey) {
      if (import.meta.env.DEV) {
        console.warn('⚠️ Skipping pending operations sync - no master key in E2E mode');
      }
      // Clear stale pending operations since they can't be properly encrypted
      await this.clearPendingOperations();
      return;
    }

    // Also check if sync is disabled (disconnect in progress)
    if (this.syncDisabled) {
      if (import.meta.env.DEV) {
        console.log('⏭️ Skipping pending operations sync - sync is disabled');
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log(`📤 Syncing ${pending.length} pending operations...`);
    }

    // Upload all pending operations as individual files
    const uploads = pending.map(op =>
      cloudStorageWithRetry.uploadToAll(
        `operations/${op.id}.json`,
        JSON.stringify(op)
      ).catch(error => {
        if (import.meta.env.DEV) console.warn(`Failed to upload ${op.id}:`, error);
      })
    );

    await Promise.allSettled(uploads);
    await this.clearPendingOperations();
    
    if (import.meta.env.DEV) {
      console.log(`✅ Synced ${pending.length} pending operations`);
    }
  }

  // Helper methods for pending operations (stored locally when offline)
  // FIXED: Limit pending operations to prevent unbounded growth
  private async addPendingOperation(op: OperationLogEntry): Promise<void> {
    const MAX_PENDING_OPS = 1000; // Prevent memory issues
    const current = await this.getPendingOperations();
    
    // FIXED: Deduplicate by keeping the LAST (most recent) operation per entryId
    const map = new Map<string, OperationLogEntry>();
    for (const existing of current) {
      map.set(existing.entryId, existing);
    }
    
    // Add/update with new operation (overwrites older operation for same entryId)
    map.set(op.entryId, op);
    
    // Limit size
    const pending = Array.from(map.values());
    if (pending.length > MAX_PENDING_OPS) {
      if (import.meta.env.DEV) {
        console.warn(`⚠️ Pending operations limit reached (${MAX_PENDING_OPS}), removing oldest`);
      }
      // Sort by timestamp and keep most recent
      pending.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      pending.length = MAX_PENDING_OPS;
    }
    
    await saveToIndexedDB('settings', { key: 'pendingOperations', value: pending });
  }

  private async getPendingOperations(): Promise<OperationLogEntry[]> {
    const data = await getFromIndexedDB('settings', 'pendingOperations');
    return data?.value || [];
  }

  private async clearPendingOperations(): Promise<void> {
    await saveToIndexedDB('settings', { key: 'pendingOperations', value: [] });
  }

  // ============= End of Phase 2 Operation Files =============

  /**
   * Check if cloud has an encryption key
   * CRITICAL: Distinguishes between "file not found" (return false) and 
   * "network error" (throw error) to prevent incorrect key generation
   */
  /**
   * Download the cloud encryption key and return its raw string content, or null if absent.
   * Throws NETWORK_ERROR_CHECKING_KEY for transient errors (rate limit, CORS, 5xx) so
   * callers know not to treat a network failure as "no key exists".
   * The returned string is passed directly to loadMasterKeyFromCloud to avoid a second
   * download of the same file (which triggers Dropbox 429 rate-limiting).
   */
  private async checkCloudHasEncryptionKey(): Promise<string | null> {
    try {
      const keyData = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
      return keyData || null;
    } catch (error: any) {
      // Extract error details
      const status = error?.status || error?.response?.status;
      const message = (error?.message || '').toLowerCase();

      // 404 or "not found" = file genuinely doesn't exist
      if (status === 404 || message.includes('not found') || message.includes('not_found') || message.includes('path/not_found')) {
        if (import.meta.env.DEV) console.log('🔍 Encryption key not found in cloud (404)');
        return null;
      }

      // Rate limiting (429) or server errors (5xx) = network issue, should retry
      if (status === 429 || (status >= 500 && status < 600)) {
        if (import.meta.env.DEV) console.error('⚠️ Network error checking encryption key (status ' + status + ')');
        throw new Error('NETWORK_ERROR_CHECKING_KEY');
      }

      // CORS errors or network failures
      if (message.includes('cors') || message.includes('network') || message.includes('fetch') ||
          message.includes('rate_limit') || message.includes('rate limit') || message.includes('429')) {
        if (import.meta.env.DEV) console.error('⚠️ Network/CORS error checking encryption key');
        throw new Error('NETWORK_ERROR_CHECKING_KEY');
      }

      // Unknown error - treat as network issue to be safe (don't generate new key)
      if (import.meta.env.DEV) console.error('⚠️ Unknown error checking encryption key, treating as network error:', error);
      throw new Error('NETWORK_ERROR_CHECKING_KEY');
    }
  }

  /**
   * Try to load encryption-key.json from any other connected provider (not the primary).
   * Used when primary has no key (e.g. newly connected) to avoid generating a new key
   * and breaking decryption of entries encrypted with the key from another provider.
   */
  private async tryLoadKeyFromOtherProviders(): Promise<string | null> {
    const { connectionStateManager } = await import('@/services/connectionStateManager');
    const primaryName = connectionStateManager.getPrimaryProviderName();
    const allProviders = connectionStateManager.getConnectedProviders();

    for (const provider of allProviders) {
      if (provider.name === primaryName) continue;
      try {
        const keyPath = provider.name === 'Dropbox' ? '/encryption-key.json' : '/OwnJournal/encryption-key.json';
        const keyData = await provider.download(keyPath);
        if (keyData) {
          if (import.meta.env.DEV) console.log('[key-debug] Found existing key on', provider.name, ', copying to new primary');
          return keyData;
        }
      } catch {
        // Continue to next provider
      }
    }
    return null;
  }

  /**
   * Load master key from cloud with extended retry for rate limiting
   * Includes local caching with version validation to detect password changes on other devices
   */
  /**
   * Load master key from cloud (or local cache).
   * @param preloadedCloudKeyData - Already-downloaded encryption-key.json content.
   *   Pass the string returned by checkCloudHasEncryptionKey() to avoid a redundant
   *   download (which triggers Dropbox 429 rate-limiting).
   *   Pass null to indicate the caller already confirmed the file doesn't exist.
   *   Omit (undefined) to let this function download it itself.
   */
  private async loadMasterKeyFromCloud(password: string, preloadedCloudKeyData?: string | null): Promise<void> {
    // Try local cache first to reduce cloud requests — unless caller already fetched the cloud key.
    // When preloadedCloudKeyData is provided, cloud is the source of truth (e.g. set E2E locally then connect Google Drive).
    const havePreloadedCloudKey = preloadedCloudKeyData != null;
    let cachedVersion: number | null = null;
    let usedCachedKey = false;

    try {
      const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      // Cache indefinitely - only invalidated by explicit password change. Skip cache when we have cloud key data.
      if (cachedKey && cachedKey.value && !havePreloadedCloudKey) {
        if (import.meta.env.DEV) console.log('🔐 Trying cached encryption key (indefinite cache)');
        try {
          const parsedData = JSON.parse(cachedKey.value);
          cachedVersion = parsedData.version || 1;

          if (parsedData.encryptedKey && parsedData.iv && parsedData.salt) {
            this.masterKey = await decryptMasterKey(
              parsedData.encryptedKey,
              parsedData.salt,
              parsedData.iv,
              password
            );
            this.notifyMasterKeyListeners();
            usedCachedKey = true;
            if (import.meta.env.DEV) {
              console.log('✅ Master key loaded from local cache (version ' + cachedVersion + ')');
              getMasterKeyFingerprint(this.masterKey!).then((fp) => console.log('[key-debug] masterKey fingerprint (from cache):', fp));
            }

            // VALIDATE: Check cloud version matches cached version.
            // Use preloaded data if available to avoid a second download of the same file.
            try {
              const cloudKeyData: string | null = preloadedCloudKeyData !== undefined
                ? preloadedCloudKeyData
                : await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
              if (cloudKeyData) {
                const cloudParsed = JSON.parse(cloudKeyData);
                const cloudVersion = cloudParsed.version || 1;
                if (cloudVersion > cachedVersion) {
                  // Cloud has a higher version. This normally means password was changed on
                  // another device. BUT it could also mean a bug previously uploaded a wrong
                  // key with a higher version number — see [saveKey] log for evidence.
                  if (import.meta.env.DEV) {
                    console.log(`⚠️ Cloud key version ${cloudVersion} > cached version ${cachedVersion} - password changed on another device`);
                  }
                  // Clear the stale cache and re-decrypt with cloud key
                  await this.clearCachedEncryptionKey(true); // force=true since password changed
                  this.masterKey = null;
                  usedCachedKey = false;
                  // Fall through to download from cloud (preloaded data already consumed)
                  preloadedCloudKeyData = cloudKeyData; // reuse for cloud download loop
                } else if (cachedVersion > cloudVersion) {
                  // LOCAL is newer than cloud (offline password change happened)
                  if (import.meta.env.DEV) {
                    console.log(`🔄 Local key version ${cachedVersion} > cloud ${cloudVersion} - checking for pending password change`);
                  }

                  // Check for pending password change flag
                  const pendingChange = await getFromIndexedDB('settings', 'pendingPasswordChange');
                  if (pendingChange?.value === true) {
                    // Upload the new encrypted key to cloud
                    if (import.meta.env.DEV) console.log('⬆️ Syncing offline password change to cloud...');
                    await this.saveMasterKeyToCloud(password);
                    // Clear the pending flag
                    await saveToIndexedDB('settings', { key: 'pendingPasswordChange', value: false });
                    if (import.meta.env.DEV) console.log('✅ Offline password change synced to cloud');
                  }
                  // Cache is valid, we're done
                  return;
                } else {
                  // Versions match - also verify key content (fingerprint) to detect divergence
                  try {
                    const cloudMasterKey = await decryptMasterKey(
                      cloudParsed.encryptedKey,
                      cloudParsed.salt,
                      cloudParsed.iv,
                      password
                    );
                    const cachedFp = await getMasterKeyFingerprint(this.masterKey!);
                    const cloudFp = await getMasterKeyFingerprint(cloudMasterKey);
                    if (cachedFp === cloudFp) {
                      return; // Same key, cache is current
                    }
                    // Fingerprints differ - prefer whichever key can decrypt a sample entry
                    if (import.meta.env.DEV) {
                      console.warn(`⚠️ Key fingerprint mismatch (cached=${cachedFp} cloud=${cloudFp}) - checking which decrypts entries`);
                    }
                    const cachedCanDecrypt = await this.trySampleDecrypt();
                    const cachedKeyRef = this.masterKey;
                    this.masterKey = cloudMasterKey;
                    this.notifyMasterKeyListeners();
                    const cloudCanDecrypt = await this.trySampleDecrypt();
                    if (cachedCanDecrypt && !cloudCanDecrypt) {
                      this.masterKey = cachedKeyRef;
                      this.notifyMasterKeyListeners();
                      if (import.meta.env.DEV) console.log('✅ Cached key decrypts entries; uploading to cloud to heal');
                      this.saveMasterKeyToCloud(password).catch(() => {});
                      return;
                    }
                    if (!cachedCanDecrypt && cloudCanDecrypt) {
                      if (import.meta.env.DEV) console.log('✅ Cloud key decrypts entries; updating local cache');
                      await saveToIndexedDB('settings', {
                        key: 'cachedEncryptionKeyData',
                        value: cloudKeyData,
                        timestamp: Date.now(),
                        version: cloudParsed.version || 1,
                      });
                      return;
                    }
                    if (cloudCanDecrypt) {
                      await saveToIndexedDB('settings', {
                        key: 'cachedEncryptionKeyData',
                        value: cloudKeyData,
                        timestamp: Date.now(),
                        version: cloudParsed.version || 1,
                      });
                      return;
                    }
                    // Neither decrypts - keep cached key
                    this.masterKey = cachedKeyRef;
                    this.notifyMasterKeyListeners();
                    if (import.meta.env.DEV) console.warn('⚠️ Neither key decrypts entries; keeping cached key');
                    return;
                  } catch (fingerprintError) {
                    if (import.meta.env.DEV) console.warn('⚠️ Fingerprint check failed, using cached key:', fingerprintError);
                    return;
                  }
                }
              } else {
              }
            } catch (versionCheckError) {
              // Network error checking version - use cached key but log warning
              if (import.meta.env.DEV) {
                console.warn('⚠️ Could not verify cloud key version, using cached key:', versionCheckError);
              }
              return;
            }
          }
        } catch (cacheDecryptError) {
          if (import.meta.env.DEV) console.warn('⚠️ Cache decryption failed, will try cloud:', cacheDecryptError);
          // Fall through to cloud download
        }
      }
    } catch (cacheError) {
      // Cache read error - continue to cloud download
      if (import.meta.env.DEV) console.log('Cache not available, downloading from cloud');
    }

    // CRITICAL: If we already loaded from local cache (usedCachedKey=true) we must NOT fall
    // through to the cloud-download loop. The only path that clears usedCachedKey is when
    // the cloud has a NEWER version of the key (password changed on another device).
    // A null response from cloud (provider has no key file yet – e.g. user just switched
    // primary from Google Drive to Dropbox) must NOT trigger a new-key generation.
    if (usedCachedKey) {
      // Only upload cached key to cloud if it can decrypt existing entries (or there are none).
      // Prevents overwriting a correct cloud key with a wrong cached key on provider switch.
      const safeToUpload = await this.trySampleDecrypt();
      if (safeToUpload) {
        if (import.meta.env.DEV) console.log('✅ Local cache valid – cloud provider may not have the key yet, uploading in background');
        this.saveMasterKeyToCloud(password).catch(err => {
          if (import.meta.env.DEV) console.warn('⚠️ Background key upload to new cloud provider failed (will retry):', err);
        });
      } else {
        if (import.meta.env.DEV) console.warn('⚠️ Cached key cannot decrypt entries – skipping background upload to avoid overwriting correct cloud key');
      }
      return;
    }

    // If preloadedCloudKeyData === null the caller already confirmed no key exists on cloud.
    // Skip the download loop entirely and throw NO_CLOUD_KEY immediately.
    if (preloadedCloudKeyData === null) {
      if (import.meta.env.DEV) console.log('🔑 No cloud key (preloaded null) and no local cache → NO_CLOUD_KEY');
      throw new Error('NO_CLOUD_KEY');
    }

    // Download from cloud with extended retry.
    // On the first attempt we reuse preloadedCloudKeyData if available (already fetched by
    // checkCloudHasEncryptionKey or by the version-check block above) to avoid a third
    // Dropbox request that would trigger 429 rate-limiting.
    let lastError: any = null;

    for (let attempt = 1; attempt <= ENCRYPTION_CONSTANTS.KEY_DOWNLOAD_MAX_RETRIES; attempt++) {
      try {
        if (import.meta.env.DEV && attempt > 1) {
          console.log(`🔄 Key download attempt ${attempt}/${ENCRYPTION_CONSTANTS.KEY_DOWNLOAD_MAX_RETRIES}`);
        }

        // Use preloaded data on first attempt, then clear so retries actually re-download
        let keyData: string | null;
        if (attempt === 1 && preloadedCloudKeyData) {
          keyData = preloadedCloudKeyData;
          preloadedCloudKeyData = undefined; // consume it
        } else {
          keyData = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
        }
        
        if (keyData) {
          let parsedData: EncryptedKeyData;
          try {
            parsedData = JSON.parse(keyData);
          } catch (parseError) {
            if (import.meta.env.DEV) console.error('Invalid encryption key format - key file is corrupted');
            throw new Error('INCOMPATIBLE_KEY_FORMAT');
          }
          
          // Validate key format
          if (!parsedData.encryptedKey || !parsedData.iv || !parsedData.salt) {
            if (import.meta.env.DEV) console.error('Missing required key fields');
            throw new Error('INCOMPATIBLE_KEY_FORMAT');
          }
          
          try {
            this.masterKey = await decryptMasterKey(
              parsedData.encryptedKey,
              parsedData.salt,
              parsedData.iv,
              password
            );
            this.notifyMasterKeyListeners();
            if (import.meta.env.DEV) {
              const fp = await getMasterKeyFingerprint(this.masterKey!);
              console.log('[key-debug] masterKey fingerprint (from cloud):', fp);
              console.log('[key-debug] key file metadata:', { version: parsedData.version, createdAt: parsedData.createdAt, updatedAt: parsedData.updatedAt });
            }

            // Cache the key data with version for future sessions
            try {
              await saveToIndexedDB('settings', { 
                key: 'cachedEncryptionKeyData', 
                value: keyData,
                timestamp: Date.now(),
                version: parsedData.version || 1
              });
              if (import.meta.env.DEV) console.log('💾 Encryption key cached locally (version ' + (parsedData.version || 1) + ')');
            } catch (cacheWriteError) {
              if (import.meta.env.DEV) console.warn('Failed to cache encryption key:', cacheWriteError);
            }
            
            if (import.meta.env.DEV) console.log('✅ Successfully loaded and decrypted master key from cloud');
            return;
          } catch (decryptError) {
            if (import.meta.env.DEV) console.error('Failed to decrypt master key:', decryptError);
            throw new Error('DECRYPTION_FAILED');
          }
        } else {
          // No key found on primary provider - this means first-time E2E setup
          // Other connected providers are ONLY for data transfer, not key lookup
          throw new Error('NO_CLOUD_KEY');
        }
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on these errors - they need user action
        if (error instanceof Error) {
          if (error.message === 'DECRYPTION_FAILED' || 
              error.message === 'INCOMPATIBLE_KEY_FORMAT' ||
              error.message === 'NO_CLOUD_KEY') {
            throw error;
          }
        }
        
        // Check if this is a rate limit or network error
        const message = (error?.message || '').toLowerCase();
        const isRateLimited = message.includes('429') || message.includes('rate_limit') || 
                             message.includes('rate limit') || message.includes('rate_limited') ||
                             message.includes('cors') || message.includes('network');
        
        if (isRateLimited && attempt < ENCRYPTION_CONSTANTS.KEY_DOWNLOAD_MAX_RETRIES) {
          const delay = ENCRYPTION_CONSTANTS.KEY_DOWNLOAD_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          if (import.meta.env.DEV) {
            console.log(`⏳ Rate limited during key download, waiting ${delay/1000}s before retry (${attempt}/${ENCRYPTION_CONSTANTS.KEY_DOWNLOAD_MAX_RETRIES})`);
          }
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        if (attempt === ENCRYPTION_CONSTANTS.KEY_DOWNLOAD_MAX_RETRIES) {
          throw new Error('MAX_RETRIES_EXCEEDED');
        }
        
        const delay = 2000 * attempt;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    if (lastError) {
      if (import.meta.env.DEV) console.error('loadMasterKeyFromCloud exhausted retries:', lastError);
      
      if (lastError instanceof Error) {
        if (lastError.message === 'INCOMPATIBLE_KEY_FORMAT') {
          throw new Error('Your encryption key is in an incompatible format. Please delete the old OwnJournal folder and reconnect.');
        } else if (lastError.message === 'DECRYPTION_FAILED') {
          const decryptError = new Error('DECRYPTION_FAILED') as Error & { code: string; userMessage: string };
          decryptError.code = 'DECRYPTION_FAILED';
          decryptError.userMessage = 'Failed to decrypt your journal key. Please check your password.';
          throw decryptError;
        } else if (lastError.message === 'NO_CLOUD_KEY') {
          throw lastError;
        } else {
          throw new Error(`Failed to load encryption key: ${lastError.message}`);
        }
      }
      
      throw new Error('Failed to load encryption key: Unknown error');
    }
    
    throw new Error('Failed to load encryption key: No attempts made');
  }

  /**
   * Clear cached encryption key (used when cache is stale or during DELETE)
   * Public so it can be called during dangerous DELETE operations
   * CRITICAL: Will refuse to clear if encrypted entries exist (to prevent data loss)
   * @param force - Set to true to bypass safety check (for explicit password change only)
   */
  public async clearCachedEncryptionKey(force: boolean = false): Promise<void> {
    try {
      // SAFETY CHECK: Don't clear cache if encrypted entries exist
      if (!force) {
        const hasEncrypted = await this.hasEncryptedEntriesInCache();
        if (hasEncrypted) {
          if (import.meta.env.DEV) {
            console.error('❌ CRITICAL: Cannot clear cached encryption key - encrypted entries exist in cache!');
            console.error('   This would cause permanent data loss. Use force=true only for explicit password changes.');
          }
          throw new Error('ENCRYPTED_ENTRIES_EXIST');
        }
      }
      
      await saveToIndexedDB('settings', { key: 'cachedEncryptionKeyData', value: null, timestamp: 0, version: 0 });
      await saveToIndexedDB('settings', { key: 'keyNeedsCloudUpload', value: false });
      if (import.meta.env.DEV) console.log('🗑️ Cleared cached encryption key and upload flag');
    } catch (error) {
      if (error instanceof Error && error.message === 'ENCRYPTED_ENTRIES_EXIST') {
        throw error; // Re-throw safety error
      }
      if (import.meta.env.DEV) console.warn('Failed to clear cached encryption key:', error);
    }
  }

  /**
   * Get the version of the cloud encryption key
   * Returns null if no key exists or on error
   */
  private async getCloudKeyVersion(): Promise<number | null> {
    try {
      const keyData = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
      if (keyData) {
        const parsed = JSON.parse(keyData);
        return parsed.version || 1;
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to get cloud key version:', error);
    }
    return null;
  }

  /**
   * Get the version of the locally cached encryption key
   * Returns null if no cache exists
   */
  private async getLocalKeyVersion(): Promise<number | null> {
    try {
      const cached = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      if (cached && cached.version) {
        return cached.version;
      }
      if (cached && cached.value) {
        const parsed = JSON.parse(cached.value);
        return parsed.version || 1;
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to get local key version:', error);
    }
    return null;
  }

  private async reEncryptAllEntries(oldKey: CryptoKey): Promise<void> {
    if (!this.masterKey) {
      throw new Error('No new master key available for re-encryption');
    }

    if (import.meta.env.DEV) console.log('🔄 Re-encrypting all entries with cloud master key...');
    
    const db = await openDB();
    const transaction = db.transaction(['entries'], 'readwrite');
    const store = transaction.objectStore('entries');
    
    const request = store.getAll();
    const encryptedEntries: EncryptedEntry[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const encryptedEntry of encryptedEntries) {
      try {
        // Decrypt with old key
        const encrypted = base64ToArrayBuffer(encryptedEntry.encryptedData);
        const ivBuffer = base64ToArrayBuffer(encryptedEntry.iv);
        const decrypted = await decryptData(encrypted, oldKey, ivBuffer);
        
        // Re-encrypt with new key
        const { encrypted: newEncrypted, iv: newIv } = await encryptData(decrypted, this.masterKey);
        
        // Update entry
        const updatedEntry: EncryptedEntry = {
          ...encryptedEntry,
          encryptedData: arrayBufferToBase64(newEncrypted),
          iv: arrayBufferToBase64(newIv),
        };
        
        await saveToIndexedDB('entries', updatedEntry);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to re-encrypt entry:', encryptedEntry.id, error);
      }
    }

    if (import.meta.env.DEV) console.log('✅ Re-encryption complete');
  }

  /**
   * Migrate Simple mode entries (unencrypted) to E2E encryption
   * Downloads plain entries from cloud, encrypts them with master key, and re-uploads
   */
  private async migrateSimpleModeEntriesToE2E(): Promise<void> {
    if (!this.masterKey) {
      throw new Error('No master key available for migration');
    }

    if (import.meta.env.DEV) console.log('🔐 Starting Simple→E2E migration...');
    
    try {
      // List all entry files in cloud
      const cloudFiles = await cloudStorageWithRetry.listFiles('entries');
      const entryFiles = cloudFiles.filter(
        f => f.name.startsWith('entry-') && f.name.endsWith('.json')
      );
      
      if (entryFiles.length === 0) {
        if (import.meta.env.DEV) console.log('📝 No entries to migrate');
        return;
      }

      if (import.meta.env.DEV) console.log(`📝 Migrating ${entryFiles.length} entries...`);
      
      let migratedCount = 0;
      let skippedCount = 0;
      
      // Process entries in batches to avoid overwhelming the connection
      const batchSize = 10;
      for (let i = 0; i < entryFiles.length; i += batchSize) {
        const batch = entryFiles.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (file) => {
          try {
            // Download entry
            const data = await cloudStorageWithRetry.downloadFromPrimary(file.path);
            if (!data) return;
            
            const entry = JSON.parse(data) as EncryptedEntry;
            
            // Check if already encrypted (has IV)
            if (entry.iv && entry.iv.length > 0) {
              skippedCount++;
              return; // Already encrypted, skip
            }
            
            // Parse the plain data
            const plainData = JSON.parse(entry.encryptedData);
            
            // Encrypt with master key
            const dataToEncrypt = JSON.stringify({
              title: plainData.title || '',
              body: plainData.body || '',
              images: plainData.images || []
            });
            
            const { encrypted, iv } = await encryptData(dataToEncrypt, this.masterKey!);
            
            // Create encrypted entry
            const encryptedEntry: EncryptedEntry = {
              ...entry,
              encryptedData: arrayBufferToBase64(encrypted),
              iv: arrayBufferToBase64(iv),
            };
            
            // Save to IndexedDB
            await saveToIndexedDB('entries', encryptedEntry);
            
            // Upload to cloud
            await cloudStorageWithRetry.uploadToAll(
              `entries/entry-${entry.id}.json`,
              JSON.stringify(encryptedEntry)
            );
            
            migratedCount++;
          } catch (entryError) {
            if (import.meta.env.DEV) {
              console.warn(`⚠️ Failed to migrate entry ${file.name}:`, entryError);
            }
          }
        }));
      }

      if (import.meta.env.DEV) {
        console.log(`✅ Migration complete: ${migratedCount} migrated, ${skippedCount} already encrypted`);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('❌ Migration failed:', error);
      // Non-fatal - entries will be migrated on next sync
    }
  }

  /**
   * Try to decrypt one encrypted entry with the current master key.
   * Used to validate that we are not about to overwrite a correct cloud key with a wrong key.
   * @returns true if decryption succeeded, or if there are no encrypted entries (first-time setup); false if decryption failed
   */
  private async trySampleDecrypt(): Promise<boolean> {
    if (!this.masterKey) return false;
    try {
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      const request = store.getAll();
      const entries: EncryptedEntry[] = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const encryptedOne = entries.find(e => e.iv && e.iv.length > 0 && e.encryptedData);
      if (!encryptedOne) {
        // No local encrypted entries — check cloud before assuming first-time setup
        const cloudResult = await this.trySampleDecryptFromCloud();
        // null = network error: treat as safe to upload (don't skip background key upload)
        return cloudResult !== false;
      }
      await this.decryptEntry(encryptedOne);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fallback for trySampleDecrypt when local IndexedDB has no entries.
   * Downloads one sample entry from cloud and tries to decrypt it.
   * @returns true if key decrypts entry (or no encrypted entries), false if wrong key, null if network error (caller may retry upload)
   */
  private async trySampleDecryptFromCloud(): Promise<boolean | null> {
    try {
      const provider = cloudStorageService.getPrimaryProvider();
      if (!provider) return true; // No cloud provider = genuinely first-time or offline

      const cloudEntries = await cloudStorageWithRetry.listFiles('entries');
      const entryFiles = cloudEntries.filter((f: any) => f.name.startsWith('entry-') && f.name.endsWith('.json'));
      if (entryFiles.length === 0) return true; // Cloud also empty = first-time setup

      // Try up to 3 entries to handle old/corrupt entries (e.g. entry-2.json) co-existing with valid ones
      const samplesToTry = entryFiles.slice(0, 3);
      for (const sample of samplesToTry) {
        try {
          const sampleData = await cloudStorageWithRetry.downloadFromPrimary(sample.path);
          if (!sampleData) continue;
          const parsed = JSON.parse(sampleData) as EncryptedEntry;
          if (!parsed.iv || parsed.iv.length === 0) return true; // Simple mode entries = safe to proceed
          await this.decryptEntry(parsed);
          return true; // At least one entry decrypts -> key is valid
        } catch (innerError) {
          const innerMsg = (innerError as Error)?.message?.toLowerCase() ?? '';
          const isNetworkError =
            innerMsg.includes('network') || innerMsg.includes('fetch') || innerMsg.includes('timeout') ||
            innerMsg.includes('rate_limit') || innerMsg.includes('429') ||
            /\b5\d{2}\b/.test((innerError as Error)?.message ?? '') || innerMsg.includes('failed to fetch');
          if (isNetworkError) throw innerError; // Let outer catch return null
          continue; // Decrypt failed, try next entry
        }
      }
      return false; // All samples failed to decrypt
    } catch (error) {
      const msg = (error as Error)?.message?.toLowerCase() ?? '';
      const isNetworkError =
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('timeout') ||
        msg.includes('rate_limit') ||
        msg.includes('429') ||
        /\b5\d{2}\b/.test((error as Error)?.message ?? '') ||
        msg.includes('failed to fetch');
      if (isNetworkError) {
        if (import.meta.env.DEV) console.warn('⚠️ trySampleDecryptFromCloud: network error, treating as unknown:', error);
        return null;
      }
      if (import.meta.env.DEV) console.error('❌ trySampleDecryptFromCloud: current key cannot decrypt cloud entries:', error);
      return false;
    }
  }

  /**
   * Quick check: does the cloud have any encrypted entry files?
   * Used as defense-in-depth guard before generating a new master key.
   * Returns true if cloud has encrypted entries, false if empty/simple-mode/no-provider.
   * On network errors, returns true (safe default: don't generate new key).
   */
  private async hasCloudEncryptedEntries(): Promise<boolean> {
    try {
      const provider = cloudStorageService.getPrimaryProvider();
      if (!provider) return false;

      const cloudEntries = await cloudStorageWithRetry.listFiles('entries');
      const entryFiles = cloudEntries.filter((f: any) => f.name.startsWith('entry-') && f.name.endsWith('.json'));
      if (entryFiles.length === 0) return false;

      const sampleData = await cloudStorageWithRetry.downloadFromPrimary(entryFiles[0].path);
      if (!sampleData) return false;

      const parsed = JSON.parse(sampleData);
      return !!(parsed.iv && parsed.iv.length > 0);
    } catch {
      // Network error — assume entries exist to be safe (don't generate new key)
      return true;
    }
  }

  /**
   * Validate that the encryption key on a given provider can decrypt at least one entry.
   * Used after transfer to detect key/entry mismatch (e.g. wrong key was copied).
   * @returns true if the key decrypts a sample entry (or there are no encrypted entries), false if decryption fails
   */
  async validateEncryptionKeyFromProvider(provider: CloudProvider, password: string): Promise<boolean> {
    try {
      const keyPath = '/OwnJournal/encryption-key.json';
      const keyData = await provider.download(keyPath);
      if (!keyData) return false;
      const parsed = JSON.parse(keyData);
      if (!parsed.encryptedKey || !parsed.salt || !parsed.iv) return false;
      const masterKey = await decryptMasterKey(
        parsed.encryptedKey,
        parsed.salt,
        parsed.iv,
        password
      );
      const entries = await provider.listFiles('/OwnJournal/entries');
      const entryFiles = entries.filter((f: CloudFile) => f.name.startsWith('entry-') && f.name.endsWith('.json'));
      if (entryFiles.length === 0) return true; // No entries to validate
      const sampleData = await provider.download(entryFiles[0].path);
      if (!sampleData) return true; // Can't download, assume ok
      const entry = JSON.parse(sampleData) as EncryptedEntry;
      if (!entry.iv || !entry.iv.length || !entry.encryptedData) return true; // Plain entry
      const encrypted = base64ToArrayBuffer(entry.encryptedData);
      const ivBuffer = base64ToArrayBuffer(entry.iv);
      await decryptData(encrypted, masterKey, ivBuffer);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to recover the master key by loading encryption-key.json from each connected provider
   * and testing which key can decrypt entries. Used when all entries fail to decrypt (key mismatch).
   * @returns true if a working key was found and set, false otherwise
   */
  async tryRecoverMasterKeyFromProviders(): Promise<boolean> {
    const { retrievePassword } = await import('@/utils/passwordStorage');
    const password = await retrievePassword();
    if (!password) return false;

    const providers = cloudStorageService.getConnectedProviders();
    if (providers.length === 0) return false;

    const keyPath = '/OwnJournal/encryption-key.json';
    for (const provider of providers) {
      try {
        const keyData = await provider.download(keyPath);
        if (!keyData) continue;
        const parsed = JSON.parse(keyData);
        if (!parsed.encryptedKey || !parsed.salt || !parsed.iv) continue;
        const masterKey = await decryptMasterKey(
          parsed.encryptedKey,
          parsed.salt,
          parsed.iv,
          password
        );
        this.masterKey = masterKey;
        this.notifyMasterKeyListeners();
        const canDecrypt = await this.trySampleDecrypt();
        if (canDecrypt) {
          if (import.meta.env.DEV) console.log(`✅ Recovered master key from provider: ${provider.name}`);
          await saveToIndexedDB('settings', {
            key: 'cachedEncryptionKeyData',
            value: keyData,
            timestamp: Date.now(),
            version: parsed.version || 1,
          });
          return true;
        }
      } catch {
        // Skip this provider, try next
      }
    }
    return false;
  }

  /**
   * Save master key to cloud with versioning
   * If updating an existing key (password change), increment the version
   */
  private async saveMasterKeyToCloud(password: string): Promise<void> {
    if (!this.masterKey) {
      throw new Error('No master key available');
    }

    // Check if provider is connected
    const provider = cloudStorageService.getPrimaryProvider();
    if (!provider) {
      if (import.meta.env.DEV) console.warn('⚠️ No cloud provider connected - caching key locally for later upload');
      // Cache locally even without cloud - will be uploaded when provider connects
      const encrypted = await encryptMasterKey(this.masterKey, password);
      const keyData: EncryptedKeyData = {
        ...encrypted,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveToIndexedDB('settings', { 
        key: 'cachedEncryptionKeyData', 
        value: JSON.stringify(keyData),
        timestamp: Date.now(),
        version: 1
      });
      // Set flag indicating key needs cloud upload
      await saveToIndexedDB('settings', { key: 'keyNeedsCloudUpload', value: true });
      if (import.meta.env.DEV) console.log('💾 Key cached locally, pending cloud upload');
      return;
    }

    if (import.meta.env.DEV) console.log('🔐 saveMasterKeyToCloud: Provider connected:', provider.name);

    // Get existing key data to preserve version and createdAt
    let version = 1;
    let createdAt = new Date().toISOString();
    
    try {
      const existingKeyData = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
      if (existingKeyData) {
        // Before overwriting, validate: can this key decrypt existing entries?
        const sampleOk = await this.trySampleDecrypt();
        if (!sampleOk) {
          if (import.meta.env.DEV) console.error('[saveKey] BLOCKED overwrite: current key cannot decrypt entries');
          return; // Do NOT overwrite - would destroy the correct key
        }
        const parsed = JSON.parse(existingKeyData);
        version = (parsed.version || 0) + 1; // Increment version
        createdAt = parsed.createdAt || createdAt; // Preserve original creation date
        if (import.meta.env.DEV) console.log(`🔑 Updating encryption key, version ${parsed.version || 1} → ${version}`);
      } else {
        if (import.meta.env.DEV) console.log('🔑 Creating first cloud key v1');
      }
    } catch (error) {
      // No existing key, this is first creation
      if (import.meta.env.DEV) console.log('🔑 Creating first encryption key, version 1');
    }

    const encrypted = await encryptMasterKey(this.masterKey, password);
    
    const keyData: EncryptedKeyData = {
      ...encrypted,
      version,
      createdAt,
      updatedAt: new Date().toISOString(),
    };
    
    const keyDataJson = JSON.stringify(keyData);
    
    // CRITICAL FIX: Cache the key FIRST before attempting upload
    // This ensures the key is saved locally even if upload fails or no provider is connected
    try {
      await saveToIndexedDB('settings', { 
        key: 'cachedEncryptionKeyData', 
        value: keyDataJson,
        timestamp: Date.now(),
        version: version
      });
      if (import.meta.env.DEV) console.log('💾 Cached encryption key locally (version', version + ')');
    } catch (cacheError) {
      if (import.meta.env.DEV) console.warn('Failed to cache encryption key locally:', cacheError);
    }
    
    if (import.meta.env.DEV) console.log('🔐 Uploading encryption key to cloud...');
    await cloudStorageWithRetry.uploadToAll('encryption-key.json', keyDataJson);
    if (import.meta.env.DEV) console.log('✅ Encryption key uploaded to cloud');
    
    // VERIFICATION: Ensure the key actually exists in cloud
    // This catches any silent queue/upload failures
    try {
      if (import.meta.env.DEV) console.log('🔍 Verifying encryption key exists in cloud...');
      const verifyKey = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
      if (!verifyKey) {
        if (import.meta.env.DEV) console.error('❌ CRITICAL: Encryption key upload verification failed - key missing!');
        // Retry upload directly via provider (not through cloudStorageWithRetry which may queue)
        if (import.meta.env.DEV) console.log('🔄 Retrying encryption key upload directly...');
        await provider.upload('/OwnJournal/encryption-key.json', keyDataJson);
        
        // Verify again
        const verifyRetry = await provider.download('/OwnJournal/encryption-key.json');
        if (!verifyRetry) {
          throw new Error('Encryption key upload verification failed after retry');
        }
        if (import.meta.env.DEV) console.log('✅ Encryption key verified after direct retry');
      } else {
        if (import.meta.env.DEV) console.log('✅ Encryption key verified in cloud');
      }
    } catch (verifyError) {
      if (import.meta.env.DEV) console.warn('⚠️ Could not verify encryption key upload:', verifyError);
      // Non-fatal: will be fixed on next sync
    }
    
    // Clear the pending upload flag since we successfully uploaded
    try {
      await saveToIndexedDB('settings', { key: 'keyNeedsCloudUpload', value: false });
    } catch (flagError) {
      if (import.meta.env.DEV) console.warn('Failed to clear upload flag:', flagError);
    }
    
    this.cloudKeyProvisioned = true;
  }

  private async uploadAllLocalEntries(): Promise<void> {
    // CRITICAL: Check sync lock - prevents re-upload during disconnect
    if (this.syncDisabled) {
      if (import.meta.env.DEV) console.log('⏭️ uploadAllLocalEntries blocked: syncDisabled flag is set');
      return;
    }
    
    // CRITICAL: Validate encryption state before bulk upload
    const e2eMode = isE2EEnabled();
    if (e2eMode && !this.masterKey) {
      throw new Error('Cannot upload entries: E2E mode requires master key');
    }
    
    const db = await openDB();
    const transaction = db.transaction(['entries'], 'readonly');
    const store = transaction.objectStore('entries');

    const request = store.getAll();
    const encryptedEntries: EncryptedEntry[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Upload each entry
    for (const entry of encryptedEntries) {
      await cloudStorageWithRetry.uploadToAll(
        `entries/entry-${entry.id}.json`,
        JSON.stringify(entry)
      );
    }
  }

  /**
   * Phase 2: Don't sync deletions before each save - too expensive
   * Deletions are handled during getAllEntries() and performFullSync()
   * This keeps saves instant
   */
  /**
   * @deprecated Phase 2: Deletions are now handled during getAllEntries() and performFullSync().
   * This method is a no-op kept only for backward compatibility.
   * Will be removed in a future version.
   */
  async syncDeletionsOnly(): Promise<Set<string>> {
    if (import.meta.env.DEV) {
      console.warn('⚠️ syncDeletionsOnly() is deprecated and does nothing. Deletions are handled during getAllEntries() and performFullSync().');
    }
    return new Set();
  }

  /**
   * Acquire a mutation lock for an entry
   * Ensures only one operation can modify an entry at a time
   */
  private async acquireLock(entryId: string): Promise<void> {
    const existingLock = this.entryLocks.get(entryId);
    
    if (existingLock) {
      if (import.meta.env.DEV) {
        console.log(`🔒 Waiting for lock on entry ${entryId}`);
      }
      // Wait for existing lock to release
      await existingLock.catch(() => {
        // Ignore errors from previous operations
      });
      if (import.meta.env.DEV) {
        console.log(`🔓 Lock released for entry ${entryId}, proceeding`);
      }
    }
  }

  /**
   * Release a mutation lock for an entry
   */
  private releaseLock(entryId: string): void {
    this.entryLocks.delete(entryId);
    
    // Process queued operations
    const queue = this.lockQueue.get(entryId);
    if (queue && queue.length > 0) {
      if (import.meta.env.DEV) {
        console.log(`🔄 Processing ${queue.length} queued operation(s) for entry ${entryId}`);
      }
      const nextOperation = queue.shift();
      if (nextOperation) {
        nextOperation();
      }
      if (queue.length === 0) {
        this.lockQueue.delete(entryId);
      }
    }
  }

  /**
   * Execute an operation with a mutation lock
   */
  private async withLock<T>(entryId: string, operation: () => Promise<T>): Promise<T> {
    await this.acquireLock(entryId);
    
    if (import.meta.env.DEV) {
      console.log(`🔐 Acquired lock for entry ${entryId}`);
    }
    
    const lockPromise = (async () => {
      try {
        return await operation();
      } finally {
        if (import.meta.env.DEV) {
          console.log(`🔓 Releasing lock for entry ${entryId}`);
        }
        this.releaseLock(entryId);
      }
    })();
    
    this.entryLocks.set(entryId, lockPromise.then(() => {}, () => {}));
    
    return lockPromise;
  }

  /**
   * Save a journal entry (encrypts and saves to both local and cloud)
   * Phase 2: No pre-sync needed - operations are instant
   * Phase 4: Adds version vector for conflict detection
   * Phase 5: Adds mutation locking to prevent concurrent modifications
   * Now supports Simple mode (no encryption)
   */
  async saveEntry(entry: JournalEntryData): Promise<void> {
    const e2eMode = isE2EEnabled();
    
    // E2E mode - requires master key
    if (e2eMode && !this.masterKey) {
      throw new Error('Storage service not initialized');
    }

    return this.withLock(entry.id, async () => {
      let encryptedEntry: EncryptedEntry;
      
      // Load AI metadata from local cache if it exists
      const aiMetadata = await aiMetadataService.getMetadata(entry.id);
      
      if (e2eMode && this.masterKey) {
        // E2E mode - encrypt the entry
        const plaintext = JSON.stringify({
          title: entry.title,
          body: entry.body,
          images: entry.images || [],
        });

        const { encrypted, iv } = await encryptData(plaintext, this.masterKey);

        // Phase 4: Update version vector with atomic read-modify-write
        // FIXED: Generate operation ID first for atomicity
        const operationId = await this.generateOperationId();
        
        // Read existing vector
        const existingEntry: EncryptedEntry | undefined = await getFromIndexedDB('entries', entry.id);
        const currentVector: VersionVector = existingEntry?.versionVector || {};
        
        // Use mergeVersionVectors for proper conflict-free merge
        const updatedVector: VersionVector = mergeVersionVectors(currentVector, {
          [this.deviceId]: operationId
        });

        encryptedEntry = {
          id: entry.id,
          encryptedData: arrayBufferToBase64(encrypted),
          iv: arrayBufferToBase64(iv),
          metadata: {
            date: entry.date.toISOString(),
            tags: entry.tags,
            mood: entry.mood,
            activities: entry.activities || [],
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
            aiMetadata: aiMetadata || undefined, // Include AI metadata
          },
          versionVector: updatedVector, // Phase 4
        };
      } else {
        // Simple mode - store as plain JSON
        const operationId = await this.generateOperationId();
        const existingEntry: EncryptedEntry | undefined = await getFromIndexedDB('entries', entry.id);
        const currentVector: VersionVector = existingEntry?.versionVector || {};
        const updatedVector: VersionVector = mergeVersionVectors(currentVector, {
          [this.deviceId]: operationId
        });
        
        encryptedEntry = {
          id: entry.id,
          encryptedData: JSON.stringify({ title: entry.title, body: entry.body, images: entry.images || [] }), // Plain JSON
          iv: '', // No IV in Simple mode
          metadata: {
            date: entry.date.toISOString(),
            tags: entry.tags,
            mood: entry.mood,
            activities: entry.activities || [],
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
            aiMetadata: aiMetadata || undefined, // Include AI metadata
          },
          versionVector: updatedVector,
        };
      }

      // Save to IndexedDB cache
      await saveToIndexedDB('entries', encryptedEntry);

      // Phase 2: Always log as 'update' - simpler and safer across devices
      // The operation log will show the full history anyway
      await this.appendOperationToLog(entry.id, 'update');

      // Upload to cloud immediately if online
      if (this.isOnline && cloudStorageService.getPrimaryProvider()) {
        try {
          await cloudStorageWithRetry.uploadToAll(
            `entries/entry-${entry.id}.json`,
            JSON.stringify(encryptedEntry)
          );
          if (import.meta.env.DEV) console.log('✅ Entry synced to cloud immediately after save');
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to upload entry to cloud:', error);
          // Don't fail the save operation if cloud upload fails
        }
      }
    });
  }

  /**
   * Get a single entry by ID
   * Supports Simple mode (no decryption)
   */
  async getEntry(id: string): Promise<JournalEntryData | null> {
    const e2eMode = isE2EEnabled();
    if (e2eMode && !this.masterKey) {
      // In E2E mode without a master key, return null instead of throwing
      if (import.meta.env.DEV) console.log('⚠️ getEntry: No master key in E2E mode');
      return null;
    }

    const encryptedEntry: EncryptedEntry = await getFromIndexedDB('entries', id);
    if (!encryptedEntry) return null;

    return await this.decryptEntry(encryptedEntry);
  }

  /**
   * Get all entries from local cache
   * Deleted entries are removed from local storage during sync
   * Supports Simple mode (no decryption)
   * 
   * IMPROVED: Tracks decryption failures and dispatches event if entries couldn't be decrypted
   * @param options.skipDecryptionFailureEvent - If true, don't dispatch decryption-failures event (used during recovery to prevent infinite loop)
   */
  async getAllEntries(options?: { skipDecryptionFailureEvent?: boolean }): Promise<JournalEntryData[]> {
    // CRITICAL: Wait for any ongoing initialization to complete
    // This prevents race conditions where getAllEntries is called mid-initialization
    if (this.initializationPromise) {
      if (import.meta.env.DEV) console.log('⏳ getAllEntries waiting for initialization...');
      try {
        await this.initializationPromise;
      } catch (e) {
        // Initialization failed, but we still need to check state
        if (import.meta.env.DEV) console.warn('⚠️ Initialization failed while waiting:', e);
      }
    }
    
    const e2eMode = isE2EEnabled();
    if (e2eMode && !this.masterKey) {
      // In E2E mode without a master key, return empty array instead of throwing
      // This allows the UI to render while waiting for password
      if (import.meta.env.DEV) console.log('⚠️ getAllEntries: No master key in E2E mode, returning empty');
      return [];
    }

    const db = await openDB();
    const transaction = db.transaction(['entries'], 'readonly');
    const store = transaction.objectStore('entries');

    const request = store.getAll();
    const encryptedEntries: EncryptedEntry[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Deduplicate by ID (in case of any IndexedDB corruption)
    const entriesMap = new Map<string, JournalEntryData>();
    let duplicateCount = 0;
    let decryptionFailures = 0;
    const currentFailedIds = new Set<string>();
    
    for (const encryptedEntry of encryptedEntries) {
      try {
        const entry = await this.decryptEntry(encryptedEntry);
        if (entry) {
          if (!entriesMap.has(entry.id)) {
            entriesMap.set(entry.id, entry);
          } else {
            duplicateCount++;
            if (import.meta.env.DEV) {
              console.warn(`⚠️ Duplicate entry detected in IndexedDB: ${entry.id}`);
            }
          }
        }
      } catch (error) {
        decryptionFailures++;
        currentFailedIds.add(encryptedEntry.id);
        if (import.meta.env.DEV) console.error('Failed to decrypt entry:', encryptedEntry.id, error);
      }
    }
    
    if (duplicateCount > 0 && import.meta.env.DEV) {
      console.warn(`⚠️ Found ${duplicateCount} duplicate entries in IndexedDB (kept first occurrence of each)`);
    }
    
    if (decryptionFailures > 0 && !options?.skipDecryptionFailureEvent) {
      if (import.meta.env.DEV) console.warn(`⚠️ ${decryptionFailures} of ${encryptedEntries.length} entries failed to decrypt`);
      this.knownFailedEntryIds = currentFailedIds;
      const isKeyMismatch = decryptionFailures === encryptedEntries.length && encryptedEntries.length > 0;
      window.dispatchEvent(new CustomEvent('decryption-failures', { 
        detail: { 
          count: decryptionFailures, 
          total: encryptedEntries.length,
          decrypted: entriesMap.size,
          isKeyMismatch,
        }
      }));
    } else if (decryptionFailures === 0) {
      this.knownFailedEntryIds.clear();
    }
    
    // NEW: Detect encrypted entries when in Simple mode
    // These are entries with IV that can't be decrypted without E2E mode
    if (!e2eMode && encryptedEntries.length > 0) {
      const encryptedCount = encryptedEntries.filter(e => e.iv && e.iv.length > 0).length;
      if (encryptedCount > 0 && encryptedCount > entriesMap.size) {
        // More encrypted entries than we could display = user needs to switch to E2E mode
        if (import.meta.env.DEV) {
          console.log(`🔐 Detected ${encryptedCount} encrypted entries in Simple mode`);
        }
        window.dispatchEvent(new CustomEvent('encrypted-entries-in-simple-mode', { 
          detail: { 
            encryptedCount,
            displayedCount: entriesMap.size,
            totalCount: encryptedEntries.length
          }
        }));
      }
    }

    const entries = Array.from(entriesMap.values());

    entries.sort((a, b) => {
      const dateA = a.date?.getTime() || 0;
      const dateB = b.date?.getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      const createdA = a.createdAt?.getTime() || 0;
      const createdB = b.createdAt?.getTime() || 0;
      if (createdB !== createdA) return createdB - createdA;
      return b.id.localeCompare(a.id);
    });

    if (import.meta.env.DEV) console.warn(`[getAllEntries] total=${encryptedEntries.length} decrypted=${entries.length} failed=${decryptionFailures} masterKey=${!!this.masterKey}`);

    // Save a lightweight snapshot for instant display on next startup
    if (entries.length > 0) {
      this.saveEntrySnapshot(entries).catch(err => {
        if (import.meta.env.DEV) console.warn('Failed to save entry snapshot:', err);
      });
    }

    return entries;
  }

  /**
   * Save a lightweight snapshot of decrypted entries for instant startup display.
   * Stores only what the Timeline needs: id, title (truncated), date, tags, mood, timestamps.
   * No body or images are cached — minimizes on-device exposure of decrypted content.
   */
  async saveEntrySnapshot(entries: JournalEntryData[]): Promise<void> {
    const snapshot = entries.map(e => ({
      id: e.id,
      title: (e.title || '').slice(0, 100),
      date: e.date?.toISOString() ?? new Date().toISOString(),
      tags: e.tags || [],
      mood: e.mood || 'okay',
      createdAt: e.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: e.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));

    await saveToIndexedDB('settings', {
      key: 'cachedEntrySnapshot',
      value: snapshot,
      savedAt: Date.now(),
    });
  }

  /**
   * Load the cached entry snapshot for instant display on startup.
   * Returns lightweight entries (no body/images) that can be shown immediately
   * before auth and encryption resolve. Returns empty array if no snapshot exists.
   *
   * Handles user-scoping: if called before auth sets the current user ID,
   * temporarily uses the last known user ID to open the correct database.
   */
  async loadEntrySnapshot(): Promise<JournalEntryData[]> {
    try {
      // If no current user is set yet (pre-auth), use the last known user
      // so we open the correct user-scoped IndexedDB (JournalDB_{userId}).
      // We intentionally do NOT reset _currentUserId afterwards — auth will
      // set it to the correct value when it resolves, and resetting it to null
      // here would race with ensureConnections() which checks getCurrentUserId().
      const { getCurrentUserId, setCurrentUserId, getLastUserId } = await import('@/utils/userScope');
      if (!getCurrentUserId()) {
        const lastUser = getLastUserId();
        if (lastUser) {
          setCurrentUserId(lastUser);
        } else {
          return []; // No known user — nothing to show
        }
      }

      const record = await getFromIndexedDB('settings', 'cachedEntrySnapshot');
      if (!record?.value || !Array.isArray(record.value)) return [];

      // Ignore snapshots older than 30 days
      if (record.savedAt && Date.now() - record.savedAt > 30 * 24 * 60 * 60 * 1000) return [];

      return record.value.map((e: any) => ({
        id: e.id,
        title: e.title || '',
        body: '',
        date: new Date(e.date),
        tags: e.tags || [],
        mood: e.mood || 'okay',
        images: [],
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Delete an entry - queue deletion and attempt immediate cloud sync (quick path)
   * Phase 2: Now logs the delete operation
   * Phase 5: Adds mutation locking to prevent concurrent modifications
   */
  async deleteEntry(id: string): Promise<void> {
    // Phase 1 Critical Fix: Check if sync is disabled (disconnect in progress)
    // This prevents deletions during provider disconnect flow
    if (this.syncDisabled) {
      if (import.meta.env.DEV) {
        console.log(`⏭️ Skipping deletion of ${id} - sync is disabled (disconnect in progress)`);
      }
      throw new Error('Cannot delete entries while disconnecting from storage provider');
    }

    return this.withLock(id, async () => {
      // Remove from local cache first (optimistic)
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Phase 2: Log the delete operation to operations.log
      await this.appendOperationToLog(id, 'delete');

      // Best-effort quick sync to cloud (delete file)
      await this.quickSyncDelete(id);
    });
  }

  /**
   * Delete entries from IndexedDB that fail to decrypt with the current master key.
   * Returns the number of entries removed.
   */
  async deleteUnrecoverableEntries(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(['entries'], 'readonly');
    const store = tx.objectStore('entries');
    const allEntries: EncryptedEntry[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const idsToDelete: string[] = [];
    for (const entry of allEntries) {
      try {
        await this.decryptEntry(entry);
      } catch {
        idsToDelete.push(entry.id);
      }
    }

    if (idsToDelete.length === 0) return 0;

    const delTx = db.transaction(['entries'], 'readwrite');
    const delStore = delTx.objectStore('entries');
    for (const id of idsToDelete) {
      delStore.delete(id);
    }
    await new Promise<void>((resolve, reject) => {
      delTx.oncomplete = () => resolve();
      delTx.onerror = () => reject(delTx.error);
    });

    this.knownFailedEntryIds.clear();

    if (import.meta.env.DEV) {
      console.log(`🗑️ Deleted ${idsToDelete.length} unrecoverable entries`);
    }

    window.dispatchEvent(new CustomEvent('entries-changed'));
    return idsToDelete.length;
  }

  /**
   * Progress callback for deletion operations
   */
  onDeletionProgress?: (progress: DeletionProgress) => void;

  /**
   * Delete all entries (with strong warning - this is permanent!)
   * @param onProgress Optional callback to report deletion progress
   */
  async deleteAllEntries(onProgress?: (progress: DeletionProgress) => void): Promise<void> {
    // Phase 1: Local deletion
    onProgress?.({ phase: 'local', current: 0, total: 1 });
    
    // Remove all from local cache
    const db = await openDB();
    const transaction = db.transaction(['entries'], 'readwrite');
    const store = transaction.objectStore('entries');

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    onProgress?.({ phase: 'local', current: 1, total: 1 });

    // Phase 2: Cloud deletion with progress
    await this.deleteAllCloudData(onProgress);
  }

  /**
   * Comprehensive cloud data deletion - covers all possible file locations
   * Handles different folder structures from Google Drive, Dropbox, Nextcloud, etc.
   * Uses DIRECT provider calls to avoid path normalization issues
   * Includes parallel batch deletion and progress callbacks for performance
   * Deduplicates files to prevent redundant deletion attempts (Google Drive returns all files for any path)
   * @param onProgress Optional callback to report deletion progress
   */
  async deleteAllCloudData(onProgress?: (progress: DeletionProgress) => void): Promise<void> {
    // Refresh online state (user may have just returned to tab after backgrounding)
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : this.isOnline;

    let provider = cloudStorageService.getPrimaryProvider();
    if (!provider) {
      // Re-establish connections so we don't skip cloud deletion when tab was backgrounded
      const { connectionStateManager } = await import('@/services/connectionStateManager');
      await connectionStateManager.ensureConnections(this.masterKey ?? null);
      provider = cloudStorageService.getPrimaryProvider();
    }
    if (!provider) {
      if (import.meta.env.DEV) console.log('⏭️ Skipping cloud deletion: no provider connected');
      return;
    }
    // Do not skip based on isOnline: attempt cloud deletion anyway (calls will fail if actually offline)

    if (import.meta.env.DEV) console.log('🗑️ Starting comprehensive cloud data deletion...');

    // All possible paths where files might be stored (varies by provider)
    const pathsToCheck = [
      '/OwnJournal/entries',      // Standard entries location
      '/OwnJournal/analysis',     // Trend analysis location
      '/OwnJournal/operations',   // Operations log location
      '/OwnJournal',              // Root journal folder (some providers put files here)
      '/entries',                 // Legacy Dropbox path
      '/analysis',                // Legacy Dropbox path
      '/operations',              // Legacy operations path
      ''                          // Root level (for encryption-key.json)
    ];

    const BATCH_SIZE = 10; // Delete 10 files in parallel per batch
    const BATCH_DELAY_MS = 100; // Delay between batches (not individual files)
    const MAX_RETRIES = 3;

    // Helper: delete with retry
    const deleteWithRetry = async (filePath: string): Promise<boolean> => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Call provider DIRECTLY with exact path from listFiles
          // This bypasses cloudStorageService.toFullPath() normalization
          await provider.delete(filePath);
          return true;
        } catch (error: any) {
          if (attempt === MAX_RETRIES) {
            if (import.meta.env.DEV) {
              console.warn(`⚠️ Failed to delete ${filePath} after ${MAX_RETRIES} attempts:`, error);
            }
            return false;
          }
          // Wait before retry with exponential backoff
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
        }
      }
      return false;
    };

    // Helper: list files with retry
    const listWithRetry = async (path: string): Promise<CloudFile[]> => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Call provider DIRECTLY to get exact paths as stored
          return await provider.listFiles(path);
        } catch (error) {
          if (attempt === MAX_RETRIES) {
            return []; // Give up silently - path may not exist
          }
          await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
        }
      }
      return [];
    };

    // Collect all files to delete, deduplicating by file name
    // This is critical for Google Drive which returns ALL files regardless of path
    const filesToDelete = new Map<string, CloudFile>();

    for (const path of pathsToCheck) {
      const files = await listWithRetry(path);
      if (import.meta.env.DEV && files.length > 0) {
        console.log(`📂 Found ${files.length} files in ${path || 'root'}`);
      }
      
      for (const file of files) {
        // Delete journal entries, trend analysis, operations, and encryption key
        const shouldDelete = 
          file.name.startsWith('entry-') ||
          file.name.startsWith('trend_analysis') ||
          file.name.startsWith('op-') ||
          file.name === 'encryption-key.json' ||
          file.name === 'operations.log';
        
        // Deduplicate by file name to prevent redundant deletions
        if (shouldDelete && !filesToDelete.has(file.name)) {
          filesToDelete.set(file.name, file);
        }
      }
    }

    const files = [...filesToDelete.values()];
    const total = files.length;

    if (import.meta.env.DEV) {
      console.log(`📋 ${total} unique files to delete`);
    }

    // Report initial cloud deletion progress
    onProgress?.({ phase: 'cloud', current: 0, total });

    // Process in parallel batches for better performance
    let totalDeleted = 0;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      // Delete batch in parallel
      const results = await Promise.all(
        batch.map(file => deleteWithRetry(file.path))
      );
      
      // Count successful deletions
      const batchDeleted = results.filter(Boolean).length;
      totalDeleted += batchDeleted;
      
      if (import.meta.env.DEV) {
        const batchPaths = batch.map(f => f.name).join(', ');
        console.log(`🗑️ Batch deleted (${batchDeleted}/${batch.length}): ${batchPaths}`);
      }
      
      // Report progress
      onProgress?.({ 
        phase: 'cloud', 
        current: Math.min(i + batch.length, total), 
        total,
        currentFile: batch[batch.length - 1]?.name
      });
      
      // Small delay between batches (not individual files) to prevent rate limiting
      if (i + BATCH_SIZE < files.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    if (import.meta.env.DEV) {
      console.log(`✅ Cloud deletion complete: ${totalDeleted}/${total} files deleted`);
    }
  }

  /**
   * Single source of truth for encryption/password state
   * Components should query this instead of checking multiple sources
   * 
   * CRITICAL FIX: Always return the user's SELECTED mode, not operational mode
   * Use isReady and needsPassword to indicate operational status
   */
  getEncryptionState(): {
    mode: 'simple' | 'e2e';
    hasStoredPassword: boolean;
    hasMasterKey: boolean;
    isReady: boolean;
    isInitialized: boolean;
    needsPassword: boolean;
  } {
    // CRITICAL: Read the ACTUAL mode from localStorage - this is the user's INTENT
    const userSelectedMode = isE2EEnabled() ? 'e2e' : 'simple';
    // Use the dedicated utility for consistency across the app
    const storedPassword = hasStoredPasswordUtil();
    const hasMasterKey = this.masterKey !== null;
    
    // CRITICAL: Check for initialization in progress
    // Even if masterKey is set, we're not ready if still initializing
    const stillInitializing = this.initializationPromise !== null;
    
    // Calculate if we're ready to operate in the selected mode
    const isReady = userSelectedMode === 'simple' || 
      (userSelectedMode === 'e2e' && hasMasterKey && this.isInitialized && !stillInitializing);
    
    // Calculate if password is needed
    const needsPassword = userSelectedMode === 'e2e' && !storedPassword && !hasMasterKey;
    
    return {
      mode: userSelectedMode, // ALWAYS return the user's selected mode
      hasStoredPassword: storedPassword,
      hasMasterKey,
      isReady,
      isInitialized: this.isInitialized,
      needsPassword
    };
  }

  /**
   * Check if a sync operation is currently in progress
   * Used by components to prevent mode switches during active sync
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Get consolidated encryption readiness state
   * This is the SINGLE SOURCE OF TRUTH for encryption state checking
   * Components should use this instead of checking multiple flags
   */
  getEncryptionReadiness(): EncryptionReadiness {
    const mode = isE2EEnabled() ? 'e2e' : 'simple';
    
    // Simple mode is always ready (no encryption needed)
    if (mode === 'simple') {
      return this.isInitialized ? EncryptionReadiness.READY : EncryptionReadiness.NOT_INITIALIZED;
    }
    
    // E2E mode checks
    if (!this.isInitialized) {
      return EncryptionReadiness.NOT_INITIALIZED;
    }
    
    if (!this.masterKey) {
      // Check if we have a stored password
      const hasPassword = hasStoredPasswordUtil();
      return hasPassword ? EncryptionReadiness.NEED_CLOUD_KEY : EncryptionReadiness.NEED_PASSWORD;
    }
    
    // We have master key - check for mixed mode entries (async check not done here)
    return EncryptionReadiness.READY;
  }

  /**
   * Async version of encryption readiness check that also checks for mixed mode entries
   * Use this when you need to verify there are no unencrypted entries in E2E mode
   */
  async getEncryptionReadinessAsync(): Promise<{ 
    readiness: EncryptionReadiness; 
    unencryptedCount?: number;
    details?: string;
  }> {
    const basicReadiness = this.getEncryptionReadiness();
    
    // If not ready for basic reasons, return that
    if (basicReadiness !== EncryptionReadiness.READY) {
      return { readiness: basicReadiness };
    }
    
    // In E2E mode, check for unencrypted entries
    if (isE2EEnabled() && this.masterKey) {
      try {
        const unencryptedCount = await this.countUnencryptedEntries();
        if (unencryptedCount > 0) {
          return { 
            readiness: EncryptionReadiness.MIXED_MODE_ENTRIES, 
            unencryptedCount,
            details: `${unencryptedCount} entries need encryption`
          };
        }
      } catch (error) {
        // Network error during check
        return { 
          readiness: EncryptionReadiness.NETWORK_ERROR,
          details: error instanceof Error ? error.message : 'Network error'
        };
      }
    }
    
    return { readiness: EncryptionReadiness.READY };
  }

  /**
   * Count entries that are not encrypted (no IV)
   * Used to detect mixed mode entries that need migration
   */
  private async countUnencryptedEntries(): Promise<number> {
    try {
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      
      const request = store.getAll();
      const entries: EncryptedEntry[] = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return entries.filter(e => !e.iv || e.iv === '').length;
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to count unencrypted entries:', error);
      return 0;
    }
  }

  /**
   * Public method to trigger Simple→E2E migration
   * Returns the count of migrated entries
   */
  async migrateEntriesToE2E(): Promise<{ migrated: number; skipped: number; failed: number }> {
    if (!this.masterKey) {
      throw new Error('Master key required for migration');
    }
    
    if (!isE2EEnabled()) {
      throw new Error('E2E mode must be enabled for migration');
    }

    if (import.meta.env.DEV) console.log('🔐 Starting manual Simple→E2E migration...');
    
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    
    try {
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      
      const request = store.getAll();
      const entries: EncryptedEntry[] = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      for (const entry of entries) {
        // Check if already encrypted
        if (entry.iv && entry.iv.length > 0) {
          skipped++;
          continue;
        }
        
        try {
          // Parse plain data
          const plainData = JSON.parse(entry.encryptedData);
          
          // Encrypt with master key
          const dataToEncrypt = JSON.stringify({
            title: plainData.title || '',
            body: plainData.body || '',
            images: plainData.images || []
          });
          
          const { encrypted, iv } = await encryptData(dataToEncrypt, this.masterKey!);
          
          // Create encrypted entry
          const encryptedEntry: EncryptedEntry = {
            ...entry,
            encryptedData: arrayBufferToBase64(encrypted),
            iv: arrayBufferToBase64(iv),
          };
          
          // Save to IndexedDB
          await saveToIndexedDB('entries', encryptedEntry);
          
          // Upload to cloud if connected
          if (cloudStorageService.getPrimaryProvider()) {
            await cloudStorageWithRetry.uploadToAll(
              `entries/entry-${entry.id}.json`,
              JSON.stringify(encryptedEntry)
            );
          }
          
          migrated++;
        } catch (entryError) {
          if (import.meta.env.DEV) console.warn(`⚠️ Failed to migrate entry ${entry.id}:`, entryError);
          failed++;
        }
      }
      
      if (import.meta.env.DEV) {
        console.log(`✅ Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
      }
      
      return { migrated, skipped, failed };
    } catch (error) {
      if (import.meta.env.DEV) console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate encrypted E2E entries to Simple mode (plaintext)
   * Decrypts all entries and stores them without encryption
   * Returns the count of migrated entries
   */
  async migrateEntriesToSimple(): Promise<{ migrated: number; skipped: number; failed: number }> {
    if (!this.masterKey) {
      throw new Error('Master key required to decrypt entries for migration');
    }

    if (import.meta.env.DEV) console.log('🔓 Starting E2E→Simple migration (decrypting entries)...');
    
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    
    try {
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      
      const request = store.getAll();
      const entries: EncryptedEntry[] = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      for (const entry of entries) {
        // Check if already plaintext (no IV)
        if (!entry.iv || entry.iv.length === 0) {
          skipped++;
          continue;
        }
        
        try {
          // Decrypt the entry
          const decryptedData = await decryptData(
            base64ToArrayBuffer(entry.encryptedData),
            this.masterKey!,
            base64ToArrayBuffer(entry.iv)
          );
          
          const plainData = JSON.parse(decryptedData);
          
          // Create plaintext entry (store as JSON string with no IV)
          const plaintextEntry: EncryptedEntry = {
            ...entry,
            encryptedData: JSON.stringify({
              title: plainData.title || '',
              body: plainData.body || '',
              images: plainData.images || []
            }),
            iv: '', // Empty IV indicates plaintext
          };
          
          // Save to IndexedDB
          await saveToIndexedDB('entries', plaintextEntry);
          
          // Upload to cloud if connected
          if (cloudStorageService.getPrimaryProvider()) {
            await cloudStorageWithRetry.uploadToAll(
              `entries/entry-${entry.id}.json`,
              JSON.stringify(plaintextEntry)
            );
          }
          
          migrated++;
        } catch (entryError) {
          if (import.meta.env.DEV) console.warn(`⚠️ Failed to migrate entry ${entry.id}:`, entryError);
          failed++;
        }
      }
      
      if (import.meta.env.DEV) {
        console.log(`✅ E2E→Simple migration complete: ${migrated} decrypted, ${skipped} skipped, ${failed} failed`);
      }
      
      return { migrated, skipped, failed };
    } catch (error) {
      if (import.meta.env.DEV) console.error('❌ E2E→Simple migration failed:', error);
      throw error;
    }
  }

  /**
   * Get effective encryption mode - single source of truth
   * Returns both the configured mode (what user chose) and functional mode (what's currently working)
   */
  getEffectiveMode(): {
    configured: 'simple' | 'e2e';  // What user explicitly chose (localStorage)
    functional: 'simple' | 'e2e';  // What's actually working right now
    canEncrypt: boolean;           // Can we encrypt new entries
    canDecrypt: boolean;           // Can we decrypt existing E2E entries
    needsPassword: boolean;        // User needs to enter password
    needsCloudKey: boolean;        // Need to download encryption key from cloud
  } {
    const { getEncryptionMode } = require('@/utils/encryptionModeStorage');
    const configured = getEncryptionMode() as 'simple' | 'e2e';
    const storedPassword = hasStoredPasswordUtil();
    const hasMasterKey = this.masterKey !== null;
    
    // Functional mode: E2E only if we have the master key
    const functional = (configured === 'e2e' && hasMasterKey) ? 'e2e' : 'simple';
    
    // Can encrypt: have master key (for E2E) or always true (for simple)
    const canEncrypt = configured === 'simple' || hasMasterKey;
    
    // Can decrypt: can decrypt E2E entries only if we have master key
    const canDecrypt = hasMasterKey || configured === 'simple';
    
    // Need password: E2E mode chosen but no stored password and no master key
    const needsPassword = configured === 'e2e' && !storedPassword && !hasMasterKey;
    
    // Need cloud key: E2E mode with password but no master key yet
    const needsCloudKey = configured === 'e2e' && storedPassword && !hasMasterKey;
    
    return {
      configured,
      functional,
      canEncrypt,
      canDecrypt,
      needsPassword,
      needsCloudKey
    };
  }

  // ============= SYNC PROGRESS TRACKING =============

  /**
   * Save sync progress to IndexedDB for resumable syncs
   */
  private async saveSyncProgress(progress: SyncProgress): Promise<void> {
    try {
      await saveToIndexedDB('settings', { 
        key: 'syncProgress', 
        value: JSON.stringify(progress),
        timestamp: Date.now()
      });
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to save sync progress:', error);
    }
  }

  /**
   * Get incomplete sync progress if any
   */
  async getIncompleteSyncProgress(): Promise<SyncProgress | null> {
    try {
      const stored = await getFromIndexedDB('settings', 'syncProgress');
      if (stored && stored.value) {
        const progress: SyncProgress = JSON.parse(stored.value);
        if (!progress.completed) {
          return progress;
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to get sync progress:', error);
    }
    return null;
  }

  /**
   * Clear sync progress after successful completion
   */
  private async clearSyncProgress(): Promise<void> {
    try {
      await saveToIndexedDB('settings', { 
        key: 'syncProgress', 
        value: null,
        timestamp: 0
      });
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to clear sync progress:', error);
    }
  }

  /**
   * Resume an incomplete sync
   * Returns true if sync was resumed and completed, false if nothing to resume
   */
  async resumeIncompleteSync(): Promise<boolean> {
    const progress = await this.getIncompleteSyncProgress();
    
    if (!progress) {
      return false;
    }
    
    if (import.meta.env.DEV) {
      console.log(`🔄 Resuming incomplete sync from ${progress.startedAt}`);
      console.log(`   Processed: ${progress.processedEntries.length}/${progress.totalEntries}`);
      console.log(`   Failed: ${progress.failedEntries.length}`);
    }
    
    // Mark that we're resuming, then do a full sync
    // The sync will check for already-processed entries
    try {
      await this.performFullSync();
      await this.clearSyncProgress();
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to resume sync:', error);
      return false;
    }
  }

  /**
   * Change encryption password - re-encrypt the SAME master key with new password
   * The master key itself never changes, only the password that protects it.
   * This ensures all devices can decrypt entries with the new password.
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (import.meta.env.DEV) console.log('🔐 Starting password change...');

    const hasCloudProvider = cloudStorageService.getPrimaryProvider() !== null;
    const currentMasterKey = this.masterKey; // Save current key as backup

    // 1. Validate old password - try cache first (works offline), then cloud
    if (import.meta.env.DEV) console.log('📥 Validating old password...');
    let keyValidated = false;

    // 1a. Try to validate from local cache first (works when disconnected)
    try {
      const cachedKey = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
      if (cachedKey?.value) {
        const parsedData = JSON.parse(cachedKey.value);
        if (parsedData.encryptedKey && parsedData.iv && parsedData.salt) {
          // Try decrypting with old password - if it fails, password is wrong
          this.masterKey = await decryptMasterKey(
            parsedData.encryptedKey,
            parsedData.salt,
            parsedData.iv,
            oldPassword
          );
          keyValidated = true;
          if (import.meta.env.DEV) console.log('✅ Old password validated via local cache');
        }
      }
    } catch (cacheError) {
      if (import.meta.env.DEV) console.log('⚠️ Cache validation failed:', cacheError);
      // Cache validation failed, will try cloud next if available
    }

    // 1b. If cache validation failed and cloud is available, try cloud
    if (!keyValidated && hasCloudProvider) {
      try {
        await this.loadMasterKeyFromCloud(oldPassword);
        keyValidated = true;
        if (import.meta.env.DEV) console.log('✅ Old password validated via cloud');
      } catch (error) {
        // Cloud validation also failed
        if (import.meta.env.DEV) console.log('⚠️ Cloud validation failed:', error);
      }
    }

    // 1c. Last resort: if the master key is already in memory the user has already
    // authenticated this session (entered their password to unlock the journal).
    // The local cache may simply be absent (e.g. after a full data clear followed by
    // re-login without cloud sync completing). Use the in-memory key directly.
    if (!keyValidated && currentMasterKey) {
      keyValidated = true;
      this.masterKey = currentMasterKey;
      if (import.meta.env.DEV) console.log('⚠️ Cache/cloud validation unavailable – using in-memory master key (user already authenticated this session)');
    }

    // If still not validated, old password is genuinely incorrect.
    if (!keyValidated) {
      this.masterKey = currentMasterKey;
      throw new Error('Old password is incorrect.');
    }
    
    if (!this.masterKey) {
      this.masterKey = currentMasterKey;
      throw new Error('Failed to load encryption key');
    }

    // 2. Validate we can decrypt at least one entry (if any exist)
    if (import.meta.env.DEV) console.log('🔍 Validating master key can decrypt entries...');
    try {
      const testEntries = await this.getAllEntries();
      if (testEntries.length > 0) {
        if (import.meta.env.DEV) console.log(`✅ Validated master key (decrypted ${testEntries.length} entries)`);
      }
    } catch (error) {
      this.masterKey = currentMasterKey;
      throw new Error('Failed to decrypt entries. Password may be incorrect.');
    }

    // 3. CRITICAL: Validate the new password works BEFORE committing
    // Test that we can re-encrypt and re-decrypt the master key with new password
    if (import.meta.env.DEV) console.log('🔐 Validating new password encryption...');
    try {
      const testEncrypted = await encryptMasterKey(this.masterKey, newPassword);
      const testDecrypted = await decryptMasterKey(
        testEncrypted.encryptedKey,
        testEncrypted.salt,
        testEncrypted.iv,
        newPassword
      );
      
      if (!testDecrypted) {
        throw new Error('Password validation failed');
      }
      if (import.meta.env.DEV) console.log('✅ New password validated successfully');
    } catch (validationError) {
      this.masterKey = currentMasterKey;
      throw new Error('Password change failed: Could not verify new password encryption');
    }

    // 4. Re-encrypt the SAME master key with the new password
    // This is the key fix: we keep the same master key, just change the password wrapper
    if (import.meta.env.DEV) console.log('🔐 Re-encrypting master key with new password...');
    
    if (hasCloudProvider) {
      // Save to cloud (which also caches locally)
      await this.saveMasterKeyToCloud(newPassword);
    } else {
      // Offline: save to cache only, mark for cloud sync later
      const encryptedData = await encryptMasterKey(this.masterKey, newPassword);
      const keyDataWithVersion = {
        encryptedKey: encryptedData.encryptedKey,
        salt: encryptedData.salt,
        iv: encryptedData.iv,
        version: Date.now() // Use timestamp as version for conflict detection
      };
      await saveToIndexedDB('settings', { 
        key: 'cachedEncryptionKeyData', 
        value: JSON.stringify(keyDataWithVersion),
        timestamp: Date.now(),
        version: keyDataWithVersion.version
      });
      // Mark that cloud needs to be updated when reconnected
      await saveToIndexedDB('settings', { key: 'pendingPasswordChange', value: true });
      if (import.meta.env.DEV) console.log('💾 Password changed locally - pending cloud sync when reconnected');
    }
    
    this.passwordProvided = true;
    this.cloudKeyProvisioned = true;

    // 5. Update stored password - always store if user had password cached before
    // This ensures the local cache stays in sync with the cloud
    const { storePassword } = await import('@/utils/passwordStorage');
    // Always update the stored password to keep cache in sync with cloud
    await storePassword(newPassword);
    if (import.meta.env.DEV) console.log('💾 Updated stored password (cache synced)');

    if (import.meta.env.DEV) console.log('✅ Password changed successfully - master key preserved');
  }


  private async decryptEntry(encryptedEntry: EncryptedEntry): Promise<JournalEntryData> {
    const e2eMode = isE2EEnabled();
    
    let title: string;
    let body: string;
    let images: string[] = [];
    
    // Check if entry has IV (indicates encrypted data)
    const entryIsEncrypted = encryptedEntry.iv && encryptedEntry.iv.length > 0;
    
    if (entryIsEncrypted) {
      // Entry is encrypted - need master key to decrypt
      if (!this.masterKey) {
        throw new Error('Master key required to decrypt E2E encrypted entry. Please enter your encryption password.');
      }
      if (import.meta.env.DEV && !this.keyDebugDecryptEntryLogged) {
        this.keyDebugDecryptEntryLogged = true;
        const providerName = cloudStorageService.getPrimaryProvider()?.name ?? 'unknown';
        getMasterKeyFingerprint(this.masterKey).then((fp) =>
          console.log('[key-debug] decryptEntry (first): masterKey fp=' + fp + ', provider=' + providerName + ', ivLen=' + (encryptedEntry.iv?.length ?? 0) + ', dataLen=' + (encryptedEntry.encryptedData?.length ?? 0))
        );
      }

      const encrypted = base64ToArrayBuffer(encryptedEntry.encryptedData);
      const ivBuffer = base64ToArrayBuffer(encryptedEntry.iv);

      try {
        const decrypted = await decryptData(encrypted, this.masterKey, ivBuffer);
        const parsed = JSON.parse(decrypted);
        title = parsed.title;
        body = parsed.body;
        images = parsed.images || [];
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to decrypt entry:', encryptedEntry.id, error);
        if (import.meta.env.DEV && !this.decryptDebugFirstFailureLogged) {
          this.decryptDebugFirstFailureLogged = true;
          let dataBase64Valid = false;
          let ivBase64Valid = false;
          try {
            if (encryptedEntry.encryptedData) atob(encryptedEntry.encryptedData);
            dataBase64Valid = true;
          } catch (_) {}
          try {
            if (encryptedEntry.iv) atob(encryptedEntry.iv);
            ivBase64Valid = true;
          } catch (_) {}
          console.log(
            '[decrypt-debug] first failure entryId=' + encryptedEntry.id + ' ivLen=' + (encryptedEntry.iv?.length ?? 0) + ' dataLen=' + (encryptedEntry.encryptedData?.length ?? 0) + ' ivPreview=' + (encryptedEntry.iv ?? '').substring(0, 20) + ' dataPreview=' + (encryptedEntry.encryptedData ?? '').substring(0, 40) + ' dataBase64Valid=' + dataBase64Valid + ' ivBase64Valid=' + ivBase64Valid
          );
        }
        throw new Error('Failed to decrypt entry. Please check your encryption password.');
      }
    } else {
      // Entry is plain JSON (Simple mode or unencrypted)
      try {
        const parsed = JSON.parse(encryptedEntry.encryptedData);
        title = parsed.title || '';
        body = parsed.body || '';
        images = parsed.images || [];
      } catch (error) {
        // Fallback for corrupted data
        title = 'Corrupted Entry';
        body = 'Unable to read entry data';
      }
    }

    // Restore AI metadata to local cache if present in entry
    if (encryptedEntry.metadata.aiMetadata) {
      await aiMetadataService.setMetadata(encryptedEntry.id, encryptedEntry.metadata.aiMetadata).catch(err => {
        if (import.meta.env.DEV) console.warn('Failed to restore AI metadata:', err);
      });
    }

    return {
      id: encryptedEntry.id,
      title,
      body,
      images,
      date: new Date(encryptedEntry.metadata.date),
      tags: encryptedEntry.metadata.tags,
      mood: encryptedEntry.metadata.mood as any,
      activities: encryptedEntry.metadata.activities || [],
      createdAt: new Date(encryptedEntry.metadata.createdAt),
      updatedAt: new Date(encryptedEntry.metadata.updatedAt),
    };
  }

  /**
   * Perform a full bidirectional sync
   * Includes password change detection for multi-device scenarios
   */
  async performFullSync(): Promise<void> {
    // CRITICAL: Check sync lock first - prevents sync during disconnect flow
    if (this.syncDisabled) {
      if (import.meta.env.DEV) console.log('⏭️ Sync blocked: syncDisabled flag is set (disconnect in progress)');
      return;
    }
    
    // Prevent concurrent syncs - queue one request to run after current sync completes
    if (this.isSyncing) {
      if (import.meta.env.DEV) console.log('⏭️ Sync already in progress, queueing request...');
      this.pendingSyncRequest = true;
      return;
    }

    // IMMEDIATE visual feedback - show syncing status BEFORE any network calls
    // This ensures users see responsiveness even during E2E key verification
    this.isSyncing = true;
    this.syncStatus = 'syncing';
    this.notifyStatusListeners();
    this.currentProgress = {
      phase: 'preparing',
      filesProcessed: 0,
      totalFiles: 0,
      percentComplete: 0,
      message: 'Connecting to cloud...'
    };
    this.notifyProgressListeners(this.currentProgress);
    // Align with browser when user explicitly triggered sync (e.g. after leaving airplane mode)
    if (navigator.onLine) this.isOnline = true;
    
    // Enable bulk sync mode for primary provider EARLY (faster reads/writes during sync)
    const primaryProvider = cloudStorageService.getPrimaryProvider();
    if (primaryProvider && 'setBulkSyncMode' in primaryProvider) {
      (primaryProvider as any).setBulkSyncMode(true);
    }

    // Validate preconditions based on encryption mode
    const e2eMode = isE2EEnabled();
    
    // Variable to cache key data for reuse (avoid redundant downloads)
    let cachedCloudKeyData: string | null = null;
    
    if (e2eMode) {
      // E2E mode - requires master key and password
      if (!this.masterKey) {
        this.isSyncing = false;
        this.syncStatus = 'idle';
        this.notifyStatusListeners();
        if (import.meta.env.DEV) console.log('⏸️ Sync skipped: No encryption password set (E2E mode)');
        return;
      }
      if (!this.passwordProvided && !this.cloudKeyProvisioned) {
        this.isSyncing = false;
        this.syncStatus = 'idle';
        this.notifyStatusListeners();
        if (import.meta.env.DEV) console.log('⏸️ Sync skipped: Password not provided for this session');
        return;
      }
      
      // Update progress during E2E verification
      this.updateProgress('preparing', 0, 0, 2, 'syncProgress.verifyingEncryption');
      
      // CHECK FOR PENDING PASSWORD CHANGE (offline password change needs to sync to cloud)
      try {
        const pendingChange = await getFromIndexedDB('settings', 'pendingPasswordChange');
        if (pendingChange?.value === true) {
          if (import.meta.env.DEV) console.log('🔐 Found pending password change, syncing to cloud...');
          const { retrievePassword } = await import('@/utils/passwordStorage');
          const currentPassword = await retrievePassword();
          if (currentPassword && this.masterKey) {
            await this.saveMasterKeyToCloud(currentPassword);
            await saveToIndexedDB('settings', { key: 'pendingPasswordChange', value: null });
            if (import.meta.env.DEV) console.log('✅ Pending password change synced to cloud');
          }
        }
      } catch (pendingSyncError) {
        // Non-fatal: will retry on next sync
        if (import.meta.env.DEV) console.warn('⚠️ Could not sync pending password change:', pendingSyncError);
      }
      
      // CRITICAL FIX: Check if encryption key exists in cloud, upload from cache if missing
      // This handles the case where key was cached locally but never uploaded (e.g., after DELETE + E2E setup)
      try {
        cachedCloudKeyData = await cloudStorageWithRetry.downloadFromPrimary('encryption-key.json');
        if (!cachedCloudKeyData) {
          if (import.meta.env.DEV) console.log('⚠️ E2E key missing from cloud during sync - checking for cached key...');
          const cached = await getFromIndexedDB('settings', 'cachedEncryptionKeyData');
          if (cached?.value) {
            if (import.meta.env.DEV) console.log('🔐 Found cached key, uploading to cloud...');
            // Upload directly via provider to bypass any queue issues
            const provider = cloudStorageService.getPrimaryProvider();
            if (provider) {
              await provider.upload('/OwnJournal/encryption-key.json', cached.value);
              // Verify upload
              const verify = await provider.download('/OwnJournal/encryption-key.json');
              if (verify) {
                if (import.meta.env.DEV) console.log('✅ E2E key restored to cloud and verified');
                // Clear the pending upload flag
                await saveToIndexedDB('settings', { key: 'keyNeedsCloudUpload', value: false });
                cachedCloudKeyData = verify; // Cache the verified key
              } else {
                if (import.meta.env.DEV) console.error('❌ Failed to verify E2E key upload during sync');
              }
            }
          } else {
            // No cached key, but we have master key - re-encrypt and upload
            if (this.masterKey) {
              if (import.meta.env.DEV) console.log('🔐 No cached key but master key exists - re-encrypting for upload...');
              try {
                const { retrievePassword } = await import('@/utils/passwordStorage');
                const password = await retrievePassword();
                if (password) {
                  await this.saveMasterKeyToCloud(password);
                  if (import.meta.env.DEV) console.log('✅ E2E key re-encrypted and uploaded to cloud');
                } else {
                  if (import.meta.env.DEV) console.warn('⚠️ E2E mode active but no password available to encrypt key');
                }
              } catch (reEncryptError) {
                if (import.meta.env.DEV) console.error('❌ Failed to re-encrypt master key for cloud:', reEncryptError);
              }
            } else {
              if (import.meta.env.DEV) console.warn('⚠️ E2E mode active but no master key or cached key available');
            }
          }
        }
      } catch (keyCheckError) {
        // Non-fatal: will retry on next sync
        if (import.meta.env.DEV) console.warn('⚠️ Could not verify/upload E2E key during sync:', keyCheckError);
      }
      
      // CHECK FOR PASSWORD CHANGE ON ANOTHER DEVICE
      // Compare cloud key version with local cached version
      // OPTIMIZATION: Use cached key data from previous download instead of re-downloading
      try {
        let cloudVersion: number | null = null;
        if (cachedCloudKeyData) {
          // Parse version from already-downloaded key data
          try {
            const parsed = JSON.parse(cachedCloudKeyData);
            cloudVersion = parsed.version || 1;
          } catch {
            cloudVersion = 1;
          }
        } else {
          // Fallback to download (shouldn't happen if key exists)
          cloudVersion = await this.getCloudKeyVersion();
        }
        const localVersion = await this.getLocalKeyVersion();
        
        if (cloudVersion !== null && localVersion !== null && cloudVersion > localVersion) {
          if (import.meta.env.DEV) {
            console.log(`⚠️ Cloud key version ${cloudVersion} > local version ${localVersion} - password changed on another device`);
          }
          // Clear the stale master key and request password re-entry
          await this.clearCachedEncryptionKey();
          this.masterKey = null;
          this.isInitialized = false;
          this.notifyMasterKeyListeners();
          
          // Dispatch event to prompt user for password
          window.dispatchEvent(new CustomEvent('require-password', {
            detail: { reason: 'PASSWORD_CHANGED_ON_OTHER_DEVICE' }
          }));
          
          this.isSyncing = false;
          this.syncStatus = 'idle';
          this.notifyStatusListeners();
          return;
        }
      } catch (versionCheckError) {
        // Network error - log but continue with sync
        if (import.meta.env.DEV) {
          console.warn('⚠️ Could not check key version (network error), continuing with sync');
        }
      }
    } else {
      // Simple mode - ensure initialized (no master key needed)
      if (!this.isInitialized) {
        await this.initialize();
      }
    }
    
    if (!cloudStorageService.getPrimaryProvider()) {
      const { connectionStateManager } = await import('@/services/connectionStateManager');
      await connectionStateManager.ensureConnections(this.masterKey ?? null);
    }
    // Defensive wait/retry: provider may be registered in same tick (e.g. after trigger-sync)
    const PRIMARY_WAIT_MS = 150;
    const PRIMARY_RETRIES = 2;
    for (let attempt = 0; attempt <= PRIMARY_RETRIES && !cloudStorageService.getPrimaryProvider(); attempt++) {
      if (attempt > 0) {
        if (import.meta.env.DEV) console.log(`⏳ No primary provider yet, waiting ${PRIMARY_WAIT_MS}ms (attempt ${attempt + 1}/${PRIMARY_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, PRIMARY_WAIT_MS));
        const { connectionStateManager } = await import('@/services/connectionStateManager');
        await connectionStateManager.ensureConnections(this.masterKey ?? null);
      }
    }
    if (!cloudStorageService.getPrimaryProvider()) {
      this.isSyncing = false;
      this.syncStatus = 'idle';
      this.notifyStatusListeners();
      if (import.meta.env.DEV) console.log('⏸️ Sync skipped: No cloud storage provider connected');
      return;
    }
    // Align with browser in case 'online' event fired late (e.g. after leaving airplane mode)
    if (navigator.onLine) this.isOnline = true;
    if (!this.isOnline) {
      this.isSyncing = false;
      this.syncStatus = 'offline';
      this.notifyStatusListeners();
      if (import.meta.env.DEV) console.log('⏸️ Sync skipped: Device is offline');
      return;
    }

    // Track sync start time to avoid stale timeout resets
    const syncStartTime = Date.now();
    
    // Check for incomplete previous sync (quick local check, no network)
    const previousProgress = await this.getIncompleteSyncProgress();
    if (previousProgress && !previousProgress.completed) {
      if (import.meta.env.DEV) {
        console.log(`🔄 Found incomplete sync from ${previousProgress.startedAt}`);
        console.log(`   Processed: ${previousProgress.processedEntries.length}/${previousProgress.totalEntries}`);
        console.log(`   Failed: ${previousProgress.failedEntries.length}`);
      }
      // Clear stale progress and continue with fresh sync
      await this.clearSyncProgress();
    }
    
    if (import.meta.env.DEV) console.log('🔄 Starting full sync...');

    try {
      // 0. Auto-provision: create missing folders/files on first sync (returns cached sync-state)
      if (import.meta.env.DEV) console.log('🏗️ Ensuring cloud structure exists...');
      this.updateProgress('preparing', 0, 0, 5, 'syncProgress.settingUpStructure');
      const cachedSyncState = await this.autoProvisionCloudStructure();

      // 1-3. PARALLELIZED: Run independent operations simultaneously for speed
      this.updateProgress('checking-cloud', 0, 0, 10, 'syncProgress.gatheringData');
      const syncDebug = import.meta.env.DEV;
      if (import.meta.env.DEV) {
        console.log('📊 Fetching sync state, operations, and cloud files in parallel...');
      }
      if (syncDebug) {
        const primary = cloudStorageService.getPrimaryProvider();
        console.log(`[sync-debug] primary provider: ${primary?.name ?? 'none'}`);
      }

      // Use cached sync-state if available to avoid redundant download
      const [syncState, opState, allCloudFiles, localEntries] = await Promise.all([
        cachedSyncState ? this.parseSyncState(cachedSyncState) : this.getSyncState(),
        this.readOperationLog(),
        cloudStorageWithRetry.listFiles('entries'),
        this.getAllEntriesRaw()
      ]);
      
      const deletedIds = opState.deleted;
      
      // Filter to entry files only for accurate progress display
      const cloudFiles = allCloudFiles.filter(
        file => file.name.startsWith('entry-') && file.name.endsWith('.json')
      );
      
      if (import.meta.env.DEV) {
        console.log(`✅ Parallel fetch complete: ${cloudFiles.length} cloud entries (${allCloudFiles.length} total files), ${localEntries.size} local entries`);
      }
      if (syncDebug && cloudFiles.length === 0) {
        console.log(`[sync-debug] listFiles('entries') returned 0 entry files (total files: ${allCloudFiles.length})`);
      }

      // Update progress with entry counts (not all files)
      const totalFiles = cloudFiles.length + localEntries.size;
      this.updateProgress('checking-cloud', 0, totalFiles, 20, 'syncProgress.foundEntries');

      // 4. Sync pending operations (can't parallelize - needs op state)
      if (import.meta.env.DEV) console.log('📝 Syncing pending operations...');
      this.updateProgress('uploading', 0, totalFiles, 25, 'syncProgress.syncingOperations');
      await this.syncPendingOperations();

      // 5. Compare and sync (main work)
      if (import.meta.env.DEV) console.log('🔀 Reconciling entries...');
      this.updateProgress('downloading', 0, 0, 30, 'syncProgress.reconcilingEntries');
      await this.reconcileEntriesWithProgress(cloudFiles, localEntries, syncState, deletedIds, totalFiles);

      // 6. Update sync state
      if (import.meta.env.DEV) console.log('💾 Updating sync state...');
      this.updateProgress('finalizing', 0, 0, 95, 'syncProgress.updatingSyncState');
      await this.updateSyncState();

      // 7. Compact operation log in background (non-blocking)
      setTimeout(() => {
        this.compactOperationLog().catch(err => {
          if (import.meta.env.DEV) console.warn('Background compaction failed:', err);
        });
      }, 1000);

      this.updateProgress('finalizing', 0, 0, 100, 'syncProgress.syncComplete');
      this.lastSyncTime = new Date();
      this.lastFullSyncTime = Date.now(); // Track for smart sync
      if (import.meta.env.DEV) console.log('✅ Sync completed successfully at', this.lastSyncTime.toISOString());
      
      // Notify entries changed FIRST so UI updates with new data
      if (import.meta.env.DEV) {
        const verifyCount = await this.getAllEntries().then(e => e.length).catch(() => 0);
        console.log(`📢 Notifying ${this.entriesChangedListeners.length} listeners. Current entry count: ${verifyCount}`);
      }
      this.notifyEntriesChanged();
      
      // CRITICAL: Also dispatch window event for broader notification (e.g., Index.tsx)
      // This ensures UI updates even if component wasn't mounted when listener was registered
      window.dispatchEvent(new CustomEvent('entries-changed'));
      
      // Then update status to 'success' AFTER entries are notified
      this.syncStatus = 'success';
      this.currentProgress = null;
      this.notifyStatusListeners();
      
      // FIXED: Reset status to idle after 10 seconds, but only if this sync hasn't been superseded
      const currentSyncTime = syncStartTime;
      setTimeout(() => {
        // Only reset if we're still in success state AND this is still the most recent sync
        if (this.syncStatus === 'success' && this.lastSyncTime && 
            this.lastSyncTime.getTime() <= currentSyncTime) {
          this.syncStatus = 'idle';
          this.notifyStatusListeners();
        }
      }, 10000);
    } catch (error) {
      this.syncStatus = 'error';
      this.notifyStatusListeners();
      
      // Always log sync errors for debugging (even in production)
      if (import.meta.env.DEV) console.error('❌ Sync failed:', error);
      if (import.meta.env.DEV && error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      
      // Re-throw with a more user-friendly message
      throw error;
    } finally {
      // Disable bulk sync mode for primary provider
      if (primaryProvider && 'setBulkSyncMode' in primaryProvider) {
        (primaryProvider as any).setBulkSyncMode(false);
      }
      
      this.isSyncing = false;
      
      // FIXED: Process pending sync request if one was queued
      if (this.pendingSyncRequest) {
        this.pendingSyncRequest = false;
        if (import.meta.env.DEV) console.log('🔄 Processing queued sync request...');
        // Schedule the pending sync on next tick to avoid deep recursion
        setTimeout(() => {
          this.performFullSync().catch(err => {
            if (import.meta.env.DEV) console.error('Queued sync failed:', err);
          });
        }, 0);
      }
    }
  }

  /**
   * Perform a quick incremental sync - faster than full sync
   * Skips compaction and focuses on recent changes only
   * Use for auto-sync intervals when full sync was done recently
   */
  async performQuickSync(): Promise<void> {
    // Quick sync is essentially a lighter version of full sync
    // It skips operation log compaction (done in background) and is optimized for speed
    if (this.syncDisabled) {
      if (import.meta.env.DEV) console.log('⏭️ Quick sync blocked: syncDisabled flag is set');
      return;
    }
    
    if (this.isSyncing) {
      if (import.meta.env.DEV) console.log('⏭️ Quick sync skipped: sync already in progress');
      this.pendingSyncRequest = true;
      return;
    }

    // Validate preconditions
    const e2eMode = isE2EEnabled();
    if (e2eMode && !this.masterKey) {
      if (import.meta.env.DEV) console.log('⏸️ Quick sync skipped: No encryption password set');
      return;
    }
    
    if (!cloudStorageService.getPrimaryProvider() || !this.isOnline) {
      if (import.meta.env.DEV) console.log('⏸️ Quick sync skipped: No provider or offline');
      return;
    }

    this.isSyncing = true;
    this.syncStatus = 'syncing';
    this.notifyStatusListeners();

    if (import.meta.env.DEV) console.log('⚡ Starting quick sync...');

    try {
      // Quick sync: parallel fetch, no compaction
      const [opState, cloudFiles, localEntries] = await Promise.all([
        this.readOperationLog(),
        cloudStorageWithRetry.listFiles('entries'),
        this.getAllEntriesRaw()
      ]);

      // Sync pending operations
      await this.syncPendingOperations();

      // Reconcile
      const syncState = await this.getSyncState();
      await this.reconcileEntries(cloudFiles, localEntries, syncState, opState.deleted);

      // Update sync state
      await this.updateSyncState();

      this.lastSyncTime = new Date();
      if (import.meta.env.DEV) console.log('⚡ Quick sync completed at', this.lastSyncTime.toISOString());
      
      this.notifyEntriesChanged();
      this.syncStatus = 'success';
      this.notifyStatusListeners();
      
      setTimeout(() => {
        if (this.syncStatus === 'success') {
          this.syncStatus = 'idle';
          this.notifyStatusListeners();
        }
      }, 10000);
    } catch (error) {
      this.syncStatus = 'error';
      this.notifyStatusListeners();
      if (import.meta.env.DEV) console.error('⚡ Quick sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
      
      if (this.pendingSyncRequest) {
        this.pendingSyncRequest = false;
        setTimeout(() => this.performQuickSync().catch(() => {}), 0);
      }
    }
  }

  /**
   * Smart sync - automatically chooses between quick and full sync
   * Uses quick sync for frequent syncs, full sync when needed
   */
  async performSmartSync(): Promise<void> {
    const timeSinceFullSync = Date.now() - this.lastFullSyncTime;
    
    // Use full sync if:
    // - Never done a full sync
    // - More than 24 hours since last full sync
    // - No last sync time (first sync)
    if (this.lastFullSyncTime === 0 || timeSinceFullSync > StorageServiceV2.FULL_SYNC_INTERVAL_MS) {
      if (import.meta.env.DEV) {
        console.log('🔄 Smart sync → Full sync (last full sync: ' + 
          (this.lastFullSyncTime ? new Date(this.lastFullSyncTime).toISOString() : 'never') + ')');
      }
      await this.performFullSync();
    } else {
      if (import.meta.env.DEV) {
        const hoursSinceFullSync = Math.round(timeSinceFullSync / (60 * 60 * 1000));
        console.log(`⚡ Smart sync → Quick sync (${hoursSinceFullSync}h since full sync)`);
      }
      await this.performQuickSync();
    }
  }

  private async getAllEntriesRaw(): Promise<Map<string, EncryptedEntry>> {
    const db = await openDB();
    const transaction = db.transaction(['entries'], 'readonly');
    const store = transaction.objectStore('entries');

    const request = store.getAll();
    const entries: EncryptedEntry[] = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const map = new Map<string, EncryptedEntry>();
    entries.forEach(entry => map.set(entry.id, entry));
    return map;
  }

  private async reconcileEntries(
    cloudFiles: any[],
    localEntries: Map<string, EncryptedEntry>,
    syncState: SyncState,
    deletedIds: Set<string> = new Set(),
    onDownloadProgress?: (completed: number, total: number) => void,
    onUploadProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    // DEDUPLICATION: Skip if reconciliation happened recently (cooldown period)
    const timeSinceLastReconcile = Date.now() - this.lastReconciliationTime;
    if (timeSinceLastReconcile < StorageServiceV2.RECONCILIATION_COOLDOWN_MS) {
      if (import.meta.env.DEV) {
        console.log(`⏭️ Skipping reconciliation (cooldown: ${Math.round((StorageServiceV2.RECONCILIATION_COOLDOWN_MS - timeSinceLastReconcile) / 1000)}s remaining)`);
      }
      return;
    }

    // DEDUPLICATION: If already reconciling, reuse existing promise
    if (this.reconciliationPromise) {
      if (import.meta.env.DEV) {
        console.log('⏭️ Reusing existing reconciliation promise (deduplication)');
      }
      return this.reconciliationPromise;
    }

    // Start new reconciliation - store the promise for deduplication
    this.reconciliationPromise = this.doReconcileEntries(cloudFiles, localEntries, syncState, deletedIds, onDownloadProgress, onUploadProgress);

    try {
      await this.reconciliationPromise;
      this.lastReconciliationTime = Date.now();
    } finally {
      this.reconciliationPromise = null;
    }
  }

  private async doReconcileEntries(
    cloudFiles: any[],
    localEntries: Map<string, EncryptedEntry>,
    syncState: SyncState,
    deletedIds: Set<string> = new Set(),
    onDownloadProgress?: (completed: number, total: number) => void,
    onUploadProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    // Phase 3: Clock drift detection
    await this.detectClockDrift(cloudFiles);
    
    // Consider only entry files in the cloud folder and skip deleted IDs
    const entryFiles = cloudFiles.filter(
      (file) => file.name.startsWith('entry-') && file.name.endsWith('.json') &&
        !deletedIds.has(file.name.replace(/^entry-/, '').replace(/\.json$/, ''))
    );

    const cloudEntriesMap = new Map<string, any>();
    let hadCloudReadError = false;

    // Only download files that are new or updated compared to local, based on WebDAV modifiedAt
    const filesToDownload = entryFiles.filter((file) => {
      const id = file.name.replace(/^entry-/, '').replace(/\.json$/, '');
      const local = localEntries.get(id);
      if (!local) return true; // new in cloud
      
      // FIXED: If modifiedAt is missing/invalid, compare version vectors instead
      // to avoid re-downloading entries we just saved
      if (!file.modifiedAt) {
        // Download to check version vector (unavoidable without modifiedAt)
        return true;
      }
      const cloudModified = new Date(file.modifiedAt);
      if (isNaN(cloudModified.getTime())) {
        return true;
      }
      
      const localUpdated = new Date(local.metadata?.updatedAt || local.metadata?.createdAt || 0);
      
      // FIXED: Add tolerance window to prevent race condition where we re-download
      // an entry we just uploaded (cloud timestamp might be slightly behind)
      const TOLERANCE_MS = 2000; // 2 seconds tolerance
      if (Math.abs(cloudModified.getTime() - localUpdated.getTime()) < TOLERANCE_MS) {
        // Timestamps are very close - skip download to avoid race condition
        return false;
      }
      
      return cloudModified > localUpdated; // cloud newer
    });

    if (import.meta.env.DEV) console.log(`📥 Will download ${filesToDownload.length} of ${entryFiles.length} cloud files (based on modifiedAt)`);

    // [provider-debug] Only log first N entry downloads to compare provider behaviour (Google Drive vs Dropbox/Nextcloud)
    const providerDebugEnabled = import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('ownjournal-provider-debug') === '1');
    let providerDebugLogCount = 0;
    const PROVIDER_DEBUG_MAX = 2;

    // Download processor function (reusable for retry loop)
    const downloadProcessor = async (file: any): Promise<{ id: string; entry: EncryptedEntry; file: any } | null> => {
      try {
        const content = await cloudStorageWithRetry.downloadFromPrimary(file.path);
        if (content) {
          const providerName = cloudStorageService.getPrimaryProvider()?.name ?? 'unknown';
          if (providerDebugEnabled && providerDebugLogCount < PROVIDER_DEBUG_MAX) {
            const trimmed = content.trim();
            const hasBOM = content.charCodeAt(0) === 0xFEFF;
            console.log(
              `[provider-debug] download entry ${file.path} provider=${providerName} rawLength=${content.length} hasBOM=${hasBOM} startsWithQuote=${trimmed.startsWith('"')} first50=${content.substring(0, 50).replace(/\n/g, '\\n')}`
            );
          }

          // Sanitize content: strip BOM, normalize line endings, trim (provider-specific normalization for Dropbox/Nextcloud)
          let cleaned = content.replace(/^\uFEFF/, '');
          cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
          let parsed: any;
          try {
            parsed = JSON.parse(cleaned);
          } catch (e1) {
            // If content is a quoted JSON string, unwrap until we get an object (handles double/triple encoding from some providers)
            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
              let inner: unknown = JSON.parse(cleaned);
              while (typeof inner === 'string') {
                inner = JSON.parse(inner);
              }
              parsed = inner;
            } else {
              throw e1;
            }
          }
          // Unwrap any remaining string layers (e.g. provider returns single quoted JSON string)
          while (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Entry content did not parse to an object');
          }

          const entry: EncryptedEntry = parsed;

          if (providerDebugEnabled && providerDebugLogCount < PROVIDER_DEBUG_MAX) {
            let dataBase64Valid = false;
            let ivBase64Valid = false;
            try {
              if (entry.encryptedData) atob(entry.encryptedData);
              dataBase64Valid = true;
            } catch (_) {}
            try {
              if (entry.iv) atob(entry.iv);
              ivBase64Valid = true;
            } catch (_) {}
            console.log(
              `[provider-debug] parsed entry id=${entry.id} encryptedDataLen=${entry.encryptedData?.length ?? 0} ivLen=${entry.iv?.length ?? 0} ivStartsWith=${(entry.iv ?? '').substring(0, 16)} dataStartsWith=${(entry.encryptedData ?? '').substring(0, 24)} dataBase64Valid=${dataBase64Valid} ivBase64Valid=${ivBase64Valid}`
            );
            providerDebugLogCount++;
          }

          // Validate entry has required fields
          if (entry.id && entry.encryptedData && entry.metadata) {
            return { id: entry.id, entry, file };
          } else {
            if (import.meta.env.DEV) console.warn('⚠️ Skipping invalid entry from cloud:', file.path);
            hadCloudReadError = true;
            addDiagnosticEntry('error', `Download ${file.path}`, 'Invalid entry structure (missing required fields)', { path: file.path });
            return null;
          }
        } else {
          if (import.meta.env.DEV) console.warn(`⚠️ Could not download file: ${file.path} (possibly from disconnected provider)`);
          hadCloudReadError = true;
          addDiagnosticEntry('error', `Download ${file.path}`, 'File content empty or unavailable', { path: file.path });
          return null;
        }
      } catch (error: any) {
        hadCloudReadError = true;
        if (import.meta.env.DEV) console.warn(`⚠️ Failed to download/parse cloud entry: ${file.path}`, error);
        
        addDiagnosticEntry(
          'error',
          `Download ${file.path}`,
          `Failed to download: ${error.message || 'Unknown error'}`,
          { error: String(error), path: file.path, status: error.status }
        );
        
        // Re-throw rate limit errors so the rate limiter can handle them
        if (AdaptiveRateLimiter.isRateLimitError(error)) {
          throw error;
        }
        return null;
      }
    };

    const processBatchOptions = {
      isRateLimitError: AdaptiveRateLimiter.isRateLimitError,
      getRetryAfterMs: AdaptiveRateLimiter.getRetryAfterMs,
      onProgress: onDownloadProgress,
    };

    // Main batch processing
    let downloadResults = await cloudRateLimiter.processBatch(
      filesToDownload,
      downloadProcessor,
      processBatchOptions
    );

    // RETRY LOOP: Retry failed downloads until all succeed or max rounds reached
    const MAX_RETRY_ROUNDS = 3;
    const RETRY_COOLDOWN_MS = 5000; // 5s between retry rounds

    for (let retryRound = 1; retryRound <= MAX_RETRY_ROUNDS; retryRound++) {
      // Collect failed items with their original file info
      const failedIndices: number[] = [];
      for (let i = 0; i < downloadResults.length; i++) {
        if (downloadResults[i].status === 'rejected') {
          failedIndices.push(i);
        }
      }

      if (failedIndices.length === 0) {
        if (import.meta.env.DEV && retryRound > 1) {
          console.log(`✅ All files downloaded after ${retryRound - 1} retry round(s)`);
        }
        break;
      }

      if (import.meta.env.DEV) {
        console.log(`🔄 Retry round ${retryRound}/${MAX_RETRY_ROUNDS}: ${failedIndices.length} files to retry`);
      }

      // Wait for circuit breaker to recover (if open)
      const circuitState = cloudRateLimiter.getCircuitState();
      if (circuitState === 'open') {
        const waitTime = 15000; // Match circuit open duration
        if (import.meta.env.DEV) {
          console.log(`⏳ Circuit breaker open, waiting ${waitTime / 1000}s before retry...`);
        }
        await new Promise(r => setTimeout(r, waitTime));
      } else {
        // Brief cooldown before retry
        await new Promise(r => setTimeout(r, RETRY_COOLDOWN_MS));
      }

      // Reset rate limiter for fresh start (conservative again)
      cloudRateLimiter.reset();

      // Retry failed files
      const retryFiles = failedIndices.map(i => filesToDownload[i]);
      const retryResults = await cloudRateLimiter.processBatch(
        retryFiles,
        downloadProcessor,
        processBatchOptions
      );

      // Merge retry results back into main results
      for (let i = 0; i < failedIndices.length; i++) {
        downloadResults[failedIndices[i]] = retryResults[i];
      }
    }

    // Log final failure count (if any)
    const finalFailures = downloadResults.filter(r => r.status === 'rejected').length;
    if (finalFailures > 0) {
      console.warn(`⚠️ ${finalFailures} files could not be downloaded after ${MAX_RETRY_ROUNDS} retry rounds`);
      addDiagnosticEntry(
        'error',
        'Download Retry',
        `${finalFailures} files failed after ${MAX_RETRY_ROUNDS} retry rounds`,
        { failedCount: finalFailures, maxRounds: MAX_RETRY_ROUNDS }
      );
    }

    // Collect successful downloads from rate limiter results
    const downloadedEntries = downloadResults
      .filter((r): r is { status: 'fulfilled'; value: { id: string; entry: EncryptedEntry; file: any } | null } => 
        r.status === 'fulfilled')
      .map(r => r.value)
      .filter((v): v is { id: string; entry: EncryptedEntry; file: any } => v !== null);

    // Build cloud entries map
    for (const item of downloadedEntries) {
      if (item && !deletedIds.has(item.id)) {
        cloudEntriesMap.set(item.id, { entry: item.entry, file: item.file });
      }
    }

    if (import.meta.env.DEV) {
      console.log(`📥 Downloaded ${cloudEntriesMap.size} entries from cloud`);
      console.log('🔍 Cloud entry IDs:', Array.from(cloudEntriesMap.keys()));
      console.log('🔍 Local entry IDs:', Array.from(localEntries.keys()));
    }

    // If we detected read errors and ended up with zero parsed entries while the cloud reports files,
    // abort reconciliation ONLY if ALL files failed (to avoid wrongly uploading or deleting data)
    // But if some files succeeded, continue with partial sync (happens when switching providers)
    if (hadCloudReadError && entryFiles.length > 0 && cloudEntriesMap.size === 0) {
      // All files failed - this is a critical error
      throw new Error('All cloud entries could not be downloaded (edge function or provider error). Sync aborted to avoid overwriting data.');
    }
    
    // Log partial failures but continue sync (e.g., files from disconnected providers)
    if (hadCloudReadError && cloudEntriesMap.size > 0) {
      if (import.meta.env.DEV) {
        const failedCount = entryFiles.length - filesToDownload.length + (filesToDownload.length - cloudEntriesMap.size);
        console.warn(`⚠️ Partial sync: ${failedCount} files could not be downloaded (possibly from disconnected providers). Continuing with ${cloudEntriesMap.size} entries.`);
      }
    }

    // Prepare batch operations
    const toDownload: EncryptedEntry[] = [];
    const toUpload: { id: string; entry: EncryptedEntry }[] = [];
    const toDeleteLocal: string[] = [];

    // Find entries that need to be deleted locally (deleted on another device)
    for (const [id, entry] of localEntries) {
      if (deletedIds.has(id)) {
        toDeleteLocal.push(id);
      }
    }

    // Find entries that need to be downloaded or have conflicts
    for (const [id, { entry }] of cloudEntriesMap) {
      try {
        if (!localEntries.has(id)) {
          toDownload.push(entry);
        } else {
          // Phase 4: Conflict detection with version vectors
          const localEntry = localEntries.get(id)!;

          // Safely handle date parsing
          const localUpdated = new Date(localEntry.metadata?.updatedAt || localEntry.metadata?.createdAt || 0);
          const cloudUpdated = new Date(entry.metadata?.updatedAt || entry.metadata?.createdAt || 0);

          // Phase 4: Check for conflicts using version vectors
          const localVector: VersionVector = localEntry.versionVector || {};
          const cloudVector: VersionVector = entry.versionVector || {};
          
          const hasConflict = detectConflict(localVector, cloudVector, this.deviceId);
          
          if (hasConflict) {
            // CONFLICT DETECTED: Both devices have made changes
            // First, check if the content is actually identical (false conflict from provider transfer)
            const decryptedLocal = await this.decryptEntry(localEntry);
            const decryptedCloud = await this.decryptEntry(entry);
            
            if (entriesAreIdentical(decryptedLocal, decryptedCloud)) {
              // Content is identical - this is a false conflict (e.g., from provider transfer)
              // Silently merge version vectors without logging a conflict
              if (import.meta.env.DEV) {
                console.log(`ℹ️ Skipping conflict for entry ${id} - content is identical`);
              }
              const mergedVector = mergeVersionVectors(localVector, cloudVector);
              const updatedEntry = { ...entry, versionVector: mergedVector };
              toDownload.push(updatedEntry);
            } else {
              // Actual conflict with different content
              if (import.meta.env.DEV) {
                console.warn(`⚠️ Conflict detected for entry ${id}`);
              }
              
              // Last-write-wins resolution (with device ID tiebreaker)
              let useCloud = cloudUpdated > localUpdated;
              if (cloudUpdated.getTime() === localUpdated.getTime()) {
                // FIXED: Tie-breaker using actual device IDs, not operation IDs
                const cloudDeviceIds = Object.keys(cloudVector);
                const cloudDeviceId = cloudDeviceIds.length > 0 ? cloudDeviceIds[0] : '';
                useCloud = cloudDeviceId > this.deviceId;
              }
              
              if (useCloud) {
                // Cloud wins - merge version vectors to prevent repeated conflicts
                const mergedVector = mergeVersionVectors(localVector, cloudVector);
                const updatedEntry = { ...entry, versionVector: mergedVector };
                
                addConflictLogEntry(
                  id,
                  {
                    deviceId: Object.keys(cloudVector)[0] || 'unknown',
                    operationId: cloudVector[Object.keys(cloudVector)[0]] || 'unknown',
                    timestamp: cloudUpdated.toISOString(),
                    entry: decryptedCloud
                  },
                  {
                    deviceId: this.deviceId,
                    operationId: localVector[this.deviceId] || 'unknown',
                    timestamp: localUpdated.toISOString(),
                    entry: decryptedLocal
                  },
                  'usingCloud',
                  { keptTime: cloudUpdated.toLocaleString(), discardedTime: localUpdated.toLocaleString() }
                );
                
                toDownload.push(updatedEntry);
              } else {
                // Local wins - merge version vectors to prevent repeated conflicts
                const mergedVector = mergeVersionVectors(localVector, cloudVector);
                const updatedEntry = { ...localEntry, versionVector: mergedVector };
                
                addConflictLogEntry(
                  id,
                  {
                    deviceId: this.deviceId,
                    operationId: localVector[this.deviceId] || 'unknown',
                    timestamp: localUpdated.toISOString(),
                    entry: decryptedLocal
                  },
                  {
                    deviceId: Object.keys(cloudVector)[0] || 'unknown',
                    operationId: cloudVector[Object.keys(cloudVector)[0]] || 'unknown',
                    timestamp: cloudUpdated.toISOString(),
                    entry: decryptedCloud
                  },
                  'usingLocal',
                  { keptTime: localUpdated.toLocaleString(), discardedTime: cloudUpdated.toLocaleString() }
                );
                
                toUpload.push({ id, entry: updatedEntry });
              }
            }
          } else {
            // No conflict - check version vectors first, then fall back to timestamps
            // Version vectors are more reliable than timestamps (immune to device clock skew)
            const cloudHasNewerVector = Object.keys(cloudVector).some(deviceId => {
              const cloudOpId = cloudVector[deviceId];
              const localOpId = localVector[deviceId];
              // Cloud has an operation from a device that local doesn't have (or has a newer one)
              return cloudOpId && (!localOpId || cloudOpId > localOpId);
            });
            const localHasUnseenChanges = Object.keys(localVector).some(deviceId => {
              const localOpId = localVector[deviceId];
              const cloudOpId = cloudVector[deviceId];
              // Local has an operation from a device that cloud doesn't have (or has a newer one)
              return localOpId && (!cloudOpId || localOpId > cloudOpId);
            });

            if (cloudUpdated > localUpdated) {
              // Cloud newer by timestamp - download
              const updatedEntry = entry.versionVector ? entry : {
                ...entry,
                versionVector: { [Object.keys(cloudVector)[0] || 'unknown']: 'legacy' }
              };
              toDownload.push(updatedEntry);
            } else if (localUpdated > cloudUpdated) {
              if (cloudHasNewerVector && !localHasUnseenChanges) {
                // FIXED: Despite local timestamp being newer, the version vector shows cloud is
                // actually the more recent version. This handles device clock skew (e.g. Android
                // device clock is behind web app clock) where Android saves an entry with a title
                // but its updatedAt appears older than the web's previous save time.
                if (import.meta.env.DEV) console.log(`📥 Entry ${id}: timestamp says local newer but cloud vector is superset - downloading cloud (clock skew fix)`);
                const updatedEntry = entry.versionVector ? entry : {
                  ...entry,
                  versionVector: { [Object.keys(cloudVector)[0] || 'unknown']: 'legacy' }
                };
                toDownload.push(updatedEntry);
              } else {
                // Local newer - but add version vector if missing
                const updatedEntry = localEntry.versionVector ? localEntry : {
                  ...localEntry,
                  versionVector: { [this.deviceId]: 'legacy' }
                };
                toUpload.push({ id, entry: updatedEntry });
              }
            } else {
              // Timestamps are equal - check version vectors for metadata-only updates
              // This catches AI metadata updates that don't change updatedAt
              if (cloudHasNewerVector) {
                if (import.meta.env.DEV) console.log(`📥 Entry ${id}: timestamps equal but cloud has newer version vector, downloading`);
                const updatedEntry = entry.versionVector ? entry : {
                  ...entry,
                  versionVector: { [Object.keys(cloudVector)[0] || 'unknown']: 'legacy' }
                };
                toDownload.push(updatedEntry);
              }
              // If version vectors are also equal, do nothing (truly in sync)
            }
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to reconcile entry:', id, error);
      }
    }

    // Build a set of entry IDs that exist in cloud (regardless of whether they were downloaded)
    // This prevents re-uploading a local entry that exists in cloud but was skipped in stage 1
    // (e.g. due to the tolerance window or download failure handled above)
    const cloudEntryIds = new Set(entryFiles.map(f =>
      f.name.replace(/^entry-/, '').replace(/\.json$/, '')
    ));

    // Find entries that need to be uploaded (in local but genuinely absent from cloud)
    for (const [id, entry] of localEntries) {
      if (deletedIds.has(id)) {
        // Respect deletion log: do not re-upload deleted entries
        continue;
      }
      if (!cloudEntryIds.has(id) && !cloudEntriesMap.has(id)) {
        if (import.meta.env.DEV) console.log(`🔍 Entry ${id} not found in cloud, will upload`);
        toUpload.push({ id, entry });
      }
    }

    // Batch delete from local (entries deleted on another device)
    if (toDeleteLocal.length > 0) {
      if (import.meta.env.DEV) console.log(`🗑️ Removing ${toDeleteLocal.length} deleted entries from local storage`);
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      
      await Promise.all(
        toDeleteLocal.map(id => 
          new Promise<void>((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          })
        )
      );
    }

    // Batch save to IndexedDB (with deduplication by ID)
    if (toDownload.length > 0) {
      // Deduplicate by ID before saving
      const uniqueEntries = Array.from(
        new Map(toDownload.map(e => [e.id, e])).values()
      );
      
      if (import.meta.env.DEV) {
        if (uniqueEntries.length !== toDownload.length) {
          console.warn(`⚠️ Removed ${toDownload.length - uniqueEntries.length} duplicate entries before saving`);
        }
        console.log(`💾 Saving ${uniqueEntries.length} new/updated entries to local storage`);
        console.log('💾 Entry IDs being saved:', uniqueEntries.map(e => e.id));
      }
      
      // FIXED: Force overwrite using put to ensure we never create duplicates
      const db = await openDB();
      const transaction = db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      
      await Promise.all(uniqueEntries.map((entry) => 
        new Promise<void>((resolve, reject) => {
          const request = store.put(entry);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      ));
    }

    // Batch upload to cloud with progress tracking
    if (toUpload.length > 0) {
      if (import.meta.env.DEV) console.log(`☁️ Uploading ${toUpload.length} new/updated entries to cloud`);
      
      const uploadProcessor = async ({ id, entry }: { id: string; entry: EncryptedEntry }) => {
        await cloudStorageWithRetry.uploadToAll(
          `entries/entry-${id}.json`,
          JSON.stringify(entry)
        );
        return id;
      };
      
      const uploadBatchOptions = {
        isRateLimitError: AdaptiveRateLimiter.isRateLimitError,
        getRetryAfterMs: AdaptiveRateLimiter.getRetryAfterMs,
        onProgress: onUploadProgress,
      };
      
      await cloudRateLimiter.processBatch(
        toUpload,
        uploadProcessor,
        uploadBatchOptions
      );
    }

    if (toDownload.length === 0 && toUpload.length === 0) {
      if (import.meta.env.DEV) console.log('✨ All entries are already in sync');
    }
  }

  // syncDeletions is now handled by readOperationLog in performFullSync
  // No separate deletion sync needed - operations.log is the source of truth

  // Phase 2: Obsolete deletion methods removed - replaced by operations.log
  // quickSyncDelete simplified - just tries to delete the file

  /**
   * Quick, single-item delete sync (best-effort file deletion from cloud)
   */
  async quickSyncDelete(id: string): Promise<void> {
    if (!this.isOnline || !cloudStorageService.getPrimaryProvider()) return;
    
    try {
      // Best-effort: delete the file from cloud storage
      // operations.log already has the delete operation, this just cleans up the file
      await cloudStorageWithRetry.deleteFromAll(`entries/entry-${id}.json`);
      if (import.meta.env.DEV) console.log(`✅ Deleted entry file ${id} from cloud`);
    } catch (e) {
      // File deletion failed but that's OK - operations.log will prevent re-download
      if (import.meta.env.DEV) console.warn(`⚠️ File delete failed for ${id} (non-critical):`, e);
    }
  }

  async quickSyncUpsert(entry: JournalEntryData): Promise<void> {
    // CRITICAL: Check sync lock first - prevents sync during disconnect flow
    if (this.syncDisabled) {
      if (import.meta.env.DEV) console.log('⏭️ Quick sync blocked: syncDisabled flag is set');
      return;
    }
    
    const e2eMode = isE2EEnabled();
    // FIXED: For E2E mode, require masterKey. For Simple mode, proceed without it
    if (e2eMode && !this.masterKey) return;
    if (!this.isOnline || !cloudStorageService.getPrimaryProvider()) return;

    let payload: EncryptedEntry;
    
    if (e2eMode && this.masterKey) {
      // E2E mode - encrypt the entry
      const plaintext = JSON.stringify({ title: entry.title, body: entry.body, images: entry.images || [] });
      const { encrypted, iv } = await encryptData(plaintext, this.masterKey);
      payload = {
        id: entry.id,
        encryptedData: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv),
        metadata: {
          date: entry.date.toISOString(),
          tags: entry.tags,
          mood: entry.mood,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        },
      };
    } else {
      // Simple mode - plain JSON (no encryption)
      payload = {
        id: entry.id,
        encryptedData: JSON.stringify({ title: entry.title, body: entry.body, images: entry.images || [] }),
        iv: '', // No IV in Simple mode
        metadata: {
          date: entry.date.toISOString(),
          tags: entry.tags,
          mood: entry.mood,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        },
      };
    }

    try {
      await cloudStorageWithRetry.uploadToAll(`entries/entry-${entry.id}.json`, JSON.stringify(payload));
      if (import.meta.env.DEV) console.log('✅ Quick upsert synced');
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Quick upsert failed, will sync in background:', e);
    }
  }

  /**
   * Auto-provision cloud structure if missing (first sync scenario)
   * Phase 2: No need to create operations.log - individual files are created on demand
   * FIXED: Better error handling for Nextcloud 500 errors on first sync
   */
  private async autoProvisionCloudStructure(): Promise<string | null> {
    try {
      // Try to download sync-state.json and return it to avoid redundant download later
      let syncStateData: string | null = null;
      try {
        syncStateData = await cloudStorageWithRetry.downloadFromPrimary('sync-state.json');
      } catch (error: any) {
        // If we get a 404, the file doesn't exist (expected on first sync)
        // If we get a 500, Nextcloud might have issues, but we'll try to create the file anyway
        if (import.meta.env.DEV) {
          console.log('📝 sync-state.json check result:', error?.message || 'not found');
        }
      }

      if (!syncStateData) {
        if (import.meta.env.DEV) console.log('📝 Creating initial sync-state.json');
        const initialState: SyncState = {
          lastSyncTimestamp: new Date().toISOString(),
          deviceId: this.deviceId,
        };
        
        // Try to create sync-state.json with better error handling
        try {
          await cloudStorageWithRetry.uploadToAll('sync-state.json', JSON.stringify(initialState));
          if (import.meta.env.DEV) console.log('✅ Initial sync-state.json created');
          syncStateData = JSON.stringify(initialState); // Return newly created state
        } catch (uploadError: any) {
          // Abort sync early — Nextcloud encryption blocks all operations
          if (getCloudErrorCode(uploadError) === CloudErrorCode.ENCRYPTION_ERROR
              || getCloudErrorCode(uploadError) === CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT) {
            throw uploadError;
          }
          // Abort sync — iCloud schema not configured, nothing can be saved
          const msg = uploadError instanceof Error ? uploadError.message : '';
          if (msg.includes('record type does not exist') || msg.includes('NOT_FOUND')) {
            throw new Error(
              'iCloud sync failed: The JournalEntry record type does not exist in CloudKit. ' +
              'Please create it in the CloudKit Dashboard.'
            );
          }
          // If upload fails for other reasons, log it but don't fail the entire sync
          if (import.meta.env.DEV) {
            console.warn('⚠️ Failed to create sync-state.json (will use local state):', uploadError?.message);
          }
        }
      }

      // Note: No need to create operations/ folder or operations.log
      // Operation files are created on-demand as operations happen

      if (import.meta.env.DEV) console.log('✅ Cloud structure check complete');
      return syncStateData; // Return cached sync-state to avoid redundant download
    } catch (error) {
      // Rethrow Nextcloud encryption errors so sync fails fast and UI shows the guide
      if (getCloudErrorCode(error) === CloudErrorCode.ENCRYPTION_ERROR
          || getCloudErrorCode(error) === CloudErrorCode.NEXTCLOUD_ENCRYPTED_CONTENT) {
        throw error;
      }
      // Rethrow iCloud schema errors — nothing can be saved without the record type
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.includes('record type does not exist') || errMsg.includes('JournalEntry')) {
        throw error;
      }
      // Non-critical - sync can continue even if this fails
      if (import.meta.env.DEV) console.warn('⚠️ Auto-provision failed (non-critical):', error);
      return null;
    }
  }

  /**
   * Phase 3: Detect clock drift between local device and cloud timestamps
   * Warns if drift exceeds safe thresholds to prevent sync issues
   */
  private async detectClockDrift(cloudFiles: any[]): Promise<void> {
    try {
      const now = Date.now();
      
      // Only consider files modified in the last 7 days for clock drift detection
      // This prevents false positives when cloud has stale data (e.g., after DELETE)
      const RECENT_FILE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
      const recentCutoff = now - RECENT_FILE_THRESHOLD_MS;
      
      // Find the most recent cloud file with a valid timestamp (within last 7 days)
      let mostRecentCloudTime = 0;
      for (const file of cloudFiles) {
        if (file.modifiedAt) {
          const fileTime = new Date(file.modifiedAt).getTime();
          // Only consider files modified recently to avoid false positives from stale data
          if (!isNaN(fileTime) && fileTime > recentCutoff && fileTime > mostRecentCloudTime) {
            mostRecentCloudTime = fileTime;
          }
        }
      }
      
      // If no recent files found, skip clock drift detection entirely
      if (mostRecentCloudTime === 0) {
        if (import.meta.env.DEV) {
          console.log('⏭️ Skipping clock drift detection - no recent files to compare');
        }
        return;
      }
      
      // Calculate drift (positive = local is ahead, negative = local is behind)
      const driftMs = now - mostRecentCloudTime;
      const driftSeconds = Math.abs(driftMs) / 1000;
      
      // More realistic thresholds for cloud sync scenarios
      // Users may not sync for several days (weekends, vacations, device switches)
      const WARN_THRESHOLD_SECONDS = 24 * 60 * 60; // 24 hours (dev only)
      const CRITICAL_THRESHOLD_SECONDS = 7 * 24 * 60 * 60; // 7 days
      
      const driftHours = Math.round(driftSeconds / 3600);
      const driftDays = Math.round(driftSeconds / 86400);
      
      if (driftSeconds > CRITICAL_THRESHOLD_SECONDS) {
        // More than 7 days - definitely stale cloud data, not actual clock drift
        if (import.meta.env.DEV) {
          console.log(`ℹ️ Large time gap (${driftDays} days) - likely stale cloud data, not clock drift`);
        }
      } else if (driftSeconds > WARN_THRESHOLD_SECONDS) {
        // 1-7 days - ambiguous, only warn in dev mode
        if (import.meta.env.DEV) {
          console.warn(`⚠️ Potential clock drift detected (~${driftHours} hours) - verify system time if sync issues occur`);
        }
      }
    } catch (error) {
      // Non-critical - don't fail sync for clock drift detection
      if (import.meta.env.DEV) {
        console.warn('Clock drift detection failed:', error);
      }
    }
  }

  private async getSyncState(): Promise<SyncState> {
    try {
      const data = await cloudStorageWithRetry.downloadFromPrimary('sync-state.json');
      if (data) {
        return this.parseSyncState(data);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to get sync state:', error);
    }

    return {
      lastSyncTimestamp: new Date().toISOString(),
      deviceId: this.deviceId,
    };
  }

  /**
   * Parse sync state from JSON string
   * Used to avoid redundant downloads when sync-state is already cached
   */
  private parseSyncState(data: string): SyncState {
    try {
      return JSON.parse(data);
    } catch {
      return {
        lastSyncTimestamp: new Date().toISOString(),
        deviceId: this.deviceId,
      };
    }
  }

  private async updateSyncState(): Promise<void> {
    const state: SyncState = {
      lastSyncTimestamp: new Date().toISOString(),
      deviceId: this.deviceId,
    };

    try {
      await cloudStorageWithRetry.uploadToAll('sync-state.json', JSON.stringify(state));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to update sync state:', error);
      // Re-throw structured CloudErrors (e.g. Nextcloud encryption) so the UI can show the right guide
      if (isCloudError(error)) throw error;
      // Preserve cloudErrorCode on wrapped Error for downstream detection
      const wrapped = new Error(`Failed to update sync state: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error && typeof error === 'object' && 'cloudErrorCode' in error) {
        (wrapped as any).cloudErrorCode = (error as any).cloudErrorCode;
        (wrapped as any).details = (error as any).details;
      }
      throw wrapped;
    }
  }

  /**
   * Start automatic sync every 5 minutes (configurable, optional)
   * FIXED: Changed from 30 min to 5 min to match UI expectations
   * FIXED: Added error handling for auto-sync
   * FIXED: Added idempotency tracking to prevent duplicate intervals
   */
  private startAutoSync(): void {
    // Clear any existing interval first
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Sync every 5 minutes (can be disabled by user preference)
    const autoSyncEnabled = localStorage.getItem(scopedKey('autoSyncEnabled')) !== 'false';
    if (!autoSyncEnabled) {
      if (import.meta.env.DEV) console.log('🔄 Auto-sync disabled by user preference');
      return;
    }

    // Track start count for debugging
    this.autoSyncStartCount++;
    const thisStartId = this.autoSyncStartCount;
    
    if (import.meta.env.DEV) {
      console.log(`🔄 Starting auto-sync interval #${thisStartId} (every ${ENCRYPTION_CONSTANTS.SYNC_INTERVAL_MS / 60000} minutes)`);
    }

    this.syncInterval = window.setInterval(() => {
      if (import.meta.env.DEV) {
        console.log(`⏰ Auto-sync timer #${thisStartId} triggered`);
      }
      
      const e2eMode = isE2EEnabled();
      // FIXED: For E2E mode, require masterKey. For Simple mode, just need provider
      const canSync = this.isOnline && 
                      cloudStorageService.getPrimaryProvider() && 
                      (e2eMode ? this.masterKey : true);
      
      if (canSync) {
        this.performSmartSync().catch(err => {
          if (import.meta.env.DEV) {
            console.error('Auto-sync failed:', err);
          }
          // Don't throw - let it retry on next interval
        });
      } else {
        if (import.meta.env.DEV) {
          console.log('⏭️ Skipping auto-sync:', {
            online: this.isOnline,
            hasProvider: !!cloudStorageService.getPrimaryProvider(),
            e2eMode,
            hasMasterKey: !!this.masterKey
          });
        }
      }
    }, ENCRYPTION_CONSTANTS.SYNC_INTERVAL_MS);
  }

  /**
   * Ensure auto-sync is running if conditions are met.
   * Safe to call multiple times – no-op if interval already exists.
   * Used by startup flow to guarantee the timer starts even when
   * the app was launched offline or from cached credentials.
   */
  ensureAutoSyncRunning(): void {
    if (this.syncInterval) return; // already running
    if (!this.isInitialized) return;
    if (!cloudStorageService.getPrimaryProvider()) return;

    const e2eMode = isE2EEnabled();
    if (e2eMode && !this.masterKey) return;

    if (import.meta.env.DEV) console.log('🔄 ensureAutoSyncRunning: starting auto-sync (was not running)');
    this.startAutoSync();
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Disable all sync operations - CRITICAL for disconnect flow
   * This prevents entries from being re-uploaded during provider disconnect
   * Must be called BEFORE unregistering provider and clearing credentials
   */
  disableSync(): void {
    if (import.meta.env.DEV) console.log('🚫 Sync disabled - blocking all sync operations');
    this.syncDisabled = true;
    this.stopAutoSync();
    // Cancel any in-progress sync
    this.isSyncing = false;
    this.pendingSyncRequest = false;
  }
  
  /**
   * Re-enable sync operations after provider disconnect
   * Should only be called if another provider is still connected
   */
  enableSync(): void {
    if (import.meta.env.DEV) console.log('✅ Sync enabled');
    this.syncDisabled = false;
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): { status: SyncStatus; lastSync: Date | null; providers: string[] } {
    return {
      status: this.syncStatus,
      lastSync: this.lastSyncTime,
      providers: cloudStorageService.getConnectedProviderNames(),
    };
  }

  /**
   * Phase 3: Get sync diagnostics
   */
  getDiagnostics(): SyncDiagnostics {
    const successCount = diagnostics.filter(d => d.type === 'success').length;
    const failureCount = diagnostics.filter(d => d.type === 'error').length;
    const retryCount = diagnostics.filter(d => d.type === 'retry').length;
    
    return {
      recentEntries: diagnostics.slice(0, 100), // Return most recent 100
      successCount,
      failureCount,
      retryCount,
      circuitBreakerStatus: new Map(circuitBreakers),
      activeRetries: new Set(this.activeRetries)
    };
  }
  
  /**
   * Phase 3: Clear diagnostic history
   */
  clearDiagnostics(): void {
    diagnostics.length = 0;
    diagnosticIdCounter = 0;
  }
  
  /**
   * Phase 4: Get conflict log
   */
  getConflictLog(): ConflictLogEntry[] {
    return [...conflictLog]; // Return copy
  }
  
  /**
   * Phase 4: Clear conflict log
   */
  clearConflictLog(): void {
    conflictLog.length = 0;
    conflictIdCounter = 0;
  }
  
  /**
   * Phase 4: Restore an entry from conflict log
   */
  async restoreFromConflict(conflictId: string): Promise<void> {
    const conflict = conflictLog.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }
    
    // Restore the loser entry
    await this.saveEntry(conflict.loser.fullEntry);
    
    if (import.meta.env.DEV) {
      console.log(`✅ Restored entry ${conflict.entryId} from conflict ${conflictId}`);
    }
  }
}

export const storageServiceV2 = new StorageServiceV2();
