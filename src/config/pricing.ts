// Centralized pricing configuration
// Update these values to change subscription prices across the app

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "SEK" | "NOK" | "DKK";

export interface CurrencyPricing {
  yearly: string;
  monthly: string;
  yearlyAmount: number;
  monthlyAmount: number;
}

// Multi-currency pricing based on Stripe configuration
export const PRICING_BY_CURRENCY: Record<CurrencyCode, CurrencyPricing> = {
  USD: { yearly: "$19.99", monthly: "$1.67", yearlyAmount: 19.99, monthlyAmount: 1.67 },
  EUR: { yearly: "€19.99", monthly: "€1.67", yearlyAmount: 19.99, monthlyAmount: 1.67 },
  GBP: { yearly: "£16.99", monthly: "£1.42", yearlyAmount: 16.99, monthlyAmount: 1.42 },
  JPY: { yearly: "¥2,400", monthly: "¥200", yearlyAmount: 2400, monthlyAmount: 200 },
  CAD: { yearly: "CA$24.99", monthly: "CA$2.08", yearlyAmount: 24.99, monthlyAmount: 2.08 },
  SEK: { yearly: "199 kr", monthly: "17 kr", yearlyAmount: 199, monthlyAmount: 17 },
  NOK: { yearly: "199 kr", monthly: "17 kr", yearlyAmount: 199, monthlyAmount: 17 },
  DKK: { yearly: "149 kr", monthly: "12 kr", yearlyAmount: 149, monthlyAmount: 12 },
} as const;

// Map country codes to currencies
export const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  // North America
  US: "USD",
  CA: "CAD",
  
  // UK
  GB: "GBP",
  
  // Japan
  JP: "JPY",
  
  // Scandinavia
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  
  // Eurozone countries
  DE: "EUR", // Germany
  FR: "EUR", // France
  IT: "EUR", // Italy
  ES: "EUR", // Spain
  NL: "EUR", // Netherlands
  BE: "EUR", // Belgium
  AT: "EUR", // Austria
  FI: "EUR", // Finland
  IE: "EUR", // Ireland
  PT: "EUR", // Portugal
  GR: "EUR", // Greece
  LU: "EUR", // Luxembourg
  MT: "EUR", // Malta
  CY: "EUR", // Cyprus
  SK: "EUR", // Slovakia
  SI: "EUR", // Slovenia
  EE: "EUR", // Estonia
  LV: "EUR", // Latvia
  LT: "EUR", // Lithuania
  HR: "EUR", // Croatia
} as const;

// Map timezones to currencies (for offline fallback)
export const TIMEZONE_TO_CURRENCY: Record<string, CurrencyCode> = {
  // Scandinavia
  "Europe/Stockholm": "SEK",
  "Europe/Oslo": "NOK",
  "Europe/Copenhagen": "DKK",
  
  // UK
  "Europe/London": "GBP",
  
  // Japan
  "Asia/Tokyo": "JPY",
  
  // Canada
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "America/Montreal": "CAD",
  "America/Edmonton": "CAD",
  "America/Winnipeg": "CAD",
  "America/Halifax": "CAD",
  
  // Eurozone major cities
  "Europe/Berlin": "EUR",
  "Europe/Paris": "EUR",
  "Europe/Rome": "EUR",
  "Europe/Madrid": "EUR",
  "Europe/Amsterdam": "EUR",
  "Europe/Brussels": "EUR",
  "Europe/Vienna": "EUR",
  "Europe/Helsinki": "EUR",
  "Europe/Dublin": "EUR",
  "Europe/Lisbon": "EUR",
  "Europe/Athens": "EUR",
  "Europe/Luxembourg": "EUR",
} as const;

// Map language codes to default currencies (final fallback)
export const LANGUAGE_TO_CURRENCY: Record<string, CurrencyCode> = {
  en: "USD",
  ja: "JPY",
  de: "EUR",
  fr: "EUR",
  es: "EUR",
  it: "EUR",
  pt: "EUR",
  nl: "EUR",
  pl: "EUR",
  sv: "SEK",
  nb: "NOK",
  da: "DKK",
  fi: "EUR",
  ko: "USD",
  zh: "USD",
  "zh-TW": "USD",
  hi: "USD",
} as const;

// Default pricing (backwards compatibility)
export const PRICING = {
  yearly: {
    amount: 19.99,
    currency: "USD",
    formatted: "$19.99",
  },
  monthly: {
    amount: 1.67,
    currency: "USD",
    formatted: "$1.67",
  },
} as const;

// Helper function to get formatted prices for translations
export const getPricingForTranslation = () => ({
  yearlyPrice: PRICING.yearly.formatted,
  monthlyPrice: PRICING.monthly.formatted,
});
