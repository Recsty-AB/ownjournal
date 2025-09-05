import { supabase } from "@/integrations/supabase/client";
import {
  CurrencyCode,
  COUNTRY_TO_CURRENCY,
  TIMEZONE_TO_CURRENCY,
  LANGUAGE_TO_CURRENCY,
} from "@/config/pricing";

const CACHE_KEY = "ownjournal_detected_currency";
const CACHE_EXPIRY_DAYS = 30;

interface CachedCurrency {
  currency: CurrencyCode;
  detectedAt: number;
  method: "ip" | "timezone" | "language";
}

/**
 * Get cached currency from localStorage
 */
export function getCachedCurrency(): CurrencyCode | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CachedCurrency = JSON.parse(cached);
    const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    // Check if cache has expired
    if (Date.now() - data.detectedAt > expiryMs) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data.currency;
  } catch {
    return null;
  }
}

/**
 * Cache the detected currency in localStorage
 */
export function cacheCurrency(currency: CurrencyCode, method: CachedCurrency["method"]): void {
  try {
    const data: CachedCurrency = {
      currency,
      detectedAt: Date.now(),
      method,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Detect currency from IP geolocation via edge function
 */
export async function detectCurrencyFromIP(): Promise<CurrencyCode | null> {
  try {
    const { data, error } = await supabase.functions.invoke("detect-location");
    
    if (error || !data?.country) {
      console.log("IP geolocation failed:", error?.message || "No country returned");
      return null;
    }

    const country = data.country as string;
    const currency = COUNTRY_TO_CURRENCY[country];
    
    if (currency) {
      return currency;
    }
    
    // Unknown country - default to USD
    return "USD";
  } catch (err) {
    console.log("IP geolocation error:", err);
    return null;
  }
}

/**
 * Detect currency from browser timezone
 */
export function detectCurrencyFromTimezone(): CurrencyCode | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    if (!timezone) return null;

    // Direct timezone match
    const directMatch = TIMEZONE_TO_CURRENCY[timezone];
    if (directMatch) return directMatch;

    // Try to match by region prefix (e.g., "America/..." likely USD)
    if (timezone.startsWith("America/")) {
      // Check if it's a Canadian timezone
      const canadianTimezones = [
        "America/Toronto",
        "America/Vancouver",
        "America/Montreal",
        "America/Edmonton",
        "America/Winnipeg",
        "America/Halifax",
        "America/St_Johns",
        "America/Regina",
      ];
      if (canadianTimezones.includes(timezone)) {
        return "CAD";
      }
      return "USD";
    }

    if (timezone.startsWith("Europe/")) {
      // Default European timezone to EUR
      return "EUR";
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get currency from language code
 */
export function getCurrencyFromLanguage(language: string): CurrencyCode {
  // Handle language codes with region (e.g., "en-US", "zh-TW")
  const langCode = language.split("-")[0].toLowerCase();
  const fullCode = language.toLowerCase();

  // Check full code first (for cases like "zh-TW")
  if (fullCode in LANGUAGE_TO_CURRENCY) {
    return LANGUAGE_TO_CURRENCY[fullCode as keyof typeof LANGUAGE_TO_CURRENCY];
  }

  // Then check base language code
  if (langCode in LANGUAGE_TO_CURRENCY) {
    return LANGUAGE_TO_CURRENCY[langCode as keyof typeof LANGUAGE_TO_CURRENCY];
  }

  return "USD";
}

/**
 * Main detection function with cascading fallback
 * Priority: 1. Cache → 2. IP Geolocation → 3. Timezone → 4. Language
 */
export async function detectUserCurrency(currentLanguage: string): Promise<CurrencyCode> {
  // 1. Check localStorage cache first (instant, works offline)
  const cached = getCachedCurrency();
  if (cached) {
    return cached;
  }

  // 2. Try IP geolocation if online
  if (typeof navigator !== "undefined" && navigator.onLine) {
    const ipCurrency = await detectCurrencyFromIP();
    if (ipCurrency) {
      cacheCurrency(ipCurrency, "ip");
      return ipCurrency;
    }
  }

  // 3. Try browser timezone detection
  const timezoneCurrency = detectCurrencyFromTimezone();
  if (timezoneCurrency) {
    cacheCurrency(timezoneCurrency, "timezone");
    return timezoneCurrency;
  }

  // 4. Final fallback: use language setting
  const languageCurrency = getCurrencyFromLanguage(currentLanguage);
  cacheCurrency(languageCurrency, "language");
  return languageCurrency;
}

/**
 * Clear the cached currency (useful for testing)
 */
export function clearCurrencyCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
