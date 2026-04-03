/**
 * Subscription cache for offline Plus access.
 * Stores last known subscription state so Plus features work when the app is offline.
 */

const CACHE_KEY_PREFIX = 'subscription_cache_';

export interface CachedSubscription {
  is_pro: boolean;
  fetched_at: number;
  current_period_end?: string | null;
  subscription_status?: string | null;
  has_used_trial?: boolean;
}

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

/**
 * Get cached subscription for a user, if present and valid.
 * Cache is valid indefinitely for "use last known state when offline";
 * if current_period_end is set and in the past, returns null.
 */
export function getCachedSubscription(userId: string): CachedSubscription | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSubscription;
    if (typeof cached?.is_pro !== 'boolean' || typeof cached?.fetched_at !== 'number') return null;
    if (cached.current_period_end) {
      const end = new Date(cached.current_period_end).getTime();
      if (Number.isNaN(end) || Date.now() > end) {
        // Subscription expired — revoke is_pro but preserve other fields
        // so has_used_trial remains accurate while offline
        return { ...cached, is_pro: false };
      }
    }
    return cached;
  } catch {
    return null;
  }
}

/**
 * Store subscription in cache for the given user.
 */
export function setCachedSubscription(
  userId: string,
  data: { is_pro: boolean; current_period_end?: string | null; subscription_status?: string | null; has_used_trial?: boolean }
): void {
  try {
    const entry: CachedSubscription = {
      is_pro: data.is_pro,
      fetched_at: Date.now(),
      current_period_end: data.current_period_end ?? undefined,
      subscription_status: data.subscription_status ?? undefined,
      has_used_trial: data.has_used_trial ?? undefined,
    };
    localStorage.setItem(cacheKey(userId), JSON.stringify(entry));
  } catch (e) {
    console.warn('Failed to cache subscription:', e);
  }
}
