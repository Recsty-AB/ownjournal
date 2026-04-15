/**
 * Local AI settings — user-facing preferences for on-device vs cloud
 * inference, stored per-user in localStorage via userScope.scopedKey.
 *
 * This module is also a **reactive store**: components subscribe via
 * `useLocalAISettings()` (which uses `useSyncExternalStore` under the
 * hood) and are re-rendered whenever any caller flips a preference.
 * This fixes the bug where `useAIMode` returned stale values after a
 * settings change because `useMemo` could not track external state.
 */

import { LocalAIModelId } from '@/config/localAIModels';
import { scopedKey } from '@/utils/userScope';

export type AIMode = 'cloud' | 'local';

export interface LocalAIPreferences {
  /** Schema version, bumped when the shape changes. */
  version: number;
  /**
   * Which AI path to use by default. 'cloud' is the default for every
   * user; 'local' is opt-in and requires an available model.
   */
  mode: AIMode;
  /**
   * Which on-device model the user has selected. Only meaningful when
   * mode === 'local'. May reference a model that is not yet downloaded.
   */
  selectedModel: LocalAIModelId | null;
  /**
   * When true, local-mode features refuse to fall back to cloud even
   * when local inference is unavailable or fails. Privacy-strict mode.
   * Defaults to false — most users want "try local, fall back if
   * needed" rather than "disable the feature entirely".
   */
  localOnly: boolean;
  /**
   * Timestamp when the user last downloaded or verified the selected
   * model. Used by the Settings UI to show "last verified" info.
   */
  lastVerifiedAt: number | null;
}

const STORAGE_KEY = 'local_ai_prefs_v1';
const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_PREFS: LocalAIPreferences = {
  version: CURRENT_SCHEMA_VERSION,
  mode: 'cloud',
  selectedModel: null,
  localOnly: false,
  lastVerifiedAt: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * In-memory cache so `getLocalAIPreferences()` is a cheap synchronous
 * read (required by `useSyncExternalStore`). Rehydrated from
 * localStorage on first read and whenever `setLocalAIPreferences`
 * writes.
 */
let cachedPrefs: LocalAIPreferences | null = null;
let cachedForKey: string | null = null;

function readFromStorage(): LocalAIPreferences {
  const key = scopedKey(STORAGE_KEY);
  if (cachedPrefs !== null && cachedForKey === key) return cachedPrefs;
  cachedForKey = key;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      cachedPrefs = { ...DEFAULT_PREFS };
      return cachedPrefs;
    }
    const parsed = JSON.parse(raw) as Partial<LocalAIPreferences>;
    cachedPrefs = migrate(parsed);
    return cachedPrefs;
  } catch {
    cachedPrefs = { ...DEFAULT_PREFS };
    return cachedPrefs;
  }
}

/**
 * Migrate older stored shapes to the current schema version. Called
 * whenever raw storage is read. Missing fields fall back to defaults.
 */
function migrate(parsed: Partial<LocalAIPreferences>): LocalAIPreferences {
  return {
    version: CURRENT_SCHEMA_VERSION,
    mode: parsed.mode === 'local' ? 'local' : 'cloud',
    selectedModel: parsed.selectedModel ?? null,
    localOnly: parsed.localOnly === true,
    lastVerifiedAt:
      typeof parsed.lastVerifiedAt === 'number' ? parsed.lastVerifiedAt : null,
  };
}

/**
 * Read the current user's local AI preferences. Synchronous, cached,
 * safe to call from render.
 */
export function getLocalAIPreferences(): LocalAIPreferences {
  return readFromStorage();
}

/**
 * Persist updated preferences. Merges with existing values so callers
 * can supply a partial update. Notifies all subscribers synchronously
 * so React components re-render in the same tick.
 */
export function setLocalAIPreferences(
  patch: Partial<LocalAIPreferences>,
): LocalAIPreferences {
  const current = readFromStorage();
  const next: LocalAIPreferences = {
    ...current,
    ...patch,
    version: CURRENT_SCHEMA_VERSION,
  };
  cachedPrefs = next;
  cachedForKey = scopedKey(STORAGE_KEY);
  try {
    localStorage.setItem(cachedForKey, JSON.stringify(next));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to persist local AI preferences:', error);
    }
  }
  notify();
  return next;
}

/**
 * Clear all local AI preferences for the current user (e.g., on
 * sign-out or account deletion). Does not touch the downloaded model
 * cache — that is managed by the generative service.
 */
export function clearLocalAIPreferences(): void {
  const key = scopedKey(STORAGE_KEY);
  try {
    localStorage.removeItem(key);
  } catch {
    // best-effort
  }
  cachedPrefs = { ...DEFAULT_PREFS };
  cachedForKey = key;
  notify();
}

/**
 * Force a re-read from storage. Call when the active user changes
 * (e.g., after sign-in) so subsequent `getLocalAIPreferences` calls
 * return the new user's cached state.
 */
export function invalidateLocalAIPreferencesCache(): void {
  cachedPrefs = null;
  cachedForKey = null;
  notify();
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      if (import.meta.env.DEV) console.error('localAISettings listener error:', error);
    }
  }
}

/**
 * Subscribe to preference changes. Returns an unsubscribe function.
 * Consumed by `useSyncExternalStore` in `useLocalAISettings`.
 */
export function subscribeLocalAIPreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
