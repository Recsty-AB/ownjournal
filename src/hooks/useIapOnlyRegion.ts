import { useState, useEffect } from "react";
import { isIapOnlyCountry } from "@/config/iapOnlyCountries";
import { detectUserCountry, getCachedCountry } from "@/utils/userCountry";

interface IapOnlyRegion {
  /** True once we know the user is in a zero-VAT-threshold (IAP-only) country. */
  isIapOnly: boolean;
  /** True while the country is still being detected. */
  isLoading: boolean;
  /** Detected ISO country code, or null if unknown. */
  country: string | null;
}

/**
 * UK VAT / NETP compliance hook. Detects whether the current user is in a
 * country where we must NOT offer direct Stripe checkout (see
 * `@/config/iapOnlyCountries`) and instead route them to the App Store /
 * Play Store IAP path.
 *
 * Seeds synchronously from the cached/DEV-override country so a known UK user
 * never sees the Stripe CTA flash, then confirms via IP geolocation.
 */
export function useIapOnlyRegion(): IapOnlyRegion {
  const [country, setCountry] = useState<string | null>(() => getCachedCountry());
  const [isLoading, setIsLoading] = useState<boolean>(() => getCachedCountry() === null);

  useEffect(() => {
    let mounted = true;

    detectUserCountry()
      .then((detected) => {
        if (mounted) setCountry(detected);
      })
      .catch(() => {
        // Unknown country -> treated as non-IAP-only (default Stripe flow).
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    isIapOnly: isIapOnlyCountry(country),
    isLoading,
    country,
  };
}
