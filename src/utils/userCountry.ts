import { supabase } from "@/integrations/supabase/client";

/**
 * Detects the user's country (ISO 3166-1 alpha-2, uppercase) via IP
 * geolocation, used for UK VAT / NETP compliance routing (see
 * `@/config/iapOnlyCountries`). Mirrors the currency-detection cache in
 * `locationPricing.ts`.
 *
 * The authoritative billing-country check lives server-side in the
 * create-checkout Edge Function; this client signal only decides which CTA
 * to show.
 */

const CACHE_KEY = "ownjournal_detected_country";
const CACHE_EXPIRY_DAYS = 30;
// DEV-only override so a UK user can be simulated without a VPN.
const DEBUG_KEY = "ownjournal_debug_country";

interface CachedCountry {
  country: string;
  detectedAt: number;
}

/**
 * DEV-only country override. Honors `?debugCountry=GB` (which it persists to
 * localStorage) and `localStorage['ownjournal_debug_country']`. Always
 * returns null in production builds.
 */
function getDebugCountry(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("debugCountry");
      if (param) {
        localStorage.setItem(DEBUG_KEY, param.toUpperCase());
        return param.toUpperCase();
      }
    }
    const stored = localStorage.getItem(DEBUG_KEY);
    return stored ? stored.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Synchronously read the cached (or DEV-overridden) country, or null.
 * Used as a cheap defense-in-depth check before initiating Stripe checkout.
 */
export function getCachedCountry(): string | null {
  const debug = getDebugCountry();
  if (debug) return debug;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CachedCountry = JSON.parse(cached);
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - data.detectedAt > expiryMs) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data.country;
  } catch {
    return null;
  }
}

function cacheCountry(country: string): void {
  try {
    const data: CachedCountry = { country, detectedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Resolve the user's country: DEV override -> cache -> IP geolocation edge
 * function. Returns null if it can't be determined (caller should treat
 * unknown as non-IAP-only / show the default flow).
 */
export async function detectUserCountry(): Promise<string | null> {
  const debug = getDebugCountry();
  if (debug) return debug;

  const cached = getCachedCountry();
  if (cached) return cached;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("detect-location");
    if (error || !data?.country) {
      if (import.meta.env.DEV) {
        console.log("Country detection failed:", error?.message || "no country returned");
      }
      return null;
    }
    const country = String(data.country).toUpperCase();
    cacheCountry(country);
    return country;
  } catch (err) {
    if (import.meta.env.DEV) console.log("Country detection error:", err);
    return null;
  }
}

/** Clear the cached country (useful for testing). */
export function clearCountryCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
