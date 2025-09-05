/**
 * Unified Encryption State Manager
 * 
 * SINGLE SOURCE OF TRUTH for all encryption-related state.
 * This manager enforces critical invariants:
 * 
 * INVARIANT 1: E2E mode REQUIRES either a stored password OR a master key
 *              If neither exists, auto-revert to 'simple' mode
 * 
 * INVARIANT 2: Password clearing must be selective
 *              - Clear on DECRYPTION_FAILED (wrong password)
 *              - DON'T clear on NO_CLOUD_KEY (password is fine, just no cloud key yet)
 * 
 * INVARIANT 3: Global password requirement events
 *              - Any component can request password via 'require-password' event
 *              - Index.tsx listens and shows the dialog
 */

import { setEncryptionMode, isE2EEnabled } from '@/utils/encryptionModeStorage';
import { hasStoredPassword, clearPassword, retrievePassword } from '@/utils/passwordStorage';
// CRITICAL: Import storageServiceV2 directly for synchronous operations like resetToSimpleMode
// The circular dependency is broken because this module doesn't run code at import time
import { storageServiceV2 } from './storageServiceV2';

export interface EncryptionState {
  mode: 'simple' | 'e2e';
  hasStoredPassword: boolean;
  hasMasterKey: boolean;
  isReady: boolean;
  isInitialized: boolean;
  needsPassword?: boolean;
}

export type EncryptionStateListener = (state: EncryptionState) => void;

// Lazy getter to avoid circular dependency during initial load - uses ES6 dynamic import
let _storageServiceV2: any = null;
let _storageServiceV2Loading: Promise<any> | null = null;

async function getStorageServiceAsync() {
  // Prefer the direct import if available
  if (storageServiceV2) return storageServiceV2;
  if (_storageServiceV2) return _storageServiceV2;
  if (!_storageServiceV2Loading) {
    _storageServiceV2Loading = import('./storageServiceV2').then(m => {
      _storageServiceV2 = m.storageServiceV2;
      return _storageServiceV2;
    });
  }
  return _storageServiceV2Loading;
}

function getStorageService() {
  // Prefer the direct import if available
  if (storageServiceV2) return storageServiceV2;
  // Trigger async load if not yet loaded
  if (!_storageServiceV2) {
    getStorageServiceAsync().catch(e => {
      if (import.meta.env.DEV) console.warn('Failed to lazy-load storageServiceV2:', e);
    });
  }
  return _storageServiceV2;
}

class EncryptionStateManager {
  private listeners: Set<EncryptionStateListener> = new Set();

  /**
   * Get the current encryption state with invariant enforcement
   * 
   * DELEGATES to storageServiceV2 as the SINGLE source of truth
   * This ensures consistency across the app
   */
  getState(): EncryptionState {
    try {
      const service = getStorageService();
      if (service && typeof service.getEncryptionState === 'function') {
        return service.getEncryptionState();
      }
    } catch (e) {
      // Service not yet available during initialization
    }
    
    // Fallback if storageServiceV2 not yet initialized
    const mode = isE2EEnabled() ? 'e2e' : 'simple';
    const storedPassword = hasStoredPassword();
    
    // Can't check masterKey without service, assume false
    return {
      mode,
      hasStoredPassword: storedPassword,
      hasMasterKey: false,
      isReady: mode === 'simple',
      isInitialized: false,
      needsPassword: mode === 'e2e' && !storedPassword
    };
  }

  /**
   * Notify listeners that encryption state has changed
   * Call this after any state-changing operation
   */
  notifyStateChanged(): void {
    this.notifyListeners();
    
    // Also dispatch global event for components that don't use subscription
    const state = this.getState();
    window.dispatchEvent(new CustomEvent('encryption-state-changed', { 
      detail: { 
        mode: state.mode, 
        hasPassword: state.hasStoredPassword, 
        hasMasterKey: state.hasMasterKey 
      }
    }));
  }

  /**
   * Get the master key - DELEGATES to storageServiceV2
   */
  getMasterKey(): CryptoKey | null {
    try {
      const service = getStorageService();
      if (service && typeof service.getMasterKey === 'function') {
        return service.getMasterKey();
      }
    } catch (e) {
      // Service not yet available
    }
    return null;
  }

  /**
   * Check if initialized - DELEGATES to storageServiceV2
   */
  isInitialized(): boolean {
    try {
      const service = getStorageService();
      if (service && typeof service.isFullyInitialized === 'function') {
        return service.isFullyInitialized();
      }
    } catch (e) {
      // Service not yet available
    }
    return false;
  }

  /**
   * Handle initialization error appropriately
   * 
   * CRITICAL: Only clear password on DECRYPTION_FAILED, not on other errors
   * 
   * @returns true if password was cleared, false otherwise
   */
  handleInitializationError(error: Error): { passwordCleared: boolean; shouldPromptPassword: boolean } {
    const errorMessage = error.message;

    // DECRYPTION_FAILED = wrong password → clear it
    if (errorMessage.includes('DECRYPTION_FAILED') || errorMessage.includes('incorrect password')) {
      if (import.meta.env.DEV) console.log('🔐 [EncryptionStateManager] Decryption failed - clearing invalid password');
      clearPassword();
      // Also clear master key in storageServiceV2
      try {
        const service = getStorageService();
        if (service && typeof service.clearMasterKey === 'function') {
          service.clearMasterKey();
        }
      } catch (e) {
        // Service not available
      }
      this.notifyListeners();
      return { passwordCleared: true, shouldPromptPassword: true };
    }

    // NO_CLOUD_KEY = password is fine, just no cloud key yet
    // User needs to connect cloud storage first
    if (errorMessage === 'NO_CLOUD_KEY') {
      if (import.meta.env.DEV) console.log('ℹ️ [EncryptionStateManager] No cloud key - password is valid, need cloud storage');
      return { passwordCleared: false, shouldPromptPassword: false };
    }
    
    // CLOUD_KEY_REQUIRED = encrypted entries exist but no cloud connected
    // User needs to reconnect to cloud storage - don't clear password or prompt
    if (errorMessage === 'CLOUD_KEY_REQUIRED') {
      if (import.meta.env.DEV) console.log('ℹ️ [EncryptionStateManager] Cloud key required - password is valid, need cloud storage');
      return { passwordCleared: false, shouldPromptPassword: false };
    }

    // Other errors - don't clear password blindly
    if (import.meta.env.DEV) console.log('⚠️ [EncryptionStateManager] Initialization error (keeping password):', errorMessage);
    return { passwordCleared: false, shouldPromptPassword: false };
  }

  /**
   * Request password dialog to be shown globally
   * Any component can call this - Index.tsx listens for the event
   * 
   * NOTE: Prefer using requestPasswordIfNeeded() which checks first
   */
  requestPassword(): void {
    if (import.meta.env.DEV) {
      console.log('🔔 [EncryptionStateManager] Requesting password dialog (direct)');
    }
    window.dispatchEvent(new CustomEvent('require-password'));
  }

  /**
   * SINGLE ENTRY POINT for requesting password dialog
   * 
   * All components should call this instead of dispatching 'require-password' directly.
   * This method:
   * 1. Checks if password is actually required using isPasswordInputRequired()
   * 2. Only dispatches 'require-password' event if needed
   * 3. Returns whether the dialog was requested
   * 
   * @param source - Optional source identifier for debugging
   * @returns true if password dialog was requested, false if not needed
   */
  async requestPasswordIfNeeded(source?: string): Promise<boolean> {
    if (import.meta.env.DEV) {
      console.log(`🔍 [EncryptionStateManager] requestPasswordIfNeeded called from: ${source || 'unknown'}`);
    }
    
    const needed = await this.isPasswordInputRequired();
    
    if (needed) {
      if (import.meta.env.DEV) {
        console.log('🔔 [EncryptionStateManager] Password IS required - dispatching event');
      }
      window.dispatchEvent(new CustomEvent('require-password'));
      return true;
    } else {
      if (import.meta.env.DEV) {
        console.log('✅ [EncryptionStateManager] Password NOT required - skipping dialog');
      }
      return false;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: EncryptionStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        if (import.meta.env.DEV) console.error('[EncryptionStateManager] Listener error:', error);
      }
    });
  }

  /**
   * Validate current state and auto-fix if invalid
   * Call this on app startup or after any state-changing operation
   */
  validateAndFix(): EncryptionState {
    const state = this.getState(); // This already enforces invariants
    return state;
  }

  /**
   * Check if E2E mode is properly configured (has password or master key)
   */
  isE2EReady(): boolean {
    const state = this.getState();
    if (state.mode !== 'e2e') return true; // Simple mode is always "ready"
    return state.hasMasterKey || state.hasStoredPassword;
  }

  /**
   * SINGLE SOURCE OF TRUTH: Reset encryption mode to 'simple'
   * 
   * This method ensures ALL encryption state is properly cleared:
   * - Clears stored password
   * - Clears master key from memory
   * - Sets mode to 'simple' in localStorage
   * - Notifies all subscribers
   * - Dispatches global event for components that don't use subscription
   * 
   * Use this when:
   * - User clears password in StorageSecuritySettings
   * - User explicitly wants to switch to Simple mode
   */
  async resetToSimpleMode(): Promise<void> {
    if (import.meta.env.DEV) console.log('🔐 [EncryptionStateManager] Resetting to Simple mode...');
    
    // 1. Set mode to simple in localStorage FIRST (source of truth)
    // This ensures getEncryptionMode() returns 'simple' immediately
    setEncryptionMode('simple');
    if (import.meta.env.DEV) console.log('  ✓ Mode set to simple');
    
    // 2. Clear password from secure storage
    clearPassword();
    if (import.meta.env.DEV) console.log('  ✓ Password cleared');
    
    // 3. Clear master key from memory - use DIRECT import (always available)
    try {
      storageServiceV2.clearMasterKey();
      if (import.meta.env.DEV) console.log('  ✓ Master key cleared');
    } catch (e) {
      if (import.meta.env.DEV) console.warn('  ⚠️ Failed to clear master key:', e);
    }
    
    // 4. Notify all subscribers AFTER state is fully updated
    // This ensures components read the correct mode from localStorage
    this.notifyStateChanged();
    
    if (import.meta.env.DEV) console.log('✅ [EncryptionStateManager] Reset to Simple mode complete');
  }

  /**
   * SINGLE SOURCE OF TRUTH: Check if password input dialog should be shown
   * 
   * Returns true ONLY if password input is actually needed:
   * - E2E mode is enabled AND
   * - No master key exists AND
   * - No stored password exists OR stored password can't auto-initialize
   * 
   * This prevents:
   * - Showing password dialog when password is already stored
   * - Showing password dialog in Simple mode
   * - Showing password dialog when master key already exists
   */
  async isPasswordInputRequired(): Promise<boolean> {
    // If not in E2E mode, never need password
    if (!isE2EEnabled()) {
      if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Not in E2E mode → false');
      return false;
    }
    
    // If master key already exists, don't need password
    const existingKey = this.getMasterKey();
    if (existingKey) {
      if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Master key exists → false');
      return false;
    }
    
    // CRITICAL: Check if service is in pending-oauth state
    // In this state, password is already stored and waiting for OAuth to complete
    const service = getStorageService();
    if (service && service.isPendingOAuth) {
      if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Service in pending-oauth state → false');
      return false;
    }
    
    // CRITICAL: Also check sessionStorage for onboarding-pending-oauth
    // This flag indicates password was set during onboarding, waiting for OAuth
    const hasPendingOnboardingOAuth = sessionStorage.getItem('onboarding-pending-oauth') !== null;
    if (hasPendingOnboardingOAuth && hasStoredPassword()) {
      if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Onboarding OAuth pending with stored password → false');
      return false;
    }
    
    // If stored password exists, try to auto-initialize (don't prompt user)
    if (hasStoredPassword()) {
      if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Stored password exists, trying auto-init...');
      try {
        const password = await retrievePassword();
        if (password) {
          const asyncService = await getStorageServiceAsync();
          if (asyncService && typeof asyncService.initialize === 'function') {
            await asyncService.initialize(password);
            // Check if initialization succeeded OR if we're now in pending-oauth
            const newKey = this.getMasterKey();
            if (newKey) {
              if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Auto-initialized successfully → false');
              return false;
            }
            // Check pending-oauth again after init
            if (asyncService.isPendingOAuth) {
              if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] Now in pending-oauth after init → false');
              return false;
            }
          }
        }
      } catch (e) {
        // Auto-init failed - check if it's a "password stored, awaiting cloud" scenario
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage === 'NO_CLOUD_KEY') {
          // Password is fine, just no cloud key yet - don't clear password
          if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] NO_CLOUD_KEY error (password valid) → false');
          return false;
        }
        // Other errors - password may be invalid
        if (import.meta.env.DEV) console.warn('🔍 [isPasswordInputRequired] Auto-init failed:', e);
        // Clear invalid password only on decryption failure
        if (errorMessage.includes('DECRYPTION_FAILED') || errorMessage.includes('incorrect password')) {
          clearPassword();
        }
        // Continue to return true (need new password)
      }
    }
    
    // No password or auto-init failed, need user to enter password
    if (import.meta.env.DEV) console.log('🔍 [isPasswordInputRequired] No valid password → true');
    return true;
  }
}

// Singleton instance
export const encryptionStateManager = new EncryptionStateManager();
