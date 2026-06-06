import { describe, it, expect, beforeEach, vi } from 'vitest';

// detectUserCountry falls back to this edge function only when there is no
// cached/override country; the cache-path tests below never reach it.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: 'unused' } }) } },
}));

import {
  getCachedCountry,
  detectUserCountry,
  clearCountryCache,
} from '../userCountry';

const CACHE_KEY = 'ownjournal_detected_country';

function writeCache(country: string, detectedAt: number) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ country, detectedAt }));
}

describe('userCountry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is cached', () => {
    expect(getCachedCountry()).toBeNull();
  });

  it('returns a fresh cached country', () => {
    writeCache('GB', Date.now());
    expect(getCachedCountry()).toBe('GB');
  });

  it('ignores and clears an expired cache', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    writeCache('GB', thirtyOneDaysAgo);
    expect(getCachedCountry()).toBeNull();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('detectUserCountry short-circuits to the cached value (no network)', async () => {
    writeCache('GB', Date.now());
    await expect(detectUserCountry()).resolves.toBe('GB');
  });

  it('clearCountryCache removes the cached value', () => {
    writeCache('US', Date.now());
    clearCountryCache();
    expect(getCachedCountry()).toBeNull();
  });
});
