/**
 * IAP Service
 *
 * Thin abstraction over the native In-App Purchase stack (StoreKit 2 on iOS,
 * Google Play Billing on Android) via RevenueCat. The rest of the app must
 * not import @revenuecat/purchases-capacitor directly — go through this file
 * so we can swap or mock the underlying SDK.
 *
 * On web/electron every method short-circuits: getProducts() returns [],
 * purchase()/restore() reject with NOT_AVAILABLE. Stripe remains the only
 * purchase path on those surfaces.
 *
 * Cross-platform entitlement: init(userId) calls Purchases.logIn(userId)
 * so the RevenueCat → Supabase webhook carries the same user_id we use in
 * auth.users — an Apple purchase therefore unlocks Plus on web (and
 * vice-versa via Stripe → web).
 */

import { getPlatformInfo } from '@/utils/platformDetection';

export type IAPProvider = 'apple' | 'google';

export interface IAPProduct {
  productId: string;
  /** Localized price string from the OS, e.g. "$19.99", "€19,99", "¥2,400". */
  priceFormatted: string;
  /** Price in micro-units of the currency (e.g. 19_990_000 for $19.99). */
  priceAmountMicros: number;
  currencyCode: string;
  introOffer: { kind: 'free_trial'; periodDays: number } | null;
}

export interface IAPEntitlement {
  isPro: boolean;
  expiresAt: Date | null;
  willRenew: boolean;
  provider: IAPProvider | null;
  productId: string | null;
  isInTrial: boolean;
}

export type IAPErrorCode =
  | 'NOT_AVAILABLE'
  | 'NOT_INITIALIZED'
  | 'USER_CANCELLED'
  | 'NETWORK'
  | 'PRODUCT_UNAVAILABLE'
  | 'PURCHASE_INVALID'
  | 'INELIGIBLE'
  | 'UNKNOWN';

export class IAPError extends Error {
  constructor(public code: IAPErrorCode, message: string, public underlying?: unknown) {
    super(message);
    this.name = 'IAPError';
  }
}

export const PLUS_ENTITLEMENT_ID = 'plus';
export const PLUS_PRODUCT_ID_IOS = 'app.ownjournal.plus.yearly.v1';
export const PLUS_PRODUCT_ID_ANDROID = 'app.ownjournal.plus.yearly';

const EMPTY_ENTITLEMENT: IAPEntitlement = {
  isPro: false,
  expiresAt: null,
  willRenew: false,
  provider: null,
  productId: null,
  isInTrial: false,
};

interface RuntimeState {
  initialized: boolean;
  userId: string | null;
}

const state: RuntimeState = {
  initialized: false,
  userId: null,
};

// In-flight init promise so callers (e.g. the paywall mounting before init
// resolves) can await readiness instead of racing. `lastInitError` keeps the
// real reason a prior init() failed so methods surface it instead of a generic
// "init() not called".
let initPromise: Promise<void> | null = null;
let lastInitError: unknown = null;

function isNative(): boolean {
  const { platform } = getPlatformInfo();
  return platform === 'capacitor-ios' || platform === 'capacitor-android';
}

function platformApiKey(): string | null {
  const { platform } = getPlatformInfo();
  if (platform === 'capacitor-ios') return import.meta.env.VITE_REVENUECAT_IOS_KEY ?? null;
  if (platform === 'capacitor-android') return import.meta.env.VITE_REVENUECAT_ANDROID_KEY ?? null;
  return null;
}

function platformProductId(): string {
  return getPlatformInfo().platform === 'capacitor-ios' ? PLUS_PRODUCT_ID_IOS : PLUS_PRODUCT_ID_ANDROID;
}

async function loadPurchases() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  // Return the plugin wrapped in a plain object. A Capacitor plugin proxy
  // returns a callable for ANY property access — including `.then` — so it
  // looks "thenable". Returning it bare from an async function makes the JS
  // runtime try to unwrap it via `Purchases.then(resolve, reject)`, which
  // dispatches a native call to a non-existent `then` method and crashes with
  // `"Purchases.then()" is not implemented`. Wrapping it avoids that.
  return { Purchases };
}

/** Run the actual RevenueCat configure/logIn for `userId`. */
async function doInit(userId: string): Promise<void> {
  const apiKey = platformApiKey();
  if (!apiKey) {
    throw new IAPError('NOT_INITIALIZED',
      'RevenueCat API key missing. Set VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY.');
  }

  const { Purchases } = await loadPurchases();
  if (!state.initialized) {
    if (import.meta.env.DEV) {
      const { LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
      try { await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }); } catch { /* non-fatal */ }
    }
    await Purchases.configure({ apiKey, appUserID: userId });
    state.initialized = true;
  } else if (state.userId !== userId) {
    await Purchases.logIn({ appUserID: userId });
  }
  state.userId = userId;
}

/**
 * Block until init has completed. Awaits an in-flight init() (so a method
 * called before init resolves waits rather than throwing), and re-throws the
 * real init error so callers see the underlying reason. Throws NOT_INITIALIZED
 * only when init() was never attempted (e.g. no signed-in user).
 */
async function ensureInitialized(): Promise<void> {
  if (state.initialized) return;
  if (initPromise) { await initPromise; return; }
  if (lastInitError) throw lastInitError;
  throw new IAPError('NOT_INITIALIZED', 'iapService.init() not called');
}

function mapStore(store: string | undefined): IAPProvider | null {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'apple';
  if (store === 'PLAY_STORE') return 'google';
  return null;
}

function deriveEntitlement(customerInfo: unknown): IAPEntitlement {
  const info = customerInfo as {
    entitlements?: { active?: Record<string, {
      isActive?: boolean;
      willRenew?: boolean;
      periodType?: string;
      expirationDate?: string | null;
      productIdentifier?: string;
      store?: string;
    }> };
  } | undefined;
  const ent = info?.entitlements?.active?.[PLUS_ENTITLEMENT_ID];
  if (!ent || !ent.isActive) return EMPTY_ENTITLEMENT;
  return {
    isPro: true,
    expiresAt: ent.expirationDate ? new Date(ent.expirationDate) : null,
    willRenew: !!ent.willRenew,
    provider: mapStore(ent.store),
    productId: ent.productIdentifier ?? null,
    isInTrial: ent.periodType === 'TRIAL',
  };
}

function findPlusPackage(offerings: unknown): {
  pkg: unknown;
  product: { identifier: string; priceString: string; price: number; currencyCode: string;
    introPrice?: { periodNumberOfUnits: number; periodUnit: string } | null } | null;
} | null {
  const o = offerings as {
    current?: { availablePackages?: Array<{
      identifier: string;
      product?: { identifier: string; priceString: string; price: number; currencyCode: string;
        introPrice?: { periodNumberOfUnits: number; periodUnit: string } | null };
    }> };
  } | undefined;
  const pkgs = o?.current?.availablePackages ?? [];
  // Prefer the package matching our product ID; fall back to the first annual package.
  const wantedId = platformProductId();
  const exact = pkgs.find((p) => p.product?.identifier === wantedId);
  const candidate = exact ?? pkgs.find((p) => /\$rc_annual|annual|yearly/i.test(p.identifier));
  if (!candidate) return null;
  return { pkg: candidate, product: candidate.product ?? null };
}

function introOfferToDays(intro: { periodNumberOfUnits: number; periodUnit: string } | null | undefined):
  IAPProduct['introOffer'] {
  if (!intro) return null;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit?.toUpperCase()) {
    case 'DAY': return { kind: 'free_trial', periodDays: n };
    case 'WEEK': return { kind: 'free_trial', periodDays: n * 7 };
    case 'MONTH': return { kind: 'free_trial', periodDays: n * 30 };
    case 'YEAR': return { kind: 'free_trial', periodDays: n * 365 };
    default: return null;
  }
}

export const iapService = {
  isAvailable(): boolean {
    return isNative();
  },

  async init(userId: string): Promise<void> {
    if (!isNative()) return;
    if (state.initialized && state.userId === userId) return;

    // Store the in-flight promise so concurrent callers await readiness. On
    // failure, clear it (and remember the error) so the next init() retries —
    // a transient configure error then self-heals on the next paywall open.
    initPromise = doInit(userId)
      .then(() => { lastInitError = null; })
      .catch((err) => { lastInitError = err; initPromise = null; throw err; });
    return initPromise;
  },

  async logOut(): Promise<void> {
    if (!isNative() || !state.initialized) return;
    const { Purchases } = await loadPurchases();
    try { await Purchases.logOut(); } catch { /* benign — anonymous already */ }
    state.userId = null;
  },

  async getProducts(): Promise<IAPProduct[]> {
    if (!isNative()) return [];
    await ensureInitialized();
    const { Purchases } = await loadPurchases();
    const offerings = await Purchases.getOfferings();
    const found = findPlusPackage(offerings);
    if (!found?.product) return [];
    const p = found.product;
    return [{
      productId: p.identifier,
      priceFormatted: p.priceString,
      priceAmountMicros: Math.round(p.price * 1_000_000),
      currencyCode: p.currencyCode,
      introOffer: introOfferToDays(p.introPrice ?? null),
    }];
  },

  async purchase(): Promise<IAPEntitlement> {
    if (!isNative()) throw new IAPError('NOT_AVAILABLE', 'IAP not available on this platform');
    await ensureInitialized();

    const { Purchases } = await loadPurchases();
    const offerings = await Purchases.getOfferings();
    const found = findPlusPackage(offerings);
    if (!found?.pkg) throw new IAPError('PRODUCT_UNAVAILABLE', 'Plus package not configured in RevenueCat offering');

    try {
      const result = await Purchases.purchasePackage({ aPackage: found.pkg as never });
      return deriveEntitlement(result.customerInfo);
    } catch (err) {
      const e = err as { code?: string; userCancelled?: boolean; message?: string };
      if (e.userCancelled) throw new IAPError('USER_CANCELLED', 'User cancelled purchase', err);
      throw new IAPError('UNKNOWN', e.message ?? 'Purchase failed', err);
    }
  },

  async restore(): Promise<IAPEntitlement> {
    if (!isNative()) throw new IAPError('NOT_AVAILABLE', 'IAP not available on this platform');
    await ensureInitialized();
    const { Purchases } = await loadPurchases();
    const { customerInfo } = await Purchases.restorePurchases();
    return deriveEntitlement(customerInfo);
  },

  async getActiveEntitlement(): Promise<IAPEntitlement> {
    if (!isNative()) return EMPTY_ENTITLEMENT;
    try { await ensureInitialized(); } catch { return EMPTY_ENTITLEMENT; }
    const { Purchases } = await loadPurchases();
    const { customerInfo } = await Purchases.getCustomerInfo();
    return deriveEntitlement(customerInfo);
  },

  /**
   * Trial eligibility per Apple/Google rules — the stores enforce one-trial-per-account
   * regardless of what our `has_used_trial` flag says. Use this to decide whether to
   * show "14 days free" copy on the paywall.
   */
  async isEligibleForTrial(): Promise<boolean> {
    if (!isNative()) return false;
    try {
      await ensureInitialized();
      const { Purchases } = await loadPurchases();
      const productId = platformProductId();
      const res = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [productId] });
      const entry = (res as Record<string, { status: number }>)[productId];
      // status === 1 (UNKNOWN) or 2 (INELIGIBLE) → not eligible. 3 (ELIGIBLE) → eligible.
      return entry?.status === 3;
    } catch {
      return false;
    }
  },

  async openManageSubscription(): Promise<void> {
    if (!isNative()) throw new IAPError('NOT_AVAILABLE', 'IAP not available on this platform');
    const { platform } = getPlatformInfo();
    const provider: IAPProvider = platform === 'capacitor-ios' ? 'apple' : 'google';
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: getStoreSubscriptionUrl(provider) });
  },
};

/**
 * Returns the platform's "manage subscription" URL for a given provider.
 * Web/desktop callers can use this directly with window.open(); native
 * callers should prefer iapService.openManageSubscription() so the
 * Capacitor in-app browser is used.
 */
export function getStoreSubscriptionUrl(provider: IAPProvider): string {
  if (provider === 'apple') return 'https://apps.apple.com/account/subscriptions';
  return `https://play.google.com/store/account/subscriptions?sku=${PLUS_PRODUCT_ID_ANDROID}&package=app.ownjournal`;
}
