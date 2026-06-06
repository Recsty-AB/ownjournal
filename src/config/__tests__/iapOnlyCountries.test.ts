import { describe, it, expect } from 'vitest';
import { IAP_ONLY_COUNTRIES, isIapOnlyCountry } from '../iapOnlyCountries';

describe('iapOnlyCountries', () => {
  it('includes GB (UK VAT / NETP)', () => {
    expect(IAP_ONLY_COUNTRIES).toContain('GB');
  });

  it('matches GB case-insensitively', () => {
    expect(isIapOnlyCountry('GB')).toBe(true);
    expect(isIapOnlyCountry('gb')).toBe(true);
    expect(isIapOnlyCountry('Gb')).toBe(true);
  });

  it('does not match other countries', () => {
    expect(isIapOnlyCountry('US')).toBe(false);
    expect(isIapOnlyCountry('DE')).toBe(false);
    expect(isIapOnlyCountry('SE')).toBe(false);
  });

  it('treats null/undefined/empty as not IAP-only', () => {
    expect(isIapOnlyCountry(null)).toBe(false);
    expect(isIapOnlyCountry(undefined)).toBe(false);
    expect(isIapOnlyCountry('')).toBe(false);
  });
});
