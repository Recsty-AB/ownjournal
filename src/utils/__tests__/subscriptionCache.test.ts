import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isEntitlementActive,
  getCachedSubscription,
  setCachedSubscription,
} from "../subscriptionCache";

describe("isEntitlementActive", () => {
  it("returns false when is_pro is false regardless of period", () => {
    expect(isEntitlementActive(false, null)).toBe(false);
    expect(isEntitlementActive(false, "2099-01-01T00:00:00Z")).toBe(false);
  });

  it("returns true when is_pro is true and current_period_end is in the future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isEntitlementActive(true, future)).toBe(true);
  });

  it("returns false when is_pro is true but current_period_end is in the past", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isEntitlementActive(true, past)).toBe(false);
  });

  it("returns true when current_period_end is null (open-ended entitlement)", () => {
    expect(isEntitlementActive(true, null)).toBe(true);
    expect(isEntitlementActive(true, undefined)).toBe(true);
  });

  it("does not silently downgrade on unparseable date — over-grant on bad data", () => {
    expect(isEntitlementActive(true, "not-a-date")).toBe(true);
  });
});

describe("getCachedSubscription", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("returns null when no cache exists", () => {
    expect(getCachedSubscription("user-1")).toBeNull();
  });

  it("returns the cached entry when period is in the future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    setCachedSubscription("user-1", {
      is_pro: true,
      current_period_end: future,
      subscription_status: "active",
      has_used_trial: true,
      provider: "apple",
    });
    const cached = getCachedSubscription("user-1");
    expect(cached?.is_pro).toBe(true);
    expect(cached?.subscription_status).toBe("active");
  });

  it("downgrades is_pro to false when current_period_end is in the past, preserving other fields", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    setCachedSubscription("user-1", {
      is_pro: true,
      current_period_end: future,
      subscription_status: "trialing",
      has_used_trial: true,
      provider: "apple",
    });
    // Advance the clock past the period end
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000));
    const cached = getCachedSubscription("user-1");
    expect(cached?.is_pro).toBe(false);
    expect(cached?.has_used_trial).toBe(true);
    expect(cached?.subscription_status).toBe("trialing");
    expect(cached?.provider).toBe("apple");
  });

  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem("subscription_cache_user-1", "not-json");
    expect(getCachedSubscription("user-1")).toBeNull();
  });
});
