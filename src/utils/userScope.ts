/**
 * User scope utility
 *
 * Provides per-user isolation for localStorage and IndexedDB by namespacing
 * all storage keys with the current user's ID.
 *
 * Must call setCurrentUserId() when auth resolves (before any storage reads).
 */

let _currentUserId: string | null = null;

/** Set the active user ID. Call immediately when auth resolves or clears. */
export function setCurrentUserId(userId: string | null): void {
  _currentUserId = userId;
}

/** Returns the current user ID, or null if not authenticated. */
export function getCurrentUserId(): string | null {
  return _currentUserId;
}

/**
 * Returns a user-scoped localStorage key.
 * Falls back to the bare key when no user is set (pre-auth reads get the old
 * unscoped value, which is correct during migration).
 */
export function scopedKey(key: string): string {
  if (!_currentUserId) return key;
  return `u:${_currentUserId}:${key}`;
}

/**
 * Returns a user-scoped IndexedDB database name.
 * Falls back to the base name when no user is set.
 */
export function userScopedDBName(baseName: string): string {
  if (!_currentUserId) return baseName;
  return `${baseName}_${_currentUserId}`;
}

/**
 * Unscoped key that records the last user whose migration ran.
 * Persists across sign-out so the NEXT login can detect a user switch.
 * NOT included in UNSCOPED_KEYS_TO_CLEAR – it must survive sign-out.
 */
const LAST_USER_KEY = '_ownjournal_last_user_id';

/**
 * Returns the last user ID that was active on this device.
 * Reads from localStorage (persists across sessions/app restarts).
 * Useful for loading user-scoped data before auth resolves.
 */
export function getLastUserId(): string | null {
  return localStorage.getItem(LAST_USER_KEY);
}

/**
 * Version string stamped on every migration run by this code.
 * Absence of this key means the migration ran under an older version
 * (before user-tracking was added) and may be tainted.
 */
const MIGRATION_VER = '2';

// All localStorage keys that are user-specific and must be migrated.
const KEYS_TO_MIGRATE = [
  'journalEncryptionMode',
  'cloud_credentials_google-drive_encrypted',
  'cloud_credentials_dropbox_encrypted',
  'cloud_credentials_nextcloud_encrypted',
  'cloud_credentials_icloud_encrypted',
  'google_drive_simple_credentials',
  'dropbox_simple_credentials',
  'icloud_simple_credentials',
  'nextcloud_simple_credentials',
  'ownjournal_encrypted_password',
  'ownjournal_password_persistence_mode',
  'ownjournal_name',
  'preferred_primary_provider',
  'disabled_cloud_providers',
  'connected_providers',
  'cloudSetupDone',
  'theme',
  'autoSyncEnabled',
  'ai_usage_limits',
];

/**
 * One-time migration: copies existing unscoped localStorage keys to the
 * user-scoped keys.  Runs synchronously (localStorage is synchronous).
 *
 * Three safeguards prevent cross-user data leakage:
 * 1. LAST_USER_KEY is updated on EVERY login (before any early return), so the
 *    tracker is always current and the next login can detect a user switch.
 * 2. MIGRATION_VER marks every up-to-date migration.  If a migration from an
 *    older version is detected AND a different user was the most recent caller,
 *    all scoped data is wiped and migration re-runs cleanly.
 * 3. Immediate clear – after copying, unscoped originals are deleted so a
 *    future login from a different user finds nothing to inherit.
 */
export function migrateLocalStorageToUserScope(userId: string): void {
  const migratedFlag = `u:${userId}:_scope_migrated`;
  const migrationVerKey = `u:${userId}:_migration_ver`;

  // ── Step 1: always update the tracker BEFORE any early return ────────────
  // Reading prevLastUserId here captures who was last active on this device.
  const prevLastUserId = localStorage.getItem(LAST_USER_KEY);
  localStorage.setItem(LAST_USER_KEY, userId);

  // ── Step 2: check existing migration state ────────────────────────────────
  const alreadyMigrated = !!localStorage.getItem(migratedFlag);
  const hasCurrentVersion = localStorage.getItem(migrationVerKey) === MIGRATION_VER;

  if (alreadyMigrated && hasCurrentVersion) {
    // Migration is up-to-date – nothing to do.
    return;
  }

  if (alreadyMigrated && !hasCurrentVersion) {
    // Migration ran under older code (no version marker, pre-user-tracking).
    // If a different user was last active, the scoped keys may have been
    // populated from that user's unscoped data.  Wipe and re-run.
    if (prevLastUserId !== null && prevLastUserId !== userId) {
      wipeAllScopedData(userId);
      // Fall through to run a fresh migration below.
    } else {
      // Same user (or no prior tracking) – migration was clean; stamp version.
      localStorage.setItem(migrationVerKey, MIGRATION_VER);
      return;
    }
  }

  // ── Step 3: run (or re-run after wipe) migration ─────────────────────────
  if (prevLastUserId !== null && prevLastUserId !== userId) {
    // A different user was last active.  Their unscoped data does not belong
    // to this user – discard it and skip copying.
    clearUnscopedUserData();
    localStorage.setItem(migratedFlag, 'true');
    localStorage.setItem(migrationVerKey, MIGRATION_VER);
    return;
  }

  // No mismatch (same user or first-ever login): copy unscoped → scoped.
  for (const key of KEYS_TO_MIGRATE) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const scopedK = `u:${userId}:${key}`;
      if (!localStorage.getItem(scopedK)) {
        localStorage.setItem(scopedK, value);
      }
    }
  }

  // Migrate dynamic ai_yearly_entry_* keys
  const keysToProcess: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('ai_yearly_entry_') && !k.startsWith('u:')) {
      keysToProcess.push(k);
    }
  }
  for (const k of keysToProcess) {
    const value = localStorage.getItem(k);
    if (value !== null) {
      const scopedK = `u:${userId}:${k}`;
      if (!localStorage.getItem(scopedK)) {
        localStorage.setItem(scopedK, value);
      }
    }
  }

  // Remove unscoped originals immediately after copying so a future login by
  // a different user finds nothing to inherit via migration.
  clearUnscopedUserData();

  localStorage.setItem(migratedFlag, 'true');
  localStorage.setItem(migrationVerKey, MIGRATION_VER);
}

/** Unscoped keys to clear on sign-out so the next user never sees previous user data. */
const UNSCOPED_KEYS_TO_CLEAR = [...KEYS_TO_MIGRATE, 'tag_cache_version'];

/**
 * Clear all unscoped user-specific localStorage keys. Call on sign-out so that
 * when a different account logs in, migration does not copy the previous
 * user's data into the new user's scoped keys.
 */
export function clearUnscopedUserData(): void {
  for (const key of UNSCOPED_KEYS_TO_CLEAR) {
    localStorage.removeItem(key);
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('ai_yearly_entry_') && !k.startsWith('u:')) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }
}

/**
 * Remove ALL user-scoped localStorage keys for `userId` and delete their
 * IndexedDB databases.  Used when we detect that a previous migration
 * populated scoped keys with another user's unscoped data.
 *
 * After this call:
 * - The user's scoped localStorage is empty.
 * - Both user-scoped IndexedDB databases are scheduled for deletion.
 */
function wipeAllScopedData(userId: string): void {
  const prefix = `u:${userId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }

  // Delete user-scoped IndexedDB databases (fire-and-forget; non-fatal).
  try { indexedDB.deleteDatabase(`JournalDB_${userId}`); } catch { /* non-fatal */ }
  try { indexedDB.deleteDatabase(`ownjournal_ai_metadata_${userId}`); } catch { /* non-fatal */ }
}

