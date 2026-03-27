/**
 * Platform Detection Utility Tests
 * Tests browser, Capacitor, and Electron platform detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need fresh module state for each test since getPlatformInfo caches
let detectPlatform: any;
let getPlatformInfo: any;
let isPlatform: any;
let isPlatformCategory: any;
let getPlatformDisplayName: any;

describe('Platform Detection', () => {
  let originalWindow: any;
  let originalNavigator: any;

  beforeEach(async () => {
    // Store original values
    originalWindow = global.window;
    originalNavigator = global.navigator;

    // Clear Capacitor/Electron globals
    delete (global.window as any).Capacitor;
    delete (global.window as any).electronAPI;
    delete (global.window as any).electron;

    // Clear localStorage
    localStorage.clear();

    // Re-import module to reset cached singleton
    vi.resetModules();
    const mod = await import('../platformDetection');
    detectPlatform = mod.detectPlatform;
    getPlatformInfo = mod.getPlatformInfo;
    isPlatform = mod.isPlatform;
    isPlatformCategory = mod.isPlatformCategory;
    getPlatformDisplayName = mod.getPlatformDisplayName;
  });

  afterEach(() => {
    // Restore original values
    global.window = originalWindow;
    global.navigator = originalNavigator;
    delete (global.window as any).Capacitor;
    delete (global.window as any).electronAPI;
    delete (global.window as any).electron;
    vi.clearAllMocks();
  });

  describe('detectPlatform', () => {
    it('should detect web platform by default', () => {
      const platform = detectPlatform();
      
      expect(platform.platform).toBe('web');
      expect(platform.category).toBe('web');
      expect(platform.isWeb).toBe(true);
      expect(platform.isMobile).toBe(false);
      expect(platform.isDesktop).toBe(false);
      expect(platform.isCapacitor).toBe(false);
      expect(platform.isElectron).toBe(false);
    });

    it('should detect Capacitor iOS platform', () => {
      // Mock Capacitor
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true
      };

      const platform = detectPlatform();
      
      expect(platform.platform).toBe('capacitor-ios');
      expect(platform.category).toBe('mobile');
      expect(platform.isCapacitor).toBe(true);
      expect(platform.isMobile).toBe(true);
    });

    it('should detect Capacitor Android platform', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'android',
        isNativePlatform: () => true
      };

      const platform = detectPlatform();
      
      expect(platform.platform).toBe('capacitor-android');
      expect(platform.category).toBe('mobile');
      expect(platform.isCapacitor).toBe(true);
      expect(platform.isMobile).toBe(true);
    });

    it('should detect web platform when Capacitor exists but isNativePlatform returns false', () => {
      // This is the scenario on web browsers where @capacitor/core is bundled
      (global.window as any).Capacitor = {
        getPlatform: () => 'web',
        isNativePlatform: () => false
      };

      const platform = detectPlatform();
      
      expect(platform.platform).toBe('web');
      expect(platform.category).toBe('web');
      expect(platform.isWeb).toBe(true);
      expect(platform.isMobile).toBe(false);
      expect(platform.isCapacitor).toBe(false);
    });

    it('should detect Electron platform', () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin'
      };

      const platform = detectPlatform();

      expect(platform.platform).toBe('electron-mac');
      expect(platform.category).toBe('desktop');
      expect(platform.isElectron).toBe(true);
      expect(platform.isDesktop).toBe(true);
    });

    it('should handle web platform correctly', () => {
      const platform = detectPlatform();
      
      expect(platform.supportsPopupOAuth).toBe(true);
      expect(platform.supportsDeepLinking).toBe(false);
      expect(platform.supportsNativeFileSystem).toBe(false);
    });
  });

  describe('deviceId', () => {
    it('should generate and persist device ID', () => {
      const platform1 = detectPlatform();
      const platform2 = detectPlatform();
      
      expect(platform1.deviceId).toBeDefined();
      expect(platform1.deviceId).toBe(platform2.deviceId);
      expect(localStorage.getItem('ownjournal_device_id')).toBe(platform1.deviceId);
    });

    it('should include platform prefix', () => {
      const platform = detectPlatform();
      expect(platform.deviceId).toMatch(/^web-/);
    });

    it('should reuse existing device ID', () => {
      const existingId = 'web-existing-id-12345';
      localStorage.setItem('ownjournal_device_id', existingId);
      
      const platform = detectPlatform();
      expect(platform.deviceId).toBe(existingId);
    });
  });

  describe('getPlatformInfo', () => {
    it('should return cached platform info', () => {
      const info1 = getPlatformInfo();
      const info2 = getPlatformInfo();
      
      expect(info1).toBe(info2); // Same object reference
    });

    it('should include device ID', () => {
      const info = getPlatformInfo();
      expect(info.deviceId).toBeDefined();
      expect(info.deviceId).toMatch(/^web-/);
    });
  });

  describe('isPlatform', () => {
    it('should return true for current platform', () => {
      expect(isPlatform('web')).toBe(true);
    });

    it('should return false for different platform', () => {
      expect(isPlatform('capacitor-ios')).toBe(false);
      expect(isPlatform('electron-mac')).toBe(false);
    });
  });

  describe('isPlatformCategory', () => {
    it('should return true for web category', () => {
      expect(isPlatformCategory('web')).toBe(true);
    });

    it('should return false for other categories', () => {
      expect(isPlatformCategory('mobile')).toBe(false);
      expect(isPlatformCategory('desktop')).toBe(false);
    });

    it('should return true for mobile on Capacitor', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true
      };

      // Clear cache by creating new detection
      const platform = detectPlatform();
      expect(platform.category).toBe('mobile');
    });
  });

  describe('getPlatformDisplayName', () => {
    it('should return "Web Browser" for web', () => {
      expect(getPlatformDisplayName()).toBe('Web Browser');
    });

    it('should return "iOS App" for Capacitor iOS', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true
      };

      const name = getPlatformDisplayName();
      expect(name).toBe('iOS App');
    });

    it('should return "Android App" for Capacitor Android', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'android',
        isNativePlatform: () => true
      };

      const name = getPlatformDisplayName();
      expect(name).toBe('Android App');
    });

    it('should return "macOS App" for Electron on macOS', () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin'
      };

      const name = getPlatformDisplayName();
      expect(name).toBe('macOS App');
    });
  });

  describe('Edge Cases', () => {
    it('should handle clean window object gracefully', () => {
      // When no Capacitor or Electron globals exist, should default to web
      delete (global.window as any).Capacitor;
      delete (global.window as any).electronAPI;
      delete (global.window as any).electron;

      const platform = detectPlatform();

      expect(platform.platform).toBe('web');
      expect(platform.category).toBe('web');
    });

    it('should handle Capacitor with unsupported platform', () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'unknown',
        isNativePlatform: () => true
      };

      const platform = detectPlatform();
      
      // Should still detect as Capacitor
      expect(platform.isCapacitor).toBe(true);
    });

    it('should handle platform detection in minimal environment', () => {
      const platform = detectPlatform();
      
      // Should have all required properties
      expect(platform.platform).toBeDefined();
      expect(platform.category).toBeDefined();
      expect(platform.deviceId).toBeDefined();
    });
  });

  describe('Platform-Specific Capabilities', () => {
    it('should report correct capabilities for web', () => {
      const platform = detectPlatform();
      
      expect(platform.isWeb).toBe(true);
      expect(platform.isCapacitor).toBe(false);
      expect(platform.isElectron).toBe(false);
    });

    it('should report correct capabilities for Capacitor', async () => {
      (global.window as any).Capacitor = {
        getPlatform: () => 'ios',
        isNativePlatform: () => true,
        Plugins: {
          Filesystem: {},
          Browser: {}
        }
      };

      // Re-import to pick up new Capacitor global
      vi.resetModules();
      const mod = await import('../platformDetection');
      const platform = mod.detectPlatform();

      expect(platform.isCapacitor).toBe(true);
      expect(platform.isMobile).toBe(true);
      expect(platform.supportsDeepLinking).toBe(true);
      expect(platform.supportsPopupOAuth).toBe(false);
    });

    it('should report correct capabilities for Electron', async () => {
      (global.window as any).electronAPI = {
        isElectron: true,
        platform: 'darwin',
        sendMessage: vi.fn(),
        onMessage: vi.fn()
      };

      // Re-import to pick up new electronAPI global
      vi.resetModules();
      const mod = await import('../platformDetection');
      const platform = mod.detectPlatform();

      expect(platform.isElectron).toBe(true);
      expect(platform.isDesktop).toBe(true);
      expect(platform.supportsNativeFileSystem).toBe(true);
      expect(platform.supportsPopupOAuth).toBe(false);
    });
  });
});
