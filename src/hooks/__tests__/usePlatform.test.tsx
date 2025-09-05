import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlatform, useIsPlatform, usePlatformConfig } from '../usePlatform';
import * as platformDetection from '@/utils/platformDetection';
import * as platformCapabilities from '@/utils/platformCapabilities';

vi.mock('@/utils/platformDetection', () => ({
  getPlatformInfo: vi.fn(),
  getPlatformDisplayName: vi.fn(),
}));

vi.mock('@/utils/platformCapabilities', () => ({
  getAllCapabilities: vi.fn(),
}));

describe('usePlatform', () => {
  const mockPlatformInfo = {
    platform: 'web' as const,
    category: 'web' as const,
    isWeb: true,
    isMobile: false,
    isDesktop: false,
    isCapacitor: false,
    isElectron: false,
    supportsPopupOAuth: true,
    supportsDeepLinking: false,
    supportsNativeFileSystem: false,
    deviceId: 'web-device-123',
  };

  const mockCapabilities = {
    platform: mockPlatformInfo,
    ui: {
      popups: true,
      deepLinks: false,
      pushNotifications: true,
      nativeDialogs: false,
    },
    network: {
      serviceWorker: true,
      backgroundSync: true,
      offlineSupport: true,
      recommendedSyncStrategy: 'service-worker' as const,
    },
    storage: {
      indexedDB: true,
      localStorage: true,
      nativeFileSystem: false,
      recommendedStorage: 'indexeddb' as const,
    },
    oauth: {
      supportsRedirect: true,
      supportsPopup: true,
      supportsDeepLink: false,
      supportsNativeBrowser: false,
      recommendedFlow: 'redirect' as const,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue(mockPlatformInfo);
    vi.mocked(platformDetection.getPlatformDisplayName).mockReturnValue('Web Browser');
    vi.mocked(platformCapabilities.getAllCapabilities).mockReturnValue(mockCapabilities);
  });

  it('should return platform information', () => {
    const { result } = renderHook(() => usePlatform());
    
    expect(result.current.platform).toBe('web');
    expect(result.current.category).toBe('web');
    expect(result.current.isWeb).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.displayName).toBe('Web Browser');
    expect(result.current.deviceId).toBe('web-device-123');
  });

  it('should return capabilities', () => {
    const { result } = renderHook(() => usePlatform());
    
    expect(result.current.capabilities).toEqual(mockCapabilities);
    expect(result.current.canUsePopups).toBe(true);
    expect(result.current.canUseDeepLinks).toBe(false);
    expect(result.current.hasServiceWorker).toBe(true);
    expect(result.current.hasNativeFS).toBe(false);
  });

  it('should return OAuth recommendations', () => {
    const { result } = renderHook(() => usePlatform());
    
    expect(result.current.recommendedOAuthFlow).toBe('redirect');
    expect(result.current.supportsOAuthRedirect).toBe(true);
  });

  it('should detect mobile platform', () => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue({
      ...mockPlatformInfo,
      platform: 'capacitor-ios',
      category: 'mobile',
      isWeb: false,
      isMobile: true,
      isCapacitor: true,
      supportsPopupOAuth: false,
      supportsDeepLinking: true,
    });

    const { result } = renderHook(() => usePlatform());
    
    expect(result.current.platform).toBe('capacitor-ios');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isCapacitor).toBe(true);
  });

  it('should detect desktop platform', () => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue({
      ...mockPlatformInfo,
      platform: 'electron-mac',
      category: 'desktop',
      isWeb: false,
      isDesktop: true,
      isElectron: true,
      supportsNativeFileSystem: true,
    });

    const { result } = renderHook(() => usePlatform());
    
    expect(result.current.platform).toBe('electron-mac');
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isElectron).toBe(true);
  });

  it('should memoize platform info', () => {
    const { result, rerender } = renderHook(() => usePlatform());
    
    const firstPlatform = result.current.platform;
    rerender();
    const secondPlatform = result.current.platform;
    
    expect(firstPlatform).toBe(secondPlatform);
    expect(platformDetection.getPlatformInfo).toHaveBeenCalledTimes(1);
  });
});

describe('useIsPlatform', () => {
  const testPlatformInfo = {
    platform: 'web' as const,
    category: 'web' as const,
    isWeb: true,
    isMobile: false,
    isDesktop: false,
    isCapacitor: false,
    isElectron: false,
    supportsPopupOAuth: true,
    supportsDeepLinking: false,
    supportsNativeFileSystem: false,
    deviceId: 'web-123',
  };
  
  beforeEach(() => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue(testPlatformInfo);
    vi.mocked(platformCapabilities.getAllCapabilities).mockReturnValue({
      platform: testPlatformInfo,
      storage: {
        indexedDB: true,
        localStorage: true,
        nativeFileSystem: false,
        recommendedStorage: 'indexeddb' as const,
      },
      network: {
        serviceWorker: true,
        backgroundSync: false,
        offlineSupport: true,
        recommendedSyncStrategy: 'service-worker' as const,
      },
      ui: {
        popups: true,
        deepLinks: false,
        pushNotifications: false,
        nativeDialogs: false,
      },
      oauth: {
        supportsPopup: true,
        supportsDeepLink: false,
        supportsRedirect: true,
        supportsNativeBrowser: false,
        recommendedFlow: 'popup' as const,
      },
    });
  });

  it('should check if on specific platform', () => {
    const { result } = renderHook(() => useIsPlatform('web'));
    expect(result.current).toBe(true);
  });

  it('should return false for different platform', () => {
    const { result } = renderHook(() => useIsPlatform('capacitor-ios'));
    expect(result.current).toBe(false);
  });
});

describe('usePlatformConfig', () => {
  it('should return web config when on web', () => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue({
      platform: 'web',
      category: 'web',
      isWeb: true,
      isMobile: false,
      isDesktop: false,
      isCapacitor: false,
      isElectron: false,
      supportsPopupOAuth: true,
      supportsDeepLinking: false,
      supportsNativeFileSystem: false,
      deviceId: 'web-123',
    });
      vi.mocked(platformCapabilities.getAllCapabilities).mockReturnValue({
        platform: {
          platform: 'web',
          category: 'web',
          isWeb: true,
          isMobile: false,
          isDesktop: false,
          isCapacitor: false,
          isElectron: false,
          supportsPopupOAuth: true,
          supportsDeepLinking: false,
          supportsNativeFileSystem: false,
          deviceId: 'web-123',
        },
        storage: {
          indexedDB: true,
          localStorage: true,
          nativeFileSystem: false,
          recommendedStorage: 'indexeddb' as const,
        },
        network: {
          serviceWorker: true,
          backgroundSync: false,
          offlineSupport: true,
          recommendedSyncStrategy: 'service-worker' as const,
        },
        ui: {
          popups: true,
          deepLinks: false,
          pushNotifications: false,
          nativeDialogs: false,
        },
        oauth: {
          supportsPopup: true,
          supportsRedirect: true,
          supportsDeepLink: false,
          supportsNativeBrowser: false,
          recommendedFlow: 'redirect' as const,
        },
      });

    const { result } = renderHook(() => 
      usePlatformConfig({
        web: 'web-value',
        mobile: 'mobile-value',
        desktop: 'desktop-value',
        default: 'default-value',
      })
    );
    
    expect(result.current).toBe('web-value');
  });

  it('should return mobile config when on mobile', () => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue({
      platform: 'capacitor-ios',
      category: 'mobile',
      isWeb: false,
      isMobile: true,
      isDesktop: false,
      isCapacitor: true,
      isElectron: false,
      supportsPopupOAuth: false,
      supportsDeepLinking: true,
      supportsNativeFileSystem: false,
      deviceId: 'ios-123',
    });
      vi.mocked(platformCapabilities.getAllCapabilities).mockReturnValue({
        platform: {
          platform: 'capacitor-ios',
          category: 'mobile',
          isWeb: false,
          isMobile: true,
          isDesktop: false,
          isCapacitor: true,
          isElectron: false,
          supportsPopupOAuth: false,
          supportsDeepLinking: true,
          supportsNativeFileSystem: false,
          deviceId: 'ios-123',
        },
        storage: {
          indexedDB: true,
          localStorage: true,
          nativeFileSystem: false,
          recommendedStorage: 'indexeddb' as const,
        },
        network: {
          serviceWorker: false,
          backgroundSync: false,
          offlineSupport: true,
          recommendedSyncStrategy: 'manual' as const,
        },
        ui: {
          popups: false,
          deepLinks: true,
          pushNotifications: true,
          nativeDialogs: false,
        },
        oauth: {
          supportsPopup: false,
          supportsRedirect: false,
          supportsDeepLink: true,
          supportsNativeBrowser: true,
          recommendedFlow: 'deep-link' as const,
        },
      });

    const { result } = renderHook(() => 
      usePlatformConfig({
        web: 'web-value',
        mobile: 'mobile-value',
        desktop: 'desktop-value',
        default: 'default-value',
      })
    );
    
    expect(result.current).toBe('mobile-value');
  });

  it('should return desktop config when on desktop', () => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue({
      platform: 'electron-mac',
      category: 'desktop',
      isWeb: false,
      isMobile: false,
      isDesktop: true,
      isCapacitor: false,
      isElectron: true,
      supportsPopupOAuth: false,
      supportsDeepLinking: false,
      supportsNativeFileSystem: true,
      deviceId: 'electron-123',
    });
      vi.mocked(platformCapabilities.getAllCapabilities).mockReturnValue({
        platform: {
          platform: 'electron-mac',
          category: 'desktop',
          isWeb: false,
          isMobile: false,
          isDesktop: true,
          isCapacitor: false,
          isElectron: true,
          supportsPopupOAuth: false,
          supportsDeepLinking: false,
          supportsNativeFileSystem: true,
          deviceId: 'mac-123',
        },
        storage: {
          indexedDB: true,
          localStorage: true,
          nativeFileSystem: true,
          recommendedStorage: 'native' as const,
        },
        network: {
          serviceWorker: false,
          backgroundSync: false,
          offlineSupport: true,
          recommendedSyncStrategy: 'native' as const,
        },
        ui: {
          popups: false,
          deepLinks: false,
          pushNotifications: false,
          nativeDialogs: true,
        },
        oauth: {
          supportsPopup: false,
          supportsRedirect: false,
          supportsDeepLink: false,
          supportsNativeBrowser: true,
          recommendedFlow: 'native-browser' as const,
        },
      });

    const { result } = renderHook(() => 
      usePlatformConfig({
        web: 'web-value',
        mobile: 'mobile-value',
        desktop: 'desktop-value',
        default: 'default-value',
      })
    );
    
    expect(result.current).toBe('desktop-value');
  });

  it('should return default when specific config missing', () => {
    vi.mocked(platformDetection.getPlatformInfo).mockReturnValue({
      platform: 'web',
      category: 'web',
      isWeb: true,
      isMobile: false,
      isDesktop: false,
      isCapacitor: false,
      isElectron: false,
      supportsPopupOAuth: true,
      supportsDeepLinking: false,
      supportsNativeFileSystem: false,
      deviceId: 'web-123',
    });
      vi.mocked(platformCapabilities.getAllCapabilities).mockReturnValue({
        platform: {
          platform: 'web',
          category: 'web',
          isWeb: true,
          isMobile: false,
          isDesktop: false,
          isCapacitor: false,
          isElectron: false,
          supportsPopupOAuth: true,
          supportsDeepLinking: false,
          supportsNativeFileSystem: false,
          deviceId: 'web-456',
        },
        storage: {
          indexedDB: true,
          localStorage: true,
          nativeFileSystem: false,
          recommendedStorage: 'indexeddb' as const,
        },
        network: {
          serviceWorker: true,
          backgroundSync: false,
          offlineSupport: true,
          recommendedSyncStrategy: 'service-worker' as const,
        },
        ui: {
          popups: true,
          deepLinks: false,
          pushNotifications: false,
          nativeDialogs: false,
        },
        oauth: {
          supportsPopup: true,
          supportsRedirect: true,
          supportsDeepLink: false,
          supportsNativeBrowser: false,
          recommendedFlow: 'redirect' as const,
        },
      });

    const { result } = renderHook(() => 
      usePlatformConfig({
        mobile: 'mobile-value',
        default: 'default-value',
      })
    );
    
    expect(result.current).toBe('default-value');
  });
});
