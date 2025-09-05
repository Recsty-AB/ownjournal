/**
 * Platform Detection Utility
 * Detects the runtime environment (Web, Capacitor, Electron) and provides platform-specific info
 */

export type Platform = 'web' | 'capacitor-ios' | 'capacitor-android' | 'electron-mac' | 'electron-windows' | 'electron-linux';
export type PlatformCategory = 'web' | 'mobile' | 'desktop';

export interface PlatformInfo {
  platform: Platform;
  category: PlatformCategory;
  isWeb: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isCapacitor: boolean;
  isElectron: boolean;
  supportsPopupOAuth: boolean;
  supportsDeepLinking: boolean;
  supportsNativeFileSystem: boolean;
  deviceId: string; // Stable device identifier
}

/**
 * Detect the current platform
 */
export function detectPlatform(): PlatformInfo {
  // Check for Capacitor (mobile apps) - must use isNativePlatform() not just object existence
  const isCapacitor = (window as any).Capacitor?.isNativePlatform?.() === true;
  
  // Check for Electron (desktop apps)
  const isElectron = !!(window as any).electronAPI?.isElectron || 
                     !!(window as any).electron || 
                     navigator.userAgent.includes('Electron');
  
  let platform: Platform = 'web';
  let category: PlatformCategory = 'web';
  
  if (isCapacitor) {
    category = 'mobile';
    const capacitorPlatform = (window as any).Capacitor?.getPlatform();
    if (capacitorPlatform === 'ios') {
      platform = 'capacitor-ios';
    } else if (capacitorPlatform === 'android') {
      platform = 'capacitor-android';
    }
  } else if (isElectron) {
    category = 'desktop';
    const electronPlatform = (window as any).electronAPI?.platform || 
                            (window as any).electron?.process?.platform || 
                            navigator.platform.toLowerCase();
    
    if (electronPlatform.includes('darwin') || electronPlatform.includes('mac')) {
      platform = 'electron-mac';
    } else if (electronPlatform.includes('win')) {
      platform = 'electron-windows';
    } else if (electronPlatform.includes('linux')) {
      platform = 'electron-linux';
    }
  }
  
  // Generate stable device ID
  const deviceId = getDeviceId();
  
  return {
    platform,
    category,
    isWeb: category === 'web',
    isMobile: category === 'mobile',
    isDesktop: category === 'desktop',
    isCapacitor,
    isElectron,
    supportsPopupOAuth: category === 'web',
    supportsDeepLinking: category === 'mobile',
    supportsNativeFileSystem: category === 'desktop',
    deviceId,
  };
}

/**
 * Get or create a stable device ID
 * Used for conflict resolution and sync tracking
 */
function getDeviceId(): string {
  const storageKey = 'ownjournal_device_id';
  
  // Try to get existing ID
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    // Generate new device ID: platform-timestamp-random
    const platform = detectPlatformShort();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    deviceId = `${platform}-${timestamp}-${random}`;
    
    try {
      localStorage.setItem(storageKey, deviceId);
    } catch (err) {
      console.warn('Failed to persist device ID:', err);
    }
  }
  
  return deviceId;
}

/**
 * Get short platform identifier for device ID
 */
function detectPlatformShort(): string {
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    const platform = (window as any).Capacitor?.getPlatform();
    return platform === 'ios' ? 'ios' : 'and'; // ios or and(roid)
  }
  
  if ((window as any).electronAPI?.isElectron || (window as any).electron || navigator.userAgent.includes('Electron')) {
    const platform = (window as any).electronAPI?.platform || navigator.platform.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'win';
    if (platform.includes('linux')) return 'lin';
  }
  
  return 'web';
}

/**
 * Get platform capabilities for feature detection
 */
export function getPlatformCapabilities() {
  const info = detectPlatform();
  
  return {
    // Storage capabilities
    hasIndexedDB: 'indexedDB' in window,
    hasLocalStorage: 'localStorage' in window,
    hasNativeFS: info.isElectron,
    
    // Network capabilities
    hasServiceWorker: 'serviceWorker' in navigator && info.isWeb,
    hasBackgroundSync: 'SyncManager' in window && info.isWeb,
    
    // UI capabilities
    canOpenPopups: info.isWeb && !info.isMobile,
    canUseDeepLinks: info.isCapacitor,
    canShowNotifications: 'Notification' in window,
    
    // Platform-specific features
    hasCapacitorPlugins: info.isCapacitor,
    hasElectronIPC: info.isElectron,
  };
}

// Singleton instance
let cachedPlatformInfo: PlatformInfo | null = null;

/**
 * Get current platform info (cached)
 */
export function getPlatformInfo(): PlatformInfo {
  if (!cachedPlatformInfo) {
    cachedPlatformInfo = detectPlatform();
  }
  return cachedPlatformInfo;
}

/**
 * Check if running on a specific platform
 */
export function isPlatform(platform: Platform): boolean {
  return getPlatformInfo().platform === platform;
}

/**
 * Check if running in a specific category
 */
export function isPlatformCategory(category: PlatformCategory): boolean {
  return getPlatformInfo().category === category;
}

/**
 * Get user-friendly platform name for display
 */
export function getPlatformDisplayName(): string {
  const { platform } = getPlatformInfo();
  
  const names: Record<Platform, string> = {
    'web': 'Web Browser',
    'capacitor-ios': 'iOS App',
    'capacitor-android': 'Android App',
    'electron-mac': 'macOS App',
    'electron-windows': 'Windows App',
    'electron-linux': 'Linux App',
  };
  
  return names[platform] || 'Unknown Platform';
}
