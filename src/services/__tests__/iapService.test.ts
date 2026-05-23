import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable platform — flipped between tests via setPlatform() below.
type Platform = 'web' | 'capacitor-ios' | 'capacitor-android';
let currentPlatform: Platform = 'web';
function setPlatform(p: Platform) { currentPlatform = p; }

vi.mock('@/utils/platformDetection', () => ({
  getPlatformInfo: () => ({
    platform: currentPlatform,
    category: currentPlatform === 'web' ? 'web' : 'mobile',
    isWeb: currentPlatform === 'web',
    isMobile: currentPlatform !== 'web',
    isDesktop: false,
    isCapacitor: currentPlatform !== 'web',
    isElectron: false,
    supportsPopupOAuth: currentPlatform === 'web',
    supportsDeepLinking: currentPlatform !== 'web',
    supportsNativeFileSystem: false,
    deviceId: 'test-device',
  }),
}));

// Hoisted so we can reach into the mock from each test.
const purchasesMock = vi.hoisted(() => ({
  configure: vi.fn().mockResolvedValue(undefined),
  logIn: vi.fn().mockResolvedValue(undefined),
  logOut: vi.fn().mockResolvedValue(undefined),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  getCustomerInfo: vi.fn(),
  checkTrialOrIntroductoryPriceEligibility: vi.fn(),
  setLogLevel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: purchasesMock,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

const browserOpenMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@capacitor/browser', () => ({
  Browser: { open: browserOpenMock },
}));

/**
 * iapService keeps singleton init state at module scope. Reload it for each
 * test so init()/state.initialized doesn't bleed between cases.
 */
async function loadIapService() {
  vi.resetModules();
  return await import('../iapService');
}

beforeEach(() => {
  setPlatform('web');
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('iapService.isAvailable', () => {
  it('returns false on web', async () => {
    setPlatform('web');
    const { iapService } = await loadIapService();
    expect(iapService.isAvailable()).toBe(false);
  });

  it('returns true on iOS', async () => {
    setPlatform('capacitor-ios');
    const { iapService } = await loadIapService();
    expect(iapService.isAvailable()).toBe(true);
  });

  it('returns true on Android', async () => {
    setPlatform('capacitor-android');
    const { iapService } = await loadIapService();
    expect(iapService.isAvailable()).toBe(true);
  });
});

describe('iapService web no-ops', () => {
  it('getProducts returns [] without throwing', async () => {
    setPlatform('web');
    const { iapService } = await loadIapService();
    await expect(iapService.getProducts()).resolves.toEqual([]);
  });

  it('purchase rejects with NOT_AVAILABLE', async () => {
    setPlatform('web');
    const { iapService, IAPError } = await loadIapService();
    await expect(iapService.purchase()).rejects.toBeInstanceOf(IAPError);
    await expect(iapService.purchase()).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
  });

  it('restore rejects with NOT_AVAILABLE', async () => {
    setPlatform('web');
    const { iapService, IAPError } = await loadIapService();
    await expect(iapService.restore()).rejects.toBeInstanceOf(IAPError);
    await expect(iapService.restore()).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
  });

  it('getActiveEntitlement returns empty entitlement on web', async () => {
    setPlatform('web');
    const { iapService } = await loadIapService();
    const ent = await iapService.getActiveEntitlement();
    expect(ent.isPro).toBe(false);
    expect(ent.provider).toBeNull();
  });

  it('isEligibleForTrial returns false on web', async () => {
    setPlatform('web');
    const { iapService } = await loadIapService();
    await expect(iapService.isEligibleForTrial()).resolves.toBe(false);
  });

  it('init is a no-op on web (does not throw)', async () => {
    setPlatform('web');
    const { iapService } = await loadIapService();
    await expect(iapService.init('user-1')).resolves.toBeUndefined();
    expect(purchasesMock.configure).not.toHaveBeenCalled();
  });
});

describe('iapService.init on iOS', () => {
  it('throws NOT_INITIALIZED when API key is missing', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', '');
    const { iapService, IAPError } = await loadIapService();
    await expect(iapService.init('user-1')).rejects.toBeInstanceOf(IAPError);
    await expect(iapService.init('user-1')).rejects.toMatchObject({ code: 'NOT_INITIALIZED' });
  });

  it('configures Purchases with the iOS key', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key_xxx');
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    expect(purchasesMock.configure).toHaveBeenCalledWith({ apiKey: 'ios_key_xxx', appUserID: 'user-1' });
  });

  it('switches user via logIn when called again with a different userId', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key_xxx');
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    await iapService.init('user-2');
    expect(purchasesMock.configure).toHaveBeenCalledTimes(1);
    expect(purchasesMock.logIn).toHaveBeenCalledWith({ appUserID: 'user-2' });
  });
});

describe('iapService.getProducts on iOS', () => {
  it('returns the Plus product with a 14-day trial intro offer', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key_xxx');
    purchasesMock.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [{
          identifier: '$rc_annual',
          product: {
            identifier: 'app.ownjournal.plus.yearly.v1',
            priceString: '$19.99',
            price: 19.99,
            currencyCode: 'USD',
            introPrice: { periodNumberOfUnits: 14, periodUnit: 'DAY' },
          },
        }],
      },
    });

    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    const products = await iapService.getProducts();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productId: 'app.ownjournal.plus.yearly.v1',
      priceFormatted: '$19.99',
      currencyCode: 'USD',
      introOffer: { kind: 'free_trial', periodDays: 14 },
    });
    expect(products[0].priceAmountMicros).toBe(19_990_000);
  });

  it('throws NOT_INITIALIZED if init() was not called', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key_xxx');
    const { iapService, IAPError } = await loadIapService();
    await expect(iapService.getProducts()).rejects.toBeInstanceOf(IAPError);
    await expect(iapService.getProducts()).rejects.toMatchObject({ code: 'NOT_INITIALIZED' });
  });
});

describe('iapService.purchase on iOS', () => {
  beforeEach(() => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key_xxx');
    purchasesMock.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [{
          identifier: '$rc_annual',
          product: { identifier: 'app.ownjournal.plus.yearly.v1', priceString: '$19.99', price: 19.99, currencyCode: 'USD' },
        }],
      },
    });
  });

  it('maps userCancelled error to USER_CANCELLED', async () => {
    purchasesMock.purchasePackage.mockRejectedValue({ userCancelled: true, message: 'cancel' });
    const { iapService, IAPError } = await loadIapService();
    await iapService.init('user-1');
    await expect(iapService.purchase()).rejects.toBeInstanceOf(IAPError);
    await expect(iapService.purchase()).rejects.toMatchObject({ code: 'USER_CANCELLED' });
  });

  it('maps other failures to UNKNOWN', async () => {
    purchasesMock.purchasePackage.mockRejectedValue({ message: 'some failure' });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    await expect(iapService.purchase()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('returns derived entitlement on success (Apple)', async () => {
    purchasesMock.purchasePackage.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            plus: {
              isActive: true,
              willRenew: true,
              periodType: 'NORMAL',
              expirationDate: '2030-01-01T00:00:00Z',
              productIdentifier: 'app.ownjournal.plus.yearly.v1',
              store: 'APP_STORE',
            },
          },
        },
      },
    });

    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    const ent = await iapService.purchase();
    expect(ent).toMatchObject({
      isPro: true,
      willRenew: true,
      provider: 'apple',
      productId: 'app.ownjournal.plus.yearly.v1',
      isInTrial: false,
    });
    expect(ent.expiresAt).toBeInstanceOf(Date);
  });

  it('throws PRODUCT_UNAVAILABLE if no Plus package is configured', async () => {
    purchasesMock.getOfferings.mockResolvedValue({ current: { availablePackages: [] } });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    await expect(iapService.purchase()).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE' });
  });
});

describe('iapService.getActiveEntitlement', () => {
  it('detects Android Play Store entitlement', async () => {
    setPlatform('capacitor-android');
    vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY', 'android_key');
    purchasesMock.getCustomerInfo.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            plus: {
              isActive: true,
              willRenew: true,
              periodType: 'NORMAL',
              expirationDate: null,
              productIdentifier: 'app.ownjournal.plus.yearly',
              store: 'PLAY_STORE',
            },
          },
        },
      },
    });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    const ent = await iapService.getActiveEntitlement();
    expect(ent).toMatchObject({ isPro: true, provider: 'google' });
  });

  it('returns empty entitlement when no active subscription', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key');
    purchasesMock.getCustomerInfo.mockResolvedValue({
      customerInfo: { entitlements: { active: {} } },
    });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    const ent = await iapService.getActiveEntitlement();
    expect(ent.isPro).toBe(false);
    expect(ent.provider).toBeNull();
  });

  it('flags isInTrial when periodType is TRIAL', async () => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key');
    purchasesMock.getCustomerInfo.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            plus: {
              isActive: true,
              willRenew: true,
              periodType: 'TRIAL',
              expirationDate: '2030-01-01T00:00:00Z',
              productIdentifier: 'app.ownjournal.plus.yearly.v1',
              store: 'APP_STORE',
            },
          },
        },
      },
    });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    const ent = await iapService.getActiveEntitlement();
    expect(ent.isInTrial).toBe(true);
  });
});

describe('iapService.isEligibleForTrial', () => {
  beforeEach(() => {
    setPlatform('capacitor-ios');
    vi.stubEnv('VITE_REVENUECAT_IOS_KEY', 'ios_key');
  });

  it('returns true only when status === 3', async () => {
    purchasesMock.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
      'app.ownjournal.plus.yearly.v1': { status: 3 },
    });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    await expect(iapService.isEligibleForTrial()).resolves.toBe(true);
  });

  it('returns false for INELIGIBLE (status 2)', async () => {
    purchasesMock.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
      'app.ownjournal.plus.yearly.v1': { status: 2 },
    });
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    await expect(iapService.isEligibleForTrial()).resolves.toBe(false);
  });

  it('returns false when the API throws', async () => {
    purchasesMock.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('boom'));
    const { iapService } = await loadIapService();
    await iapService.init('user-1');
    await expect(iapService.isEligibleForTrial()).resolves.toBe(false);
  });
});

describe('iapService.openManageSubscription', () => {
  it('opens the Apple URL on iOS', async () => {
    setPlatform('capacitor-ios');
    const { iapService } = await loadIapService();
    await iapService.openManageSubscription();
    expect(browserOpenMock).toHaveBeenCalledWith({ url: 'https://apps.apple.com/account/subscriptions' });
  });

  it('opens the Google URL on Android', async () => {
    setPlatform('capacitor-android');
    const { iapService } = await loadIapService();
    await iapService.openManageSubscription();
    expect(browserOpenMock).toHaveBeenCalledTimes(1);
    const arg = browserOpenMock.mock.calls[0][0];
    expect(arg.url).toContain('play.google.com/store/account/subscriptions');
    expect(arg.url).toContain('app.ownjournal.plus.yearly');
  });

  it('rejects with NOT_AVAILABLE on web', async () => {
    setPlatform('web');
    const { iapService, IAPError } = await loadIapService();
    await expect(iapService.openManageSubscription()).rejects.toBeInstanceOf(IAPError);
    await expect(iapService.openManageSubscription()).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
  });
});

describe('getStoreSubscriptionUrl', () => {
  it('returns the Apple URL', async () => {
    const { getStoreSubscriptionUrl } = await loadIapService();
    expect(getStoreSubscriptionUrl('apple')).toBe('https://apps.apple.com/account/subscriptions');
  });

  it('returns the Google URL with sku and package', async () => {
    const { getStoreSubscriptionUrl } = await loadIapService();
    const url = getStoreSubscriptionUrl('google');
    expect(url).toContain('play.google.com/store/account/subscriptions');
    expect(url).toContain('sku=app.ownjournal.plus.yearly');
    expect(url).toContain('package=app.ownjournal');
  });
});
