/**
 * React Hook for Platform Detection and Capabilities
 * Provides easy access to platform info and capabilities in React components
 */

import { useMemo } from 'react';
import { getPlatformInfo, getPlatformDisplayName, type PlatformInfo } from '@/utils/platformDetection';
import { getAllCapabilities } from '@/utils/platformCapabilities';

export function usePlatform() {
  const platform = useMemo(() => getPlatformInfo(), []);
  const capabilities = useMemo(() => getAllCapabilities(), []);
  const displayName = useMemo(() => getPlatformDisplayName(), []);
  
  return {
    // Platform info
    platform: platform.platform,
    category: platform.category,
    isWeb: platform.isWeb,
    isMobile: platform.isMobile,
    isDesktop: platform.isDesktop,
    isCapacitor: platform.isCapacitor,
    isElectron: platform.isElectron,
    displayName,
    deviceId: platform.deviceId,
    
    // Capabilities
    capabilities,
    
    // Quick capability checks
    canUsePopups: capabilities.ui.popups,
    canUseDeepLinks: capabilities.ui.deepLinks,
    hasServiceWorker: capabilities.network.serviceWorker,
    hasNativeFS: capabilities.storage.nativeFileSystem,
    
    // OAuth recommendations
    recommendedOAuthFlow: capabilities.oauth.recommendedFlow,
    supportsOAuthRedirect: capabilities.oauth.supportsRedirect,
  };
}

/**
 * Hook to check if running on a specific platform
 */
export function useIsPlatform(platform: PlatformInfo['platform']) {
  const { platform: currentPlatform } = usePlatform();
  return currentPlatform === platform;
}

/**
 * Hook to get platform-specific configuration
 */
export function usePlatformConfig<T>(config: {
  web?: T;
  mobile?: T;
  desktop?: T;
  default: T;
}): T {
  const { category } = usePlatform();
  
  if (category === 'web' && config.web) return config.web;
  if (category === 'mobile' && config.mobile) return config.mobile;
  if (category === 'desktop' && config.desktop) return config.desktop;
  
  return config.default;
}
