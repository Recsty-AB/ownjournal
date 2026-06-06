// UK VAT / NETP (non-established taxable person) compliance.
//
// Countries listed here impose a ZERO VAT-registration threshold on B2C
// digital sales by non-established sellers. Recsty AB (the company behind
// OwnJournal) is Swedish and not established in these jurisdictions, so even
// a single direct Stripe sale to a consumer here would create a local
// VAT-registration obligation. Apple and Google remit this VAT themselves on
// in-app purchases, so create-checkout refuses to open a Stripe Checkout
// Session for a user detected in one of these countries.
//
// Extend this list as new zero-threshold jurisdictions are identified.
//
// NOTE: This is the Deno-runtime copy of `src/config/iapOnlyCountries.ts`
// (Edge Functions cannot import from `src/`). Keep the two in sync.
export const IAP_ONLY_COUNTRIES = ["GB"] as const;

// True if the given ISO 3166-1 alpha-2 country code is an IAP-only
// (zero-threshold) jurisdiction. Case-insensitive; null/undefined is false.
export function isIapOnlyCountry(country?: string | null): boolean {
  if (!country) return false;
  return (IAP_ONLY_COUNTRIES as readonly string[]).includes(
    country.toUpperCase(),
  );
}
