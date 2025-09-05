/**
 * Platform Capabilities Tests
 * Tests capability detection for storage, network, UI, and OAuth
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStorageCapabilities,
  getNetworkCapabilities,
  getUICapabilities,
  getOAuthCapabilities,
  getAllCapabilities,
  hasCapability
} from '../platformCapabilities';

describe('Platform Capabilities', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
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

    it('should handle missing IndexedDB', () => {
      const tempIndexedDB = global.indexedDB;
      // @ts-ignore
      delete global.indexedDB;

      const caps = getStorageCapabilities();
      expect(caps.indexedDB).toBe(false);
      expect(caps.recommendedStorage).toBe('localstorage');

      global.indexedDB = tempIndexedDB;
    });

    it('should detect native file system on Electron', () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin'
      };

      const caps = getStorageCapabilities();
      expect(caps.nativeFileSystem).toBe(true);
      expect(caps.recommendedStorage).toBe('native');
    });

    it('should detect Capacitor file system', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        Plugins: {
          Filesystem: {}
        }
      };

      const caps = getStorageCapabilities();
      expect(caps.nativeFileSystem).toBe(true);
    });
  });

  describe('getNetworkCapabilities', () => {
    it('should detect Service Worker support', () => {
      const caps = getNetworkCapabilities();
      
      // Service Worker is available in test environment
      expect(caps.serviceWorker).toBe(true);
      expect(caps.offlineSupport).toBe(true);
    });

    it('should recommend appropriate sync strategy', () => {
      const caps = getNetworkCapabilities();
      
      expect(caps.recommendedSyncStrategy).toBeDefined();
      expect(['immediate', 'background', 'manual']).toContain(caps.recommendedSyncStrategy);
    });

    it('should handle missing Service Worker', () => {
      const tempNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true
      });

      const caps = getNetworkCapabilities();
      expect(caps.serviceWorker).toBe(false);
      expect(caps.backgroundSync).toBe(false);

      global.navigator = tempNavigator;
    });

    it('should detect background sync capability', () => {
      const caps = getNetworkCapabilities();
      
      // Background sync availability depends on SW
      if (caps.serviceWorker) {
        expect(caps.backgroundSync).toBeDefined();
      }
    });
  });

  describe('getUICapabilities', () => {
    it('should detect popup support on web', () => {
      const caps = getUICapabilities();
      
      expect(caps.popups).toBe(true);
      expect(caps.deepLinks).toBe(false);
      expect(caps.nativeDialogs).toBe(false);
    });

    it('should detect deep links on Capacitor', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        Plugins: {
          AppPlugin: {}
        }
      };

      const caps = getUICapabilities();
      expect(caps.deepLinks).toBe(true);
      expect(caps.popups).toBe(false);
    });

    it('should detect native dialogs on Electron', () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        showDialog: vi.fn()
      };

      const caps = getUICapabilities();
      expect(caps.nativeDialogs).toBe(true);
    });

    it('should handle push notification detection', () => {
      const caps = getUICapabilities();
      
      // Push notifications depend on service worker and Notification API
      expect(typeof caps.pushNotifications).toBe('boolean');
    });
  });

  describe('getOAuthCapabilities', () => {
    it('should support popup OAuth on web', () => {
      const caps = getOAuthCapabilities();
      
      expect(caps.supportsPopup).toBe(true);
      expect(caps.supportsRedirect).toBe(true);
      expect(caps.recommendedFlow).toBe('popup');
    });

    it('should recommend deep links on mobile', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        Plugins: {
          Browser: {}
        }
      };

      const caps = getOAuthCapabilities();
      expect(caps.supportsDeepLink).toBe(true);
      expect(caps.recommendedFlow).toBe('deeplink');
    });

    it('should support native browser on Electron', () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        openExternal: vi.fn()
      };

      const caps = getOAuthCapabilities();
      expect(caps.supportsNativeBrowser).toBe(true);
      expect(caps.recommendedFlow).toBe('native-browser');
    });

    it('should handle all OAuth flow types', () => {
      const caps = getOAuthCapabilities();
      
      expect(caps.supportsPopup).toBeDefined();
      expect(caps.supportsRedirect).toBeDefined();
      expect(caps.supportsDeepLink).toBeDefined();
      expect(caps.supportsNativeBrowser).toBeDefined();
      expect(['popup', 'redirect', 'deeplink', 'native-browser']).toContain(caps.recommendedFlow);
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
    it('should check storage capabilities', () => {
      expect(hasCapability('storage.indexedDB')).toBeDefined();
      expect(hasCapability('storage.localStorage')).toBeDefined();
    });

    it('should check network capabilities', () => {
      expect(hasCapability('network.serviceWorker')).toBeDefined();
      expect(hasCapability('network.offlineSupport')).toBeDefined();
    });

    it('should check UI capabilities', () => {
      expect(hasCapability('ui.popups')).toBeDefined();
      expect(hasCapability('ui.deepLinks')).toBeDefined();
    });

    it('should check OAuth capabilities', () => {
      expect(hasCapability('oauth.supportsPopup')).toBeDefined();
      expect(hasCapability('oauth.supportsRedirect')).toBeDefined();
    });

    it('should return false for invalid capability', () => {
      expect(hasCapability('invalid.capability')).toBe(false);
    });

    it('should handle nested capability paths', () => {
      const result = hasCapability('storage.recommendedStorage');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Cross-Platform Scenarios', () => {
    it('should provide correct capabilities for web', () => {
      const caps = getAllCapabilities();
      
      expect(caps.platform.isWeb).toBe(true);
      expect(caps.storage.recommendedStorage).toBe('indexeddb');
      expect(caps.ui.popups).toBe(true);
      expect(caps.oauth.recommendedFlow).toBe('popup');
    });

    it('should provide correct capabilities for Capacitor iOS', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        Plugins: {
          Filesystem: {},
          Browser: {}
        }
      };

      const caps = getAllCapabilities();
      
      expect(caps.platform.isMobile).toBe(true);
      expect(caps.ui.deepLinks).toBe(true);
      expect(caps.oauth.supportsDeepLink).toBe(true);
    });

    it('should provide correct capabilities for Electron', () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin'
      };

      const caps = getAllCapabilities();
      
      expect(caps.platform.isDesktop).toBe(true);
      expect(caps.storage.nativeFileSystem).toBe(true);
      expect(caps.ui.nativeDialogs).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle partial capability support', () => {
      // Remove some browser features
      const tempIndexedDB = global.indexedDB;
      // @ts-ignore
      delete global.indexedDB;

      const caps = getAllCapabilities();
      
      expect(caps.storage.indexedDB).toBe(false);
      expect(caps.storage.recommendedStorage).toBe('localstorage');

      global.indexedDB = tempIndexedDB;
    });

    it('should gracefully handle missing APIs', () => {
      const tempNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'test' },
        writable: true,
        configurable: true
      });

      const caps = getAllCapabilities();
      
      expect(caps).toBeDefined();
      expect(caps.platform).toBeDefined();
      expect(caps.storage).toBeDefined();

      global.navigator = tempNavigator;
    });

    it('should handle capability queries with invalid format', () => {
      expect(hasCapability('')).toBe(false);
      expect(hasCapability('.')).toBe(false);
      expect(hasCapability('....')).toBe(false);
    });
  });
});
