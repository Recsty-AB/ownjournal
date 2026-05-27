/**
 * Subscription cache for offline Plus access.
 * Stores last known subscription state so Plus features work when the app is offline.
 */

const CACHE_KEY_PREFIX = 'subscription_cache_';

export type SubscriptionProvider = 'stripe' | 'apple' | 'google';

export interface CachedSubscription {
  is_pro: boolean;
  fetched_at: number;
  current_period_end?: string | null;
  subscription_status?: string | null;
  has_used_trial?: boolean;
  provider?: SubscriptionProvider | null;
}

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

/**
 * Derive effective entitlement from `(is_pro, current_period_end)`.
 *
 * Both the cache (offline read) and the live Supabase fetch use this so a
 * stale `is_pro=true` row whose period has already ended doesn't grant Plus.
 * Without this, missed RevenueCat/Stripe webhooks leave clients (and the
 * `ai-analyze` server gate) believing an expired user is still Pro.
 *
 * `null` end is treated as open-ended (lifetime/manual). Unparseable date
 * does NOT downgrade — we'd rather over-grant on bad data than yank Plus
 * from a paying user because of a serialization quirk.
 */
export function isEntitlementActive(
  isPro: boolean,
  currentPeriodEnd: string | null | undefined,
): boolean {
  if (!isPro) return false;
  if (!currentPeriodEnd) return true;
  const end = new Date(currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return true;
  return Date.now() <= end;
}

/**
 * Get cached subscription for a user, if present and valid.
 * Cache is valid indefinitely for "use last known state when offline";
 * if current_period_end is set and in the past, is_pro is downgraded to
 * false on read (other fields preserved so has_used_trial stays accurate).
 */
export function getCachedSubscription(userId: string): CachedSubscription | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSubscription;
    if (typeof cached?.is_pro !== 'boolean' || typeof cached?.fetched_at !== 'number') return null;
    const active = isEntitlementActive(cached.is_pro, cached.current_period_end);
    return active ? cached : { ...cached, is_pro: false };
  } catch {
    return null;
  }
}

/**
 * Store subscription in cache for the given user.
 */
export function setCachedSubscription(
  userId: string,
  data: {
    is_pro: boolean;
    current_period_end?: string | null;
    subscription_status?: string | null;
    has_used_trial?: boolean;
    provider?: SubscriptionProvider | null;
  }
): void {
  try {
    const entry: CachedSubscription = {
      is_pro: data.is_pro,
      fetched_at: Date.now(),
      current_period_end: data.current_period_end ?? undefined,
      subscription_status: data.subscription_status ?? undefined,
      has_used_trial: data.has_used_trial ?? undefined,
      provider: data.provider ?? undefined,
    };
    localStorage.setItem(cacheKey(userId), JSON.stringify(entry));
  } catch (e) {
    console.warn('Failed to cache subscription:', e);
  }
}
