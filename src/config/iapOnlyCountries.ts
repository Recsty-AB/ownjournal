/**
 * UK VAT / NETP (non-established taxable person) compliance.
 *
 * Countries listed here impose a ZERO VAT-registration threshold on B2C
 * digital sales by non-established sellers. Recsty AB (the company behind
 * OwnJournal) is Swedish and not established in these jurisdictions, so even
 * a single direct Stripe sale to a consumer here would create a local
 * VAT-registration obligation. Apple and Google remit this VAT themselves on
 * in-app purchases, so users detected in these countries are routed to the
 * App Store / Play Store IAP path and are never offered direct Stripe
 * checkout.
 *
 * Extend this list as new zero-threshold jurisdictions are identified.
 *
 * NOTE: Edge Functions run on Deno and cannot import from `src/`, so this
 * constant is intentionally duplicated in
 * `supabase/functions/_shared/iapOnlyCountries.ts`. Keep the two in sync.
 */
export const IAP_ONLY_COUNTRIES = ["GB"] as const;

export type IapOnlyCountry = (typeof IAP_ONLY_COUNTRIES)[number];

/**
 * True if the given ISO 3166-1 alpha-2 country code is an IAP-only
 * (zero-threshold) jurisdiction. Case-insensitive; null/undefined is false.
 */
export function isIapOnlyCountry(country?: string | null): boolean {
  if (!country) return false;
  return (IAP_ONLY_COUNTRIES as readonly string[]).includes(
    country.toUpperCase()
  );
}
