/**
 * Platform Capabilities Tests
 * Tests capability detection for storage, network, UI, and OAuth
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need fresh module state for each test since getPlatformInfo caches
let getStorageCapabilities: any;
let getNetworkCapabilities: any;
let getUICapabilities: any;
let getOAuthCapabilities: any;
let getAllCapabilities: any;
let hasCapability: any;

describe('Platform Capabilities', () => {
  let originalWindow: any;

  beforeEach(async () => {
    originalWindow = global.window;

    // Clear platform globals
    delete (global.window as any).Capacitor;
    delete (global.window as any).electronAPI;
    delete (global.window as any).electron;

    // Ensure navigator.userAgent exists (needed by platformDetection)
    if (!navigator.userAgent) {
      Object.defineProperty(global, 'navigator', {
        value: { ...navigator, userAgent: 'test-agent' },
        writable: true,
        configurable: true,
      });
    }

    // Re-import modules to reset cached singleton in platformDetection
    vi.resetModules();
    const mod = await import('../platformCapabilities');
    getStorageCapabilities = mod.getStorageCapabilities;
    getNetworkCapabilities = mod.getNetworkCapabilities;
    getUICapabilities = mod.getUICapabilities;
    getOAuthCapabilities = mod.getOAuthCapabilities;
    getAllCapabilities = mod.getAllCapabilities;
    hasCapability = mod.hasCapability;
  });

  afterEach(() => {
    global.window = originalWindow;
    delete (global.window as any).Capacitor;
    delete (global.window as any).electronAPI;
    delete (global.window as any).electron;
    vi.clearAllMocks();
  });

  describe('getStorageCapabilities', () => {
    it('should detect IndexedDB support', () => {
      const caps = getStorageCapabilities();

      expect(caps.indexedDB).toBe(true);
      expect(caps.localStorage).toBe(true);
    });

    it('should recommend IndexedDB for web', () => {
      const caps = getStorageCapabilities();
      expect(caps.recommendedStorage).toBe('indexeddb');
    });

    it('should handle missing IndexedDB', async () => {
      const tempIndexedDB = global.indexedDB;
      // @ts-ignore
      delete global.indexedDB;

      // Need fresh import since storage check is live
      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getStorageCapabilities();
      expect(caps.indexedDB).toBe(false);
      // recommendedStorage is 'indexeddb' for web even without indexedDB
      // because the source uses ternary on isElectron, not on indexedDB availability
      expect(caps.recommendedStorage).toBe('indexeddb');

      global.indexedDB = tempIndexedDB;
    });

    it('should detect native file system on Electron', async () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin'
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getStorageCapabilities();
      expect(caps.nativeFileSystem).toBe(true);
      expect(caps.recommendedStorage).toBe('native');
    });
  });

  describe('getNetworkCapabilities', () => {
    it('should detect offline support', () => {
      const caps = getNetworkCapabilities();

      expect(caps.offlineSupport).toBe(true);
    });

    it('should recommend appropriate sync strategy for web', () => {
      const caps = getNetworkCapabilities();

      expect(caps.recommendedSyncStrategy).toBeDefined();
      expect(['service-worker', 'manual', 'native']).toContain(caps.recommendedSyncStrategy);
    });

    it('should handle missing Service Worker', async () => {
      const tempNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'test-agent' },
        writable: true,
        configurable: true
      });

      // Re-import to pick up navigator change
      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getNetworkCapabilities();
      expect(caps.serviceWorker).toBe(false);
      expect(caps.backgroundSync).toBe(false);

      global.navigator = tempNavigator;
    });
  });

  describe('getUICapabilities', () => {
    it('should detect popup support on web', () => {
      const caps = getUICapabilities();

      expect(caps.popups).toBe(true);
      expect(caps.deepLinks).toBe(false);
      expect(caps.nativeDialogs).toBe(false);
    });

    it('should detect deep links on Capacitor', async () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true,
        Plugins: {
          AppPlugin: {}
        }
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getUICapabilities();
      expect(caps.deepLinks).toBe(true);
      expect(caps.popups).toBe(false);
    });

    it('should detect native dialogs on Electron', async () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        showDialog: vi.fn()
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getUICapabilities();
      expect(caps.nativeDialogs).toBe(true);
    });

    it('should handle push notification detection', () => {
      const caps = getUICapabilities();

      expect(typeof caps.pushNotifications).toBe('boolean');
    });
  });

  describe('getOAuthCapabilities', () => {
    it('should support redirect OAuth on web', () => {
      const caps = getOAuthCapabilities();

      expect(caps.supportsPopup).toBe(true);
      expect(caps.supportsRedirect).toBe(true);
      // Source recommends 'redirect' not 'popup' for web
      expect(caps.recommendedFlow).toBe('redirect');
    });

    it('should recommend deep links on mobile', async () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true,
        Plugins: {
          Browser: {}
        }
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getOAuthCapabilities();
      expect(caps.supportsDeepLink).toBe(true);
      expect(caps.recommendedFlow).toBe('deep-link');
    });

    it('should support native browser on Electron', async () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        openExternal: vi.fn()
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getOAuthCapabilities();
      expect(caps.supportsNativeBrowser).toBe(true);
      expect(caps.recommendedFlow).toBe('native-browser');
    });

    it('should handle all OAuth flow types', () => {
      const caps = getOAuthCapabilities();

      expect(caps.supportsPopup).toBeDefined();
      expect(caps.supportsRedirect).toBeDefined();
      expect(caps.supportsDeepLink).toBeDefined();
      expect(caps.supportsNativeBrowser).toBeDefined();
      expect(['popup', 'redirect', 'deep-link', 'native-browser']).toContain(caps.recommendedFlow);
    });
  });

  describe('getAllCapabilities', () => {
    it('should return all capability groups', () => {
      const caps = getAllCapabilities();

      expect(caps).toHaveProperty('platform');
      expect(caps).toHaveProperty('storage');
      expect(caps).toHaveProperty('network');
      expect(caps).toHaveProperty('ui');
      expect(caps).toHaveProperty('oauth');
    });

    it('should include platform info', () => {
      const caps = getAllCapabilities();

      expect(caps.platform).toHaveProperty('platform');
      expect(caps.platform).toHaveProperty('category');
      expect(caps.platform).toHaveProperty('isWeb');
      expect(caps.platform).toHaveProperty('isMobile');
      expect(caps.platform).toHaveProperty('isDesktop');
    });

    it('should provide consistent capabilities', () => {
      const caps1 = getAllCapabilities();
      const caps2 = getAllCapabilities();

      expect(caps1.platform.platform).toBe(caps2.platform.platform);
      expect(caps1.storage.recommendedStorage).toBe(caps2.storage.recommendedStorage);
    });
  });

  describe('hasCapability', () => {
    it('should check known capabilities', () => {
      // hasCapability uses switch on exact string matches like 'indexed-db', 'local-storage'
      expect(hasCapability('indexed-db')).toBe(true);
      expect(hasCapability('local-storage')).toBe(true);
    });

    it('should check popups capability', () => {
      expect(hasCapability('popups')).toBe(true);
      expect(hasCapability('deep-links')).toBe(false);
    });

    it('should return false for unknown capability', () => {
      expect(hasCapability('invalid.capability')).toBe(false);
      expect(hasCapability('')).toBe(false);
    });
  });

  describe('Cross-Platform Scenarios', () => {
    it('should provide correct capabilities for web', () => {
      const caps = getAllCapabilities();

      expect(caps.platform.isWeb).toBe(true);
      expect(caps.storage.recommendedStorage).toBe('indexeddb');
      expect(caps.ui.popups).toBe(true);
      expect(caps.oauth.recommendedFlow).toBe('redirect');
    });

    it('should provide correct capabilities for Capacitor iOS', async () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true,
        Plugins: {
          Filesystem: {},
          Browser: {}
        }
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getAllCapabilities();

      expect(caps.platform.isMobile).toBe(true);
      expect(caps.ui.deepLinks).toBe(true);
      expect(caps.oauth.supportsDeepLink).toBe(true);
    });

    it('should provide correct capabilities for Electron', async () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin'
      };

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getAllCapabilities();

      expect(caps.platform.isDesktop).toBe(true);
      expect(caps.storage.nativeFileSystem).toBe(true);
      expect(caps.ui.nativeDialogs).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle partial capability support', async () => {
      // Remove some browser features
      const tempIndexedDB = global.indexedDB;
      // @ts-ignore
      delete global.indexedDB;

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getAllCapabilities();

      expect(caps.storage.indexedDB).toBe(false);
      // Source: recommendedStorage is 'indexeddb' for web (not based on actual availability)
      expect(caps.storage.recommendedStorage).toBe('indexeddb');

      global.indexedDB = tempIndexedDB;
    });

    it('should gracefully handle missing APIs', async () => {
      const tempNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'test' },
        writable: true,
        configurable: true
      });

      vi.resetModules();
      const mod = await import('../platformCapabilities');
      const caps = mod.getAllCapabilities();

      expect(caps).toBeDefined();
      expect(caps.platform).toBeDefined();
      expect(caps.storage).toBeDefined();

      global.navigator = tempNavigator;
    });
  });
});
