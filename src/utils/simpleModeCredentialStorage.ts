/**
 * Simple Mode Credential Storage
 * 
 * ⚠️ SECURITY WARNING: Credentials are stored in PLAIN TEXT in localStorage.
 * This is a convenience feature for users who understand the security trade-offs.
 * 
 * Simple Mode is suitable for:
 * - Personal devices that are physically secure
 * - Users who prioritize convenience over maximum security
 * - Low-risk use cases where journal content is not highly sensitive
 * 
 * NOT recommended for:
 * - Shared or public computers
 * - Highly sensitive journal entries
 * - Users who require maximum security
 */

import type { GoogleDriveCredentials, DropboxCredentials, ICloudCredentials, NextcloudCredentials } from '@/utils/cloudCredentialStorage';
import { scopedKey } from '@/utils/userScope';

// Plain text storage keys
const GOOGLE_DRIVE_SIMPLE_KEY = 'google_drive_simple_credentials';
const DROPBOX_SIMPLE_KEY = 'dropbox_simple_credentials';
const ICLOUD_SIMPLE_KEY = 'icloud_simple_credentials';
const NEXTCLOUD_SIMPLE_KEY = 'nextcloud_simple_credentials';

export class SimpleModeCredentialStorage {
  /**
   * Save Google Drive credentials in plain text
   * ⚠️ WARNING: Stored without encryption
   */
  static saveGoogleDriveCredentials(credentials: GoogleDriveCredentials): void {
    try {
      localStorage.setItem(scopedKey(GOOGLE_DRIVE_SIMPLE_KEY), JSON.stringify(credentials));
    } catch (error) {
      console.error('Failed to save Google Drive credentials:', error);
      throw new Error('Failed to save credentials');
    }
  }

  /**
   * Load Google Drive credentials from plain text storage
   */
  static loadGoogleDriveCredentials(): GoogleDriveCredentials | null {
    try {
      const stored = localStorage.getItem(scopedKey(GOOGLE_DRIVE_SIMPLE_KEY));
      if (!stored) return null;
      return JSON.parse(stored) as GoogleDriveCredentials;
    } catch (error) {
      console.error('Failed to load Google Drive credentials:', error);
      return null;
    }
  }

  /**
   * Save Dropbox credentials in plain text
   * ⚠️ WARNING: Stored without encryption
   */
  static saveDropboxCredentials(credentials: DropboxCredentials): void {
    try {
      localStorage.setItem(scopedKey(DROPBOX_SIMPLE_KEY), JSON.stringify(credentials));
    } catch (error) {
      console.error('Failed to save Dropbox credentials:', error);
      throw new Error('Failed to save credentials');
    }
  }

  /**
   * Load Dropbox credentials from plain text storage
   */
  static loadDropboxCredentials(): DropboxCredentials | null {
    try {
      const stored = localStorage.getItem(scopedKey(DROPBOX_SIMPLE_KEY));
      if (!stored) return null;
      return JSON.parse(stored) as DropboxCredentials;
    } catch (error) {
      console.error('Failed to load Dropbox credentials:', error);
      return null;
    }
  }

  /**
   * Clear Google Drive credentials
   */
  static clearGoogleDriveCredentials(): void {
    try {
      localStorage.removeItem(scopedKey(GOOGLE_DRIVE_SIMPLE_KEY));
    } catch (error) {
      console.error('Failed to clear Google Drive credentials:', error);
    }
  }

  /**
   * Clear Dropbox credentials
   */
  static clearDropboxCredentials(): void {
    try {
      localStorage.removeItem(scopedKey(DROPBOX_SIMPLE_KEY));
    } catch (error) {
      console.error('Failed to clear Dropbox credentials:', error);
    }
  }

  /**
   * Check if Google Drive credentials exist
   */
  static hasGoogleDriveCredentials(): boolean {
    return localStorage.getItem(scopedKey(GOOGLE_DRIVE_SIMPLE_KEY)) !== null;
  }

  /**
   * Check if Dropbox credentials exist
   */
  static hasDropboxCredentials(): boolean {
    return localStorage.getItem(scopedKey(DROPBOX_SIMPLE_KEY)) !== null;
  }

  /**
   * Save iCloud credentials in plain text
   * ⚠️ WARNING: Stored without encryption
   */
  static saveICloudCredentials(credentials: ICloudCredentials): void {
    try {
      localStorage.setItem(scopedKey(ICLOUD_SIMPLE_KEY), JSON.stringify(credentials));
    } catch (error) {
      console.error('Failed to save iCloud credentials:', error);
      throw new Error('Failed to save credentials');
    }
  }

  /**
   * Load iCloud credentials from plain text storage
   */
  static loadICloudCredentials(): ICloudCredentials | null {
    try {
      const stored = localStorage.getItem(scopedKey(ICLOUD_SIMPLE_KEY));
      if (!stored) return null;
      return JSON.parse(stored) as ICloudCredentials;
    } catch (error) {
      console.error('Failed to load iCloud credentials:', error);
      return null;
    }
  }

  /**
   * Clear iCloud credentials
   */
  static clearICloudCredentials(): void {
    try {
      localStorage.removeItem(scopedKey(ICLOUD_SIMPLE_KEY));
    } catch (error) {
      console.error('Failed to clear iCloud credentials:', error);
    }
  }

  /**
   * Check if iCloud credentials exist
   */
  static hasICloudCredentials(): boolean {
    return localStorage.getItem(scopedKey(ICLOUD_SIMPLE_KEY)) !== null;
  }

  /**
   * Save Nextcloud credentials in plain text
   * ⚠️ WARNING: Stored without encryption
   */
  static saveNextcloudCredentials(credentials: NextcloudCredentials): void {
    try {
      localStorage.setItem(scopedKey(NEXTCLOUD_SIMPLE_KEY), JSON.stringify(credentials));
    } catch (error) {
      console.error('Failed to save Nextcloud credentials:', error);
      throw new Error('Failed to save credentials');
    }
  }

  /**
   * Load Nextcloud credentials from plain text storage
   */
  static loadNextcloudCredentials(): NextcloudCredentials | null {
    try {
      const stored = localStorage.getItem(scopedKey(NEXTCLOUD_SIMPLE_KEY));
      if (!stored) return null;
      return JSON.parse(stored) as NextcloudCredentials;
    } catch (error) {
      console.error('Failed to load Nextcloud credentials:', error);
      return null;
    }
  }

  /**
   * Clear Nextcloud credentials
   */
  static clearNextcloudCredentials(): void {
    try {
      localStorage.removeItem(scopedKey(NEXTCLOUD_SIMPLE_KEY));
    } catch (error) {
      console.error('Failed to clear Nextcloud credentials:', error);
    }
  }

  /**
   * Check if Nextcloud credentials exist
   */
  static hasNextcloudCredentials(): boolean {
    return localStorage.getItem(scopedKey(NEXTCLOUD_SIMPLE_KEY)) !== null;
  }
}
