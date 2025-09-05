// Encrypted local storage for all cloud provider credentials
import { encryptData, decryptData, arrayBufferToBase64, base64ToArrayBuffer } from './encryption';
import { scopedKey } from './userScope';

interface NextcloudCredentials {
  provider: 'nextcloud';
  serverUrl: string;
  username: string;
  appPassword: string;
}

interface GoogleDriveCredentials {
  provider: 'google-drive';
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp
}

interface DropboxCredentials {
  provider: 'dropbox';
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp
}

interface ICloudCredentials {
  provider: 'icloud';
  apiToken: string;
  containerId: string;
  environment: 'development' | 'production';
}

type CloudCredentials = NextcloudCredentials | GoogleDriveCredentials | DropboxCredentials | ICloudCredentials;

export class CloudCredentialStorage {
  private static getStorageKey(provider: string): string {
    return scopedKey(`cloud_credentials_${provider}_encrypted`);
  }

  /**
   * Save credentials encrypted with the journal password
   */
  static async saveCredentials<T extends CloudCredentials>(
    credentials: T,
    masterKey: CryptoKey
  ): Promise<void> {
    const plaintext = JSON.stringify(credentials);
    const { encrypted, iv } = await encryptData(plaintext, masterKey);
    
    const encryptedData = {
      data: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv),
    };
    
    const key = this.getStorageKey(credentials.provider);
    localStorage.setItem(key, JSON.stringify(encryptedData));
  }

  /**
   * Load and decrypt credentials using the journal password
   */
  static async loadCredentials<T extends CloudCredentials>(
    provider: string,
    masterKey: CryptoKey
  ): Promise<T | null> {
    try {
      const key = this.getStorageKey(provider);
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const encryptedData = JSON.parse(stored);
      const encrypted = base64ToArrayBuffer(encryptedData.data);
      const iv = base64ToArrayBuffer(encryptedData.iv);

      const decryptedString = await decryptData(encrypted, masterKey, iv);
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      // FIXED: Don't auto-delete credentials on decryption failure
      // This prevents race conditions where credentials get deleted during
      // temporary masterKey changes or quick successive load attempts
      if (import.meta.env.DEV) {
        console.warn(`⚠️ Failed to decrypt ${provider} credentials (wrong key or corrupted):`, error);
      }
      return null;
    }
  }

  /**
   * Remove stored credentials for a provider (with verification)
   * PRIVACY: Ensures credentials are completely removed from storage
   */
  static async removeCredentials(provider: string, masterKey: CryptoKey): Promise<void> {
    const key = this.getStorageKey(provider);
    localStorage.removeItem(key);
    
    // Verify removal
    if (localStorage.getItem(key) !== null) {
      throw new Error('Failed to remove credentials from storage');
    }
  }

  /**
   * Remove stored credentials for a provider (legacy method)
   */
  static clearCredentials(provider: string): void {
    const key = this.getStorageKey(provider);
    localStorage.removeItem(key);
  }

  /**
   * Check if credentials exist for a provider
   */
  static hasCredentials(provider: string): boolean {
    const key = this.getStorageKey(provider);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Manually remove corrupted credentials (for recovery scenarios)
   * Use this when credentials exist but consistently fail to decrypt
   */
  static forceRemoveCredentials(provider: string): void {
    const key = this.getStorageKey(provider);
    localStorage.removeItem(key);
    if (import.meta.env.DEV) {
      console.log(`🗑️ Force removed ${provider} credentials`);
    }
  }
}

export type { NextcloudCredentials, GoogleDriveCredentials, DropboxCredentials, ICloudCredentials, CloudCredentials };
