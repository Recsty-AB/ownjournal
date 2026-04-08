// Centralized Connection State Manager - Single Source of Truth for all cloud storage connections
// This is the ONLY module responsible for provider connection state and auto-binding

import { CloudProvider } from '@/types/cloudProvider';
import { getEncryptionMode } from '@/utils/encryptionModeStorage';
import { NeedsAppleSignInError, CloudKitOriginError } from '@/services/iCloudService';
import { PrimaryProviderStorage } from '@/utils/primaryProviderStorage';
import { scopedKey, getCurrentUserId } from '@/utils/userScope';

interface ConnectionEntry {
  service: CloudProvider;
  connectedAt: number;
}

type ConnectionListener = () => void;

class ConnectionStateManager {
  private static instance: ConnectionStateManager;
  private connections = new Map<string, ConnectionEntry>();
  private listeners = new Set<ConnectionListener>();
  private recentlyDisconnected = new Map<string, number>(); // Track recently disconnected providers
  private ensureConnectionsInProgress = false;
  /** Skip iCloud auto-connect until this timestamp (avoids hammering 421 when origin not allowed) */
  private icloudSkipAutoConnectUntil = 0;
  
  // Priority order for providers (determines which is "primary")
  private static readonly PROVIDER_PRIORITY: Record<string, number> = {
    'Google Drive': 1,
    'iCloud': 2,
    'Dropbox': 3,
    'Nextcloud': 4,
  };
  
  // Map from internal keys to display names
  private static readonly KEY_TO_NAME: Record<string, string> = {
    'google': 'Google Drive',
    'google-drive': 'Google Drive',
    'icloud': 'iCloud',
    'dropbox': 'Dropbox',
    'nextcloud': 'Nextcloud',
  };
  
  // How long to prevent auto-reconnect after explicit disconnect (30 seconds)
  private static readonly DISCONNECT_COOLDOWN_MS = 30000;
  
  // Persistent storage key for disabled providers
  private static readonly DISABLED_PROVIDERS_KEY = 'disabled_cloud_providers';
  
  private constructor() {
    if (import.meta.env.DEV) {
      console.log('🔧 ConnectionStateManager initialized');
      console.log(`   Disabled providers: ${this.getDisabledProviders().join(', ') || 'none'}`);
    }
  }
  
  /**
   * Check if a provider is explicitly disabled (persisted across page reloads)
   */
  isExplicitlyDisabled(name: string): boolean {
    return this.getDisabledProviders().includes(name);
  }
  
  /**
   * Get list of disabled providers from localStorage
   */
  private getDisabledProviders(): string[] {
    try {
      const disabled = localStorage.getItem(scopedKey(ConnectionStateManager.DISABLED_PROVIDERS_KEY));
      return disabled ? JSON.parse(disabled) : [];
    } catch {
      return [];
    }
  }
  
  /**
   * Add a provider to the disabled list (persists across reloads)
   */
  private addToDisabledList(name: string): void {
    const disabled = this.getDisabledProviders();
    if (!disabled.includes(name)) {
      disabled.push(name);
      localStorage.setItem(scopedKey(ConnectionStateManager.DISABLED_PROVIDERS_KEY), JSON.stringify(disabled));
      if (import.meta.env.DEV) {
        console.log(`🚫 [ConnectionStateManager] ${name} added to disabled list`);
      }
    }
  }
  
  /**
   * Remove a provider from the disabled list (when user explicitly connects)
   */
  private removeFromDisabledList(name: string): void {
    const disabled = this.getDisabledProviders();
    const updated = disabled.filter((n: string) => n !== name);
    if (updated.length !== disabled.length) {
      localStorage.setItem(scopedKey(ConnectionStateManager.DISABLED_PROVIDERS_KEY), JSON.stringify(updated));
      if (import.meta.env.DEV) {
        console.log(`✅ [ConnectionStateManager] ${name} removed from disabled list`);
      }
    }
  }
  
  static getInstance(): ConnectionStateManager {
    if (!ConnectionStateManager.instance) {
      ConnectionStateManager.instance = new ConnectionStateManager();
    }
    return ConnectionStateManager.instance;
  }
  
  /**
   * Ensure all providers with stored credentials are connected
   * This is the SINGLE method for auto-binding providers on startup
   */
  async ensureConnections(masterKey?: CryptoKey | null): Promise<void> {
    // Prevent concurrent calls
    if (this.ensureConnectionsInProgress) {
      if (import.meta.env.DEV) console.log('⏳ ensureConnections already in progress, skipping');
      return;
    }

    // Only run when a user is set so we use user-scoped keys; avoid unscoped reads after sign-out
    if (getCurrentUserId() === null) {
      if (import.meta.env.DEV) console.log('⏭️ [ConnectionStateManager] Skipping ensureConnections - no current user (sign-out or pre-auth)');
      return;
    }
    
    this.ensureConnectionsInProgress = true;
    const encryptionMode = getEncryptionMode();
    
    if (import.meta.env.DEV) {
      console.log(`🔄 [ConnectionStateManager] ensureConnections starting`, {
        mode: encryptionMode,
        hasMasterKey: !!masterKey,
        alreadyConnected: this.getConnectedProviderNames(),
        disabledProviders: this.getDisabledProviders()
      });
    }
    
    // CRITICAL FIX: In E2E mode without masterKey, skip auto-connect
    // Connections will be retried after password entry via 'encryption-initialized' event
    if (encryptionMode === 'e2e' && !masterKey) {
      if (import.meta.env.DEV) {
        console.log(`⏭️ [ConnectionStateManager] Skipping auto-connect - E2E mode requires masterKey`);
        console.log(`   Will retry after password is entered`);
      }
      this.ensureConnectionsInProgress = false;
      return;
    }
    
    try {
      // Import credential storage modules
      const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');
      const { SimpleModeCredentialStorage } = await import('@/utils/simpleModeCredentialStorage');
      
      // CRITICAL: Get saved primary provider preference BEFORE connecting
      // This ensures the preferred provider connects first and becomes primary
      const savedPrimary = PrimaryProviderStorage.get();
      
      // Define all provider connectors with fallback logic for E2E mode
      const providerConnectors: Array<{ name: string; connect: () => Promise<CloudProvider | null> }> = [
        { 
          name: 'Google Drive', 
          connect: async () => {
            const { GoogleDriveService } = await import('@/services/googleDriveService');
            let credentials = null;
            
            // Primary: E2E encrypted credentials
            if (encryptionMode === 'e2e' && masterKey) {
              credentials = await CloudCredentialStorage.loadCredentials('google-drive', masterKey);
            }
            
            // Fallback: Simple mode credentials
            if (!credentials && encryptionMode === 'simple') {
              credentials = SimpleModeCredentialStorage.loadGoogleDriveCredentials();
            }
            
            // NEW: Additional fallback for E2E mode - check simple storage too
            // This handles edge case where OAuth completed before masterKey was ready
            if (!credentials && encryptionMode === 'e2e' && masterKey) {
              const simpleCredentials = SimpleModeCredentialStorage.loadGoogleDriveCredentials();
              if (simpleCredentials) {
                // Migrate to E2E storage and use
                await CloudCredentialStorage.saveCredentials(simpleCredentials, masterKey);
                SimpleModeCredentialStorage.clearGoogleDriveCredentials();
                credentials = simpleCredentials;
                if (import.meta.env.DEV) {
                  console.log('🔄 [Google] Migrated credentials from Simple to E2E storage');
                }
              }
            }
            
            if (credentials) {
              const service = new GoogleDriveService();
              await service.connect(credentials, masterKey || null);
              return service;
            }
            return null;
          }
        },
        { 
          name: 'Dropbox', 
          connect: async () => {
            const { DropboxService } = await import('@/services/dropboxService');
            let credentials = null;
            
            // Primary: E2E encrypted credentials
            if (encryptionMode === 'e2e' && masterKey) {
              credentials = await CloudCredentialStorage.loadCredentials('dropbox', masterKey);
            }
            
            // Fallback: Simple mode credentials
            if (!credentials && encryptionMode === 'simple') {
              credentials = SimpleModeCredentialStorage.loadDropboxCredentials();
            }
            
            // NEW: Additional fallback for E2E mode - check simple storage too
            if (!credentials && encryptionMode === 'e2e' && masterKey) {
              const simpleCredentials = SimpleModeCredentialStorage.loadDropboxCredentials();
              if (simpleCredentials) {
                // Migrate to E2E storage and use
                await CloudCredentialStorage.saveCredentials(simpleCredentials, masterKey);
                SimpleModeCredentialStorage.clearDropboxCredentials();
                credentials = simpleCredentials;
                if (import.meta.env.DEV) {
                  console.log('🔄 [Dropbox] Migrated credentials from Simple to E2E storage');
                }
              }
            }
            
            if (credentials) {
              const service = new DropboxService();
              await service.connect(credentials, masterKey || null);
              return service;
            }
            return null;
          }
        },
        { 
          name: 'Nextcloud', 
          connect: async (): Promise<CloudProvider | null> => {
            const { NextcloudDirectService } = await import('@/services/nextcloudDirectService');
            let credentials = null;
            
            // Primary: E2E encrypted credentials
            if (encryptionMode === 'e2e' && masterKey) {
              credentials = await CloudCredentialStorage.loadCredentials('nextcloud', masterKey);
            }
            
            // Fallback: Simple mode credentials
            if (!credentials && encryptionMode === 'simple') {
              credentials = SimpleModeCredentialStorage.loadNextcloudCredentials();
            }
            
            // NEW: Additional fallback for E2E mode - check simple storage too
            if (!credentials && encryptionMode === 'e2e' && masterKey) {
              const simpleCredentials = SimpleModeCredentialStorage.loadNextcloudCredentials();
              if (simpleCredentials) {
                // Migrate to E2E storage and use
                await CloudCredentialStorage.saveCredentials(simpleCredentials, masterKey);
                SimpleModeCredentialStorage.clearNextcloudCredentials();
                credentials = simpleCredentials;
                if (import.meta.env.DEV) {
                  console.log('🔄 [Nextcloud] Migrated credentials from Simple to E2E storage');
                }
              }
            }
            
            if (credentials) {
              const service = new NextcloudDirectService();
              service.connect(credentials);
              return service as CloudProvider;
            }
            return null;
          }
        },
      ];
      
      // CRITICAL: If user has a saved preference, move that provider to the front
      // This ensures it connects first and becomes the primary provider
      if (savedPrimary) {
        const preferredIndex = providerConnectors.findIndex(p => p.name === savedPrimary);
        if (preferredIndex > 0) {
          const [preferred] = providerConnectors.splice(preferredIndex, 1);
          providerConnectors.unshift(preferred);
          if (import.meta.env.DEV) {
            console.log(`📌 [ConnectionStateManager] Connecting preferred provider first: ${savedPrimary}`);
          }
        }
      }
      
      // Connect providers in order (preferred first, then others)
      for (const { name, connect } of providerConnectors) {
        await this.tryAutoConnect(name, masterKey, encryptionMode, connect);
      }
      
      // iCloud auto-connect — native iOS uses CloudKit plugin, web uses CloudKit JS
      await this.tryAutoConnect('iCloud', masterKey, encryptionMode, async () => {
        const isNativeIOS = !!(window as any).Capacitor?.isNativePlatform?.() &&
          (window as any).Capacitor?.getPlatform?.() === 'ios';

        if (isNativeIOS) {
          const { ICloudNativeService, isNativeICloudEnabled } = await import('@/services/iCloudNativeService');
          if (isNativeICloudEnabled()) {
            const service = new ICloudNativeService();
            await service.connect();
            return service;
          }
          return null;
        }

        // Web/desktop: existing CloudKit JS flow
        const { ICloudService } = await import('@/services/iCloudService');
        const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');
        const { SimpleModeCredentialStorage } = await import('@/utils/simpleModeCredentialStorage');
        let credentials = null;

        if (encryptionMode === 'e2e' && masterKey) {
          credentials = await CloudCredentialStorage.loadCredentials('icloud', masterKey);
        } else if (encryptionMode === 'simple') {
          credentials = SimpleModeCredentialStorage.loadICloudCredentials();
        }

        // Prefer env vars when set so updating .env (e.g. new API token) takes effect without clearing storage
        const envToken = import.meta.env.VITE_APPLE_CLOUDKIT_API_TOKEN;
        const envContainer = import.meta.env.VITE_APPLE_CLOUDKIT_CONTAINER_ID;
        const envEnvironment = import.meta.env.VITE_APPLE_CLOUDKIT_ENVIRONMENT;
        if (credentials && (envToken || envContainer || envEnvironment)) {
          credentials = {
            ...credentials,
            ...(envContainer && { containerId: envContainer }),
            ...(envToken && { apiToken: envToken }),
            ...(envEnvironment && { environment: envEnvironment as 'development' | 'production' }),
          };
        }

        if (credentials) {
          const service = new ICloudService();
          await service.connect(credentials, masterKey || null);
          return service;
        }
        return null;
      });
      
    } finally {
      this.ensureConnectionsInProgress = false;
    }
    
    if (import.meta.env.DEV) {
      console.log(`✅ [ConnectionStateManager] ensureConnections complete. Connected: ${this.getConnectedProviderNames().join(', ') || 'none'}`);
    }
  }
  
  /**
   * Helper to try auto-connecting a single provider
   */
  private async tryAutoConnect(
    name: string,
    masterKey: CryptoKey | null | undefined,
    encryptionMode: string,
    connectFn: () => Promise<CloudProvider | null>
  ): Promise<void> {
    // Skip if already connected
    if (this.isConnected(name)) {
      if (import.meta.env.DEV) console.log(`🔗 ${name} already connected, preserving`);
      return;
    }
    
    // CRITICAL: Skip if explicitly disabled (persisted across reloads)
    if (this.isExplicitlyDisabled(name)) {
      if (import.meta.env.DEV) console.log(`🚫 Skipping ${name} auto-bind - explicitly disabled`);
      return;
    }
    
    // Skip if recently disconnected (in-memory cooldown)
    if (this.wasRecentlyDisconnected(name)) {
      if (import.meta.env.DEV) console.log(`⏭️ Skipping ${name} auto-bind - recently disconnected`);
      return;
    }

    // Skip iCloud auto-connect briefly after NeedsAppleSignInError/CloudKitOriginError to avoid repeated 421s
    if (name === 'iCloud' && Date.now() < this.icloudSkipAutoConnectUntil) {
      if (import.meta.env.DEV) console.log(`⏭️ Skipping iCloud auto-bind - recent sign-in/origin error`);
      return;
    }
    
    if (import.meta.env.DEV) {
      console.log(`🔄 Attempting auto-connect for ${name}`, {
        mode: encryptionMode,
        hasMasterKey: !!masterKey,
      });
    }
    
    try {
      const service = await connectFn();
      if (service) {
        this.registerProvider(name, service);
        if (import.meta.env.DEV) console.log(`✅ ${name} auto-connected successfully`);
      } else {
        if (import.meta.env.DEV) console.log(`⚠️ ${name} connect function returned null (no credentials found)`);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`❌ Could not auto-bind ${name}:`, error);
      if (name === 'iCloud' && (error instanceof NeedsAppleSignInError || error instanceof CloudKitOriginError)) {
        this.icloudSkipAutoConnectUntil = Date.now() + 60_000;
        if (import.meta.env.DEV) console.log(`⏭️ iCloud auto-bind skipped for 60s to avoid repeated errors`);
      }
    }
  }
  
  /**
   * Register a provider as connected
   * This is the ONLY way to mark a provider as connected
   */
  registerProvider(name: string, service: CloudProvider): void {
    const wasConnected = this.connections.has(name);
    
    // CRITICAL: If there's already a primary and we're adding a NEW provider,
    // auto-preserve the current primary to prevent auto-switching
    if (!wasConnected && this.connections.size > 0) {
      const currentPrimaryName = this.getPrimaryProviderName();
      const existingPreference = PrimaryProviderStorage.get();
      
      // Only set preference if one doesn't exist (preserves current active)
      if (currentPrimaryName && !existingPreference) {
        PrimaryProviderStorage.set(currentPrimaryName);
        if (import.meta.env.DEV) {
          console.log(`📌 [ConnectionStateManager] Auto-preserving ${currentPrimaryName} as preferred primary (adding ${name})`);
        }
      }
    }
    
    this.connections.set(name, {
      service,
      connectedAt: Date.now(),
    });
    
    // CRITICAL: If this is the FIRST provider, ALWAYS set it as preferred primary
    // This ensures the first-connected provider stays primary regardless of hardcoded order
    if (!wasConnected && this.connections.size === 1) {
      PrimaryProviderStorage.set(name);
      if (import.meta.env.DEV) {
        console.log(`📌 [ConnectionStateManager] First provider ${name} set as preferred primary`);
      }
    }
    
    // CRITICAL: Remove from disabled list when explicitly connecting
    this.removeFromDisabledList(name);
    
    // Also set window binding for backward compatibility during transition
    this.setWindowBinding(name, service);
    
    // Cache in localStorage for faster startup
    this.updateLocalStorageCache();
    
    if (import.meta.env.DEV) {
      console.log(`✅ [ConnectionStateManager] ${name} registered (was connected: ${wasConnected})`);
      console.log(`   Connected providers: ${this.getConnectedProviderNames().join(', ')}`);
      console.log(`   Current primary: ${this.getPrimaryProviderName()}`);
      console.log(`   Listener count: ${this.listeners.size}`);
    }
    
    // Notify all listeners synchronously
    this.notifyListeners();
    
    // Also notify after a microtask to ensure all React state updates have propagated
    queueMicrotask(() => {
      this.notifyListeners();
    });
  }
  
  /**
   * Unregister a provider (disconnect)
   * Marks provider as recently disconnected AND persistently disabled to prevent auto-reconnect
   */
  unregisterProvider(name: string): void {
    const wasConnected = this.connections.has(name);
    
    this.connections.delete(name);
    
    // Mark as recently disconnected to prevent auto-reconnect (in-memory)
    this.recentlyDisconnected.set(name, Date.now());
    
    // CRITICAL: Persistently disable to prevent auto-reconnect across page reloads
    this.addToDisabledList(name);
    
    // Clear user preference if disconnecting the preferred provider
    if (PrimaryProviderStorage.get() === name) {
      PrimaryProviderStorage.clear();
    }
    
    // Clear window binding
    this.clearWindowBinding(name);
    
    // Update cache
    this.updateLocalStorageCache();
    
    if (import.meta.env.DEV) {
      console.log(`🔌 [ConnectionStateManager] ${name} unregistered (was connected: ${wasConnected})`);
      console.log(`   Remaining providers: ${this.getConnectedProviderNames().join(', ') || 'none'}`);
      console.log(`   Disabled providers: ${this.getDisabledProviders().join(', ')}`);
    }
    
    if (wasConnected) {
      this.notifyListeners();
    }
  }
  
  /**
   * Check if provider was recently disconnected (within cooldown period)
   * Used to prevent auto-reconnection loops
   */
  wasRecentlyDisconnected(name: string): boolean {
    const disconnectedAt = this.recentlyDisconnected.get(name);
    if (!disconnectedAt) return false;
    
    const elapsed = Date.now() - disconnectedAt;
    if (elapsed > ConnectionStateManager.DISCONNECT_COOLDOWN_MS) {
      // Cooldown expired, clean up
      this.recentlyDisconnected.delete(name);
      return false;
    }
    
    if (import.meta.env.DEV) {
      console.log(`⏳ [ConnectionStateManager] ${name} was recently disconnected (${Math.round(elapsed/1000)}s ago)`);
    }
    return true;
  }
  
  /**
   * Clear recently disconnected status (for manual reconnection)
   */
  clearRecentlyDisconnected(name: string): void {
    this.recentlyDisconnected.delete(name);
  }
  
  /**
   * Get all connected provider names (sorted by connection time - oldest first)
   */
  getConnectedProviderNames(): string[] {
    return Array.from(this.connections.entries())
      .sort((a, b) => a[1].connectedAt - b[1].connectedAt)
      .map(([name]) => name);
  }
  
  /**
   * Get connected provider names for UI display (sorted by static priority for consistent ordering)
   */
  getConnectedProviderNamesForDisplay(): string[] {
    return Array.from(this.connections.keys()).sort((a, b) => {
      const priorityA = ConnectionStateManager.PROVIDER_PRIORITY[a] ?? 999;
      const priorityB = ConnectionStateManager.PROVIDER_PRIORITY[b] ?? 999;
      return priorityA - priorityB;
    });
  }
  
  /**
   * Get all connected providers (sorted by priority)
   */
  getConnectedProviders(): CloudProvider[] {
    return this.getConnectedProviderNames().map(name => this.connections.get(name)!.service);
  }
  
  /**
   * Get the primary provider - RESPECTS USER PREFERENCE
   * Uses getPrimaryProviderName() as single source of truth
   */
  getPrimaryProvider(): CloudProvider | null {
    const primaryName = this.getPrimaryProviderName();
    if (!primaryName) return null;
    
    return this.connections.get(primaryName)?.service ?? null;
  }
  
  /**
   * Get primary provider name
   * Respects user preference if set and the preferred provider is connected
   */
  getPrimaryProviderName(): string | null {
    const names = this.getConnectedProviderNames();
    if (names.length === 0) return null;
    
    // Check user preference first
    const preferred = PrimaryProviderStorage.get();
    if (preferred && names.includes(preferred)) {
      return preferred;
    }
    
    // Fall back to automatic priority (first in sorted list)
    return names[0];
  }
  
  /**
   * Set user's preferred primary provider
   */
  setPreferredPrimaryProvider(name: string): void {
    if (this.isConnected(name)) {
      PrimaryProviderStorage.set(name);
      if (import.meta.env.DEV) {
        console.log(`⭐ [ConnectionStateManager] User set preferred primary provider: ${name}`);
      }
      this.notifyListeners();
    }
  }
  
  /**
   * Check if a specific provider is connected (accepts both display name and internal key)
   */
  isConnected(nameOrKey: string): boolean {
    // Try direct lookup first
    if (this.connections.has(nameOrKey)) return true;
    // Try converting key to name
    const displayName = ConnectionStateManager.KEY_TO_NAME[nameOrKey];
    if (displayName && this.connections.has(displayName)) return true;
    return false;
  }
  
  /**
   * Check if a specific provider is the primary one (accepts both display name and internal key)
   */
  isPrimaryProvider(nameOrKey: string): boolean {
    const primaryName = this.getPrimaryProviderName();
    if (!primaryName) return false;
    
    // Direct match
    if (primaryName === nameOrKey) return true;
    // Check if key maps to primary name
    const displayName = ConnectionStateManager.KEY_TO_NAME[nameOrKey];
    if (displayName && primaryName === displayName) return true;
    
    return false;
  }
  
  /**
   * Get the count of connected providers
   */
  getConnectedCount(): number {
    return this.connections.size;
  }
  
  /**
   * Subscribe to connection state changes
   * Returns unsubscribe function
   */
  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Get a specific provider's service
   */
  getProvider(name: string): CloudProvider | null {
    return this.connections.get(name)?.service ?? null;
  }
  
  /**
   * Migrate credentials between encryption modes
   * When switching from Simple→E2E or E2E→Simple, re-save all credentials in the new format
   * @param fromMode - The mode we're switching from
   * @param toMode - The mode we're switching to
   * @param masterKey - Required when switching TO E2E mode (to encrypt credentials)
   */
  async migrateCredentialsForModeChange(
    fromMode: 'simple' | 'e2e',
    toMode: 'simple' | 'e2e',
    masterKey: CryptoKey | null
  ): Promise<{ migrated: string[]; failed: string[] }> {
    if (fromMode === toMode) {
      return { migrated: [], failed: [] };
    }
    
    const migrated: string[] = [];
    const failed: string[] = [];
    
    // Import credential storage modules
    const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');
    const { SimpleModeCredentialStorage } = await import('@/utils/simpleModeCredentialStorage');
    
    if (import.meta.env.DEV) {
      console.log(`🔄 [ConnectionStateManager] Migrating credentials from ${fromMode} to ${toMode}`);
    }
    
    // Get list of currently connected providers to migrate
    const connectedNames = this.getConnectedProviderNames();
    
    for (const name of connectedNames) {
      try {
        if (fromMode === 'e2e' && toMode === 'simple') {
          // E2E → Simple: Load encrypted credentials and save as plaintext
          // We need the OLD master key to decrypt
          if (!masterKey) {
            if (import.meta.env.DEV) console.warn(`⚠️ Cannot migrate ${name}: no master key to decrypt`);
            failed.push(name);
            continue;
          }
          
          let credentials = null;
          
          if (name === 'Google Drive') {
            credentials = await CloudCredentialStorage.loadCredentials('google-drive', masterKey);
            if (credentials) {
              SimpleModeCredentialStorage.saveGoogleDriveCredentials(credentials);
            }
          } else if (name === 'Dropbox') {
            credentials = await CloudCredentialStorage.loadCredentials('dropbox', masterKey);
            if (credentials) {
              SimpleModeCredentialStorage.saveDropboxCredentials(credentials);
            }
          } else if (name === 'Nextcloud') {
            credentials = await CloudCredentialStorage.loadCredentials('nextcloud', masterKey);
            if (credentials) {
              SimpleModeCredentialStorage.saveNextcloudCredentials(credentials);
            }
          } else if (name === 'iCloud') {
            credentials = await CloudCredentialStorage.loadCredentials('icloud', masterKey);
            if (credentials) {
              SimpleModeCredentialStorage.saveICloudCredentials(credentials);
            }
          }
          
          if (credentials) {
            migrated.push(name);
            if (import.meta.env.DEV) console.log(`✅ Migrated ${name} credentials to simple mode`);
          }
          
        } else if (fromMode === 'simple' && toMode === 'e2e') {
          // Simple → E2E: Load plaintext credentials and save encrypted
          if (!masterKey) {
            if (import.meta.env.DEV) console.warn(`⚠️ Cannot migrate ${name}: no master key to encrypt`);
            failed.push(name);
            continue;
          }
          
          let credentials = null;
          
          if (name === 'Google Drive') {
            credentials = SimpleModeCredentialStorage.loadGoogleDriveCredentials();
            if (credentials) {
              await CloudCredentialStorage.saveCredentials(credentials, masterKey);
            }
          } else if (name === 'Dropbox') {
            credentials = SimpleModeCredentialStorage.loadDropboxCredentials();
            if (credentials) {
              await CloudCredentialStorage.saveCredentials(credentials, masterKey);
            }
          } else if (name === 'Nextcloud') {
            credentials = SimpleModeCredentialStorage.loadNextcloudCredentials();
            if (credentials) {
              await CloudCredentialStorage.saveCredentials(credentials, masterKey);
            }
          } else if (name === 'iCloud') {
            credentials = SimpleModeCredentialStorage.loadICloudCredentials();
            if (credentials) {
              await CloudCredentialStorage.saveCredentials(credentials, masterKey);
            }
          }
          
          if (credentials) {
            migrated.push(name);
            if (import.meta.env.DEV) console.log(`✅ Migrated ${name} credentials to E2E mode`);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error(`❌ Failed to migrate ${name} credentials:`, error);
        failed.push(name);
      }
    }
    
    if (import.meta.env.DEV) {
      console.log(`🔄 Credential migration complete: ${migrated.length} migrated, ${failed.length} failed`);
    }
    
    return { migrated, failed };
  }
  
  /**
   * Re-enable a provider that was previously disabled
   * Used when user explicitly wants to reconnect a provider
   */
  enableProvider(name: string): void {
    this.removeFromDisabledList(name);
    this.clearRecentlyDisconnected(name);
    if (import.meta.env.DEV) {
      console.log(`✅ [ConnectionStateManager] ${name} re-enabled for auto-connect`);
    }
  }
  
  /**
   * Get display config from a provider (if the service supports getDisplayConfig)
   * Returns serverUrl and username for UI display without exposing credentials
   */
  getProviderDisplayConfig(name: string): { serverUrl?: string; username?: string } | null {
    const connection = this.connections.get(name);
    if (!connection) return null;
    
    // Check if service has getDisplayConfig method
    const service = connection.service as any;
    if (typeof service.getDisplayConfig === 'function') {
      return service.getDisplayConfig();
    }
    
    return null;
  }
  
  /**
   * Check if should delay sync (rate limit protection for just-connected providers)
   */
  shouldDelaySync(providerName: string): boolean {
    const connection = this.connections.get(providerName);
    if (!connection) return false;
    
    const elapsed = Date.now() - connection.connectedAt;
    if (elapsed < 3000) { // 3 second delay after connection
      if (import.meta.env.DEV) {
        console.log(`⏳ [ConnectionStateManager] Delaying sync for ${providerName} - connected ${elapsed}ms ago`);
      }
      return true;
    }
    return false;
  }
  
  /**
   * Clear all in-memory connections (e.g. on sign-out).
   * Do NOT call unregisterProvider() and do NOT add providers to the disabled list,
   * so the same account can auto-reconnect (ensureConnections) when they sign back in.
   * User-scoped credentials remain in localStorage; only in-memory state is cleared.
   */
  clearAll(): void {
    const hadConnections = this.connections.size > 0;

    // Clear all window bindings
    for (const name of this.connections.keys()) {
      this.clearWindowBinding(name);
    }

    this.connections.clear();
    this.updateLocalStorageCache();

    // Reset the iCloud skip timer so auto-connect can run again after sign-in
    // (relevant when signing out and back in within the same page session).
    this.icloudSkipAutoConnectUntil = 0;
    
    if (hadConnections) {
      this.notifyListeners();
    }
  }
  
  /**
   * Get cached provider names from localStorage (for fast startup)
   */
  getCachedProviderNames(): string[] {
    try {
      const cached = localStorage.getItem(scopedKey('connected_providers'));
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
  
  // ============ Private Methods ============
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        if (import.meta.env.DEV) console.error('[ConnectionStateManager] Listener error:', error);
      }
    }
  }
  
  private updateLocalStorageCache(): void {
    const names = this.getConnectedProviderNames();
    if (names.length > 0) {
      localStorage.setItem(scopedKey('connected_providers'), JSON.stringify(names));
    } else {
      localStorage.removeItem(scopedKey('connected_providers'));
    }
  }
  
  private setWindowBinding(name: string, service: CloudProvider): void {
    if (typeof window === 'undefined') return;
    
    const bindingKey = this.getWindowBindingKey(name);
    if (bindingKey) {
      (window as any)[bindingKey] = {
        name,
        isConnected: true,
        service,
        upload: service.upload.bind(service),
        download: service.download.bind(service),
        listFiles: service.listFiles.bind(service),
        delete: service.delete.bind(service),
        exists: service.exists.bind(service),
        disconnect: service.disconnect?.bind(service),
      };
    }
  }
  
  private clearWindowBinding(name: string): void {
    if (typeof window === 'undefined') return;
    
    const bindingKey = this.getWindowBindingKey(name);
    if (bindingKey) {
      (window as any)[bindingKey] = undefined;
    }
  }
  
  private getWindowBindingKey(name: string): string | null {
    const mapping: Record<string, string> = {
      'Google Drive': 'googleDriveSync',
      'Dropbox': 'dropboxSync',
      'Nextcloud': 'nextcloudSync',
      'iCloud': 'iCloudSync',
    };
    return mapping[name] ?? null;
  }
}

// Export singleton instance
export const connectionStateManager = ConnectionStateManager.getInstance();
