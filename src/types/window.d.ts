/**
 * Type-safe window interface for cloud storage bindings
 * This eliminates the need for (window as any) casts throughout the codebase
 */

import { CloudProvider } from '@/types/cloudProvider';

export interface CloudProviderBinding {
  name: string;
  isConnected: boolean;
  service: CloudProvider;
  upload: CloudProvider['upload'];
  download: CloudProvider['download'];
  listFiles: CloudProvider['listFiles'];
  delete: CloudProvider['delete'];
  exists: CloudProvider['exists'];
  config?: {
    serverUrl?: string;
    username?: string;
  };
}

declare global {
  interface Window {
    // Cloud storage provider bindings (managed by ConnectionStateManager)
    googleDriveSync?: CloudProviderBinding;
    dropboxSync?: CloudProviderBinding;
    nextcloudSync?: CloudProviderBinding;
    iCloudSync?: CloudProviderBinding;
    
    // Platform detection
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: Record<string, any>;
    };
    
    electronAPI?: {
      isElectron?: boolean;
      [key: string]: any;
    };
  }
}

export {};
