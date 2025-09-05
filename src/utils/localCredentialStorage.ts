// Local credential storage - encrypted with journal password
// DEPRECATED: Use CloudCredentialStorage instead
// This file maintains backward compatibility for existing Nextcloud users
import { CloudCredentialStorage, type NextcloudCredentials as NextcloudCreds } from './cloudCredentialStorage';

interface NextcloudCredentials {
  serverUrl: string;
  username: string;
  appPassword: string;
}

export class LocalCredentialStorage {
  private static LEGACY_KEY = 'nextcloud_credentials_encrypted';

  /**
   * Save credentials - redirects to new CloudCredentialStorage
   */
  static async saveCredentials(
    credentials: NextcloudCredentials,
    masterKey: CryptoKey
  ): Promise<void> {
    const creds: NextcloudCreds = {
      provider: 'nextcloud',
      ...credentials
    };
    await CloudCredentialStorage.saveCredentials(creds, masterKey);
    
    // Clean up legacy storage
    try {
      localStorage.removeItem(this.LEGACY_KEY);
    } catch {}
  }

  /**
   * Load credentials - tries new system first, then legacy
   */
  static async loadCredentials(masterKey: CryptoKey): Promise<NextcloudCredentials | null> {
    try {
      // Try new system first
      const creds = await CloudCredentialStorage.loadCredentials<NextcloudCreds>(
        'nextcloud',
        masterKey
      );
      
      if (creds) {
        return {
          serverUrl: creds.serverUrl,
          username: creds.username,
          appPassword: creds.appPassword,
        };
      }

      // Try legacy system
      const stored = localStorage.getItem(this.LEGACY_KEY);
      if (stored) {
        // Migrate to new system
        const { encryptData, decryptData, arrayBufferToBase64, base64ToArrayBuffer } = await import('./encryption');
        const encryptedData = JSON.parse(stored);
        const encrypted = base64ToArrayBuffer(encryptedData.data);
        const iv = base64ToArrayBuffer(encryptedData.iv);
        const decryptedString = await decryptData(encrypted, masterKey, iv);
        const legacyCreds = JSON.parse(decryptedString) as NextcloudCredentials;
        
        // Save to new system
        await this.saveCredentials(legacyCreds, masterKey);
        
        return legacyCreds;
      }

      return null;
    } catch (error) {
      // Clean up on error
      try {
        localStorage.removeItem(this.LEGACY_KEY);
        CloudCredentialStorage.clearCredentials('nextcloud');
      } catch {}
      return null;
    }
  }

  /**
   * Remove stored credentials
   */
  static clearCredentials(): void {
    CloudCredentialStorage.clearCredentials('nextcloud');
    try {
      localStorage.removeItem(this.LEGACY_KEY);
    } catch {}
  }

  /**
   * Check if credentials exist
   */
  static hasCredentials(): boolean {
    return CloudCredentialStorage.hasCredentials('nextcloud') || 
           localStorage.getItem(this.LEGACY_KEY) !== null;
  }
}
