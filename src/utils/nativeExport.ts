/**
 * Native Export Utilities for Capacitor (Android/iOS)
 * Provides platform-aware file saving and sharing functionality
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Check if running on a Capacitor native platform (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

/**
 * Convert Blob to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export interface NativeExportResult {
  path: string;
  uri: string;
  fileName: string;
}

/**
 * Save file to device Downloads directory on native platform
 * Returns the file path and URI for display/sharing
 */
export const saveFileNative = async (
  content: Blob,
  fileName: string,
  _mimeType: string
): Promise<NativeExportResult> => {
  try {
    // Convert blob to base64
    const base64Data = await blobToBase64(content);
    
    // Write file to Documents directory (more reliable on Android)
    // Note: On Android 10+, Downloads is not directly accessible via Filesystem
    // Documents directory is accessible and files can be shared from there
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
    });

    console.log('✅ File saved to native filesystem:', result.uri);

    // The URI can be used for sharing
    return {
      path: `Documents/${fileName}`,
      uri: result.uri,
      fileName,
    };
  } catch (error) {
    console.error('Failed to save file natively:', error);
    throw error;
  }
};

/**
 * Share file using native share sheet
 */
export const shareFileNative = async (
  uri: string,
  title: string
): Promise<void> => {
  try {
    await Share.share({
      title,
      url: uri,
      dialogTitle: title,
    });
    console.log('✅ Native share dialog opened');
  } catch (error) {
    // User may have cancelled the share
    console.log('Share cancelled or failed:', error);
  }
};

/**
 * Check if native sharing is available
 */
export const canShareNative = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    return false;
  }
  try {
    const result = await Share.canShare();
    return result.value;
  } catch {
    return false;
  }
};

/**
 * Open a file with the default system application
 * Used for PDF and Word files after export
 * Uses dynamic import to avoid loading native plugin in web environment
 */
export const openFileNative = async (
  uri: string,
  mimeType: string
): Promise<void> => {
  if (!isNativePlatform()) {
    console.log('openFileNative: Not on native platform, skipping');
    return;
  }
  
  try {
    // Dynamic import to avoid bundling issues in web environment
    const { FileOpener } = await import('@capacitor-community/file-opener');
    await FileOpener.open({
      filePath: uri,
      contentType: mimeType,
      openWithDefault: true,
    });
    console.log('✅ File opened with native app');
  } catch (error) {
    // Log but don't throw - opening is optional, file is still saved
    console.log('Could not open file with default app:', error);
    throw error;
  }
};

/**
 * Save JSON backup to device Documents directory on native platform
 * Returns the file path and URI for display/sharing
 */
export const saveJsonBackupNative = async (
  data: object,
  fileName: string
): Promise<NativeExportResult> => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    
    const result = await Filesystem.writeFile({
      path: fileName,
      data: jsonString,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    console.log('✅ JSON backup saved to native filesystem:', result.uri);

    return {
      path: `Documents/${fileName}`,
      uri: result.uri,
      fileName,
    };
  } catch (error) {
    console.error('Failed to save JSON backup natively:', error);
    throw error;
  }
};
