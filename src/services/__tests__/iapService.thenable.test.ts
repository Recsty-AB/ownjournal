import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression guard for the Capacitor "thenable plugin proxy" crash.
 *
 * A Capacitor plugin proxy returns a callable for ANY property access,
 * including `.then`, which makes it look thenable. Returning it bare from an
 * async function (`return mod.Purchases`) makes the runtime try to unwrap it
 * via `Purchases.then(resolve, reject)`, dispatching a native call to a
 * non-existent `then` method — the production crash:
 *   `"Purchases.then()" is not implemented on android`
 *
 * iapService.loadPurchases() must wrap the proxy (`return { Purchases }`) so its
 * `.then` is never touched. This mock fails loudly if the bare proxy is ever
 * returned again.
 */

vi.mock('@/utils/platformDetection', () => ({
  getPlatformInfo: () => ({ platform: 'capacitor-android' }),
}));

const thenAccessed = vi.hoisted(() => vi.fn());

vi.mock('@revenuecat/purchases-capacitor', () => {
  const Purchases = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        // If anything treats the proxy as a thenable, record it and throw the
        // exact native error to mirror production.
        thenAccessed();
        return () => { throw new Error('"Purchases.then()" is not implemented on android'); };
      }
      return (..._args: unknown[]) => {
        if (prop === 'getOfferings') return Promise.resolve({ current: { availablePackages: [] } });
        return Promise.resolve(undefined);
      };
    },
  });
  return { Purchases, LOG_LEVEL: { DEBUG: 'DEBUG' } };
});

const USER = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY', 'goog_test_key');
});

describe('iapService — Capacitor thenable-proxy regression', () => {
  it('init() resolves without tripping the plugin proxy .then trap', async () => {
    const { iapService } = await import('../iapService');
    await expect(iapService.init(USER)).resolves.toBeUndefined();
    expect(thenAccessed).not.toHaveBeenCalled();
  });

  it('getProducts() resolves without invoking the proxy .then', async () => {
    const { iapService } = await import('../iapService');
    await iapService.init(USER);
    await expect(iapService.getProducts()).resolves.toEqual([]);
    expect(thenAccessed).not.toHaveBeenCalled();
  });
});
