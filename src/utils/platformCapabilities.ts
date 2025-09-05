/**
 * Platform Capabilities
 * Provides feature detection and capability checks for different platforms
 */

import { getPlatformInfo } from './platformDetection';

export interface StorageCapabilities {
  indexedDB: boolean;
  localStorage: boolean;
  nativeFileSystem: boolean;
  recommendedStorage: 'indexeddb' | 'native' | 'localStorage';
}

export interface NetworkCapabilities {
  serviceWorker: boolean;
  backgroundSync: boolean;
  offlineSupport: boolean;
  recommendedSyncStrategy: 'service-worker' | 'manual' | 'native';
}

export interface UICapabilities {
  popups: boolean;
  deepLinks: boolean;
  pushNotifications: boolean;
  nativeDialogs: boolean;
}

export interface OAuthCapabilities {
  supportsPopup: boolean;
  supportsRedirect: boolean;
  supportsDeepLink: boolean;
  supportsNativeBrowser: boolean;
  recommendedFlow: 'redirect' | 'popup' | 'deep-link' | 'native-browser';
}

/**
 * Get storage capabilities for current platform
 */
export function getStorageCapabilities(): StorageCapabilities {
  const platform = getPlatformInfo();
  
  return {
    indexedDB: 'indexedDB' in window,
    localStorage: 'localStorage' in window,
    nativeFileSystem: platform.isElectron,
    recommendedStorage: platform.isElectron ? 'native' : 'indexeddb',
  };
}

/**
 * Get network capabilities for current platform
 */
export function getNetworkCapabilities(): NetworkCapabilities {
  const platform = getPlatformInfo();
  
  return {
    serviceWorker: 'serviceWorker' in navigator && platform.isWeb,
    backgroundSync: 'SyncManager' in window && platform.isWeb,
    offlineSupport: true, // All platforms support offline via IndexedDB
    recommendedSyncStrategy: platform.isWeb 
      ? 'service-worker' 
      : platform.isCapacitor 
        ? 'manual' 
        : 'native',
  };
}

/**
 * Get UI capabilities for current platform
 */
export function getUICapabilities(): UICapabilities {
  const platform = getPlatformInfo();
  
  return {
    popups: platform.isWeb && !platform.isMobile,
    deepLinks: platform.isCapacitor,
    pushNotifications: 'Notification' in window,
    nativeDialogs: platform.isElectron,
  };
}

/**
 * Get OAuth capabilities for current platform
 */
export function getOAuthCapabilities(): OAuthCapabilities {
  const platform = getPlatformInfo();
  
  if (platform.isWeb) {
    return {
      supportsPopup: !platform.isMobile,
      supportsRedirect: true,
      supportsDeepLink: false,
      supportsNativeBrowser: false,
      recommendedFlow: 'redirect', // Redirect is more reliable than popup
    };
  }
  
  if (platform.isCapacitor) {
    return {
      supportsPopup: false,
      supportsRedirect: false,
      supportsDeepLink: true,
      supportsNativeBrowser: true,
      recommendedFlow: 'deep-link',
    };
  }
  
  if (platform.isElectron) {
    return {
      supportsPopup: false,
      supportsRedirect: false,
      supportsDeepLink: false,
      supportsNativeBrowser: true,
      recommendedFlow: 'native-browser',
    };
  }
  
  // Fallback
  return {
    supportsPopup: false,
    supportsRedirect: true,
    supportsDeepLink: false,
    supportsNativeBrowser: false,
    recommendedFlow: 'redirect',
  };
}

/**
 * Check if a specific capability is available
 */
export function hasCapability(capability: string): boolean {
  const platform = getPlatformInfo();
  
  switch (capability) {
    case 'indexed-db':
      return 'indexedDB' in window;
    case 'local-storage':
      return 'localStorage' in window;
    case 'service-worker':
      return 'serviceWorker' in navigator && platform.isWeb;
    case 'background-sync':
      return 'SyncManager' in window && platform.isWeb;
    case 'popups':
      return platform.isWeb && !platform.isMobile;
    case 'deep-links':
      return platform.isCapacitor;
    case 'native-fs':
      return platform.isElectron;
    case 'push-notifications':
      return 'Notification' in window;
    default:
      return false;
  }
}

/**
 * Get all platform capabilities in a single call
 */
export function getAllCapabilities() {
  return {
    platform: getPlatformInfo(),
    storage: getStorageCapabilities(),
    network: getNetworkCapabilities(),
    ui: getUICapabilities(),
    oauth: getOAuthCapabilities(),
  };
}
