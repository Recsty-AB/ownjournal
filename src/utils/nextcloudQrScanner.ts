/**
 * Nextcloud QR Code Scanner Utility
 * Scans QR codes from Nextcloud's "New App Password" screen to extract connection credentials
 * 
 * QR Code Format (JSON):
 * {
 *   "server": "https://your-nextcloud.com",
 *   "loginName": "username",
 *   "appPassword": "GPM6x-SQMDP-aH13A-b2thZ-cEz2f"
 * }
 */

import { getPlatformInfo } from '@/utils/platformDetection';
import { registerPlugin } from '@capacitor/core';

interface OwnJournalQrScannerPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  checkPermissions(): Promise<{ camera: 'granted' | 'denied' | 'prompt' | 'restricted' }>;
  requestPermissions(): Promise<{ camera: 'granted' | 'denied' | 'prompt' | 'restricted' }>;
  scan(): Promise<{ rawValue: string | null; cancelled: boolean }>;
}

const OwnJournalQrScanner = registerPlugin<OwnJournalQrScannerPlugin>('OwnJournalQrScanner');

function isIOSNative(): boolean {
  return getPlatformInfo().platform === 'capacitor-ios';
}

export interface NextcloudQrConfig {
  serverUrl: string;
  username: string;
  appPassword: string;
}

export interface QrScanResult {
  success: boolean;
  config?: NextcloudQrConfig;
  error?: 'permission_denied' | 'cancelled' | 'invalid_format' | 'not_supported' | 'unknown';
  errorMessage?: string;
}

/**
 * Parse Nextcloud QR code content
 * Supports JSON format: { server, loginName, appPassword }
 * Also supports nc:// URL format as fallback
 */
export function parseNextcloudQr(content: string): NextcloudQrConfig | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const trimmedContent = content.trim();

  // Try JSON format first (official Nextcloud format)
  try {
    const parsed = JSON.parse(trimmedContent);
    
    // Validate required fields
    if (parsed.server && parsed.loginName && parsed.appPassword) {
      return {
        serverUrl: normalizeServerUrl(parsed.server),
        username: parsed.loginName,
        appPassword: parsed.appPassword,
      };
    }
    
    // Also check for alternative field names
    if (parsed.serverUrl && parsed.username && parsed.password) {
      return {
        serverUrl: normalizeServerUrl(parsed.serverUrl),
        username: parsed.username,
        appPassword: parsed.password,
      };
    }
  } catch {
    // Not JSON, try other formats
  }

  // Try nc:// URL format (nc://login/server:host&user:username&password:apppassword)
  if (trimmedContent.startsWith('nc://')) {
    try {
      const url = new URL(trimmedContent);
      const params = new URLSearchParams(url.search);
      
      const server = params.get('server') || extractNcParam(trimmedContent, 'server');
      const user = params.get('user') || extractNcParam(trimmedContent, 'user');
      const password = params.get('password') || extractNcParam(trimmedContent, 'password');
      
      if (server && user && password) {
        return {
          serverUrl: normalizeServerUrl(server),
          username: user,
          appPassword: password,
        };
      }
    } catch {
      // Invalid URL format
    }
  }

  return null;
}

/**
 * Extract parameter from nc:// URL format (non-standard query string)
 */
function extractNcParam(url: string, param: string): string | null {
  const regex = new RegExp(`${param}:([^&]+)`);
  const match = url.match(regex);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Normalize server URL to include https://
 */
function normalizeServerUrl(url: string): string {
  let normalized = url.trim();
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');
  
  // Add https:// if no protocol specified
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized;
  }
  
  return normalized;
}

/**
 * Check if QR scanning is available on this platform
 */
export function isQrScanningAvailable(): boolean {
  return getPlatformInfo().isCapacitor;
}

class QrPermissionError extends Error {}
class QrUnsupportedError extends Error {}

/**
 * iOS path: thin wrapper around our AVFoundation-based plugin.
 * Returns the raw QR string, or null if the user cancelled.
 */
async function scanWithNativePlugin(): Promise<string | null> {
  const { supported } = await OwnJournalQrScanner.isSupported();
  if (!supported) {
    throw new QrUnsupportedError('Camera is not available on this device');
  }

  let perm = await OwnJournalQrScanner.checkPermissions();
  if (perm.camera === 'denied' || perm.camera === 'restricted') {
    throw new QrPermissionError(
      'Camera permission was denied. Please enable camera access in your device settings.'
    );
  }
  if (perm.camera !== 'granted') {
    perm = await OwnJournalQrScanner.requestPermissions();
    if (perm.camera !== 'granted') {
      throw new QrPermissionError('Camera permission is required to scan QR codes');
    }
  }

  const result = await OwnJournalQrScanner.scan();
  if (result.cancelled) return null;
  return result.rawValue;
}

/**
 * Android path: @capacitor-mlkit/barcode-scanning.
 * Returns the raw QR string, or null if the user cancelled.
 */
async function scanWithMlkit(): Promise<string | null> {
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) {
    throw new QrUnsupportedError('Barcode scanning is not supported on this device');
  }

  let perm = await BarcodeScanner.checkPermissions();
  if (perm.camera === 'denied') {
    throw new QrPermissionError(
      'Camera permission was denied. Please enable camera access in your device settings.'
    );
  }
  if (perm.camera !== 'granted') {
    try {
      perm = await BarcodeScanner.requestPermissions();
    } catch (e) {
      console.error('Permission request failed:', e);
      throw new QrPermissionError('Failed to request camera permission.');
    }
    if (perm.camera !== 'granted') {
      throw new QrPermissionError('Camera permission is required to scan QR codes');
    }
  }

  const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
  if (!result.barcodes || result.barcodes.length === 0) return null;
  return result.barcodes[0].rawValue ?? '';
}

/**
 * Scan a Nextcloud QR code using the device camera
 * Only works on native iOS/Android platforms
 */
export async function scanNextcloudQr(): Promise<QrScanResult> {
  if (!getPlatformInfo().isCapacitor) {
    return {
      success: false,
      error: 'not_supported',
      errorMessage: 'QR scanning is only available on mobile devices',
    };
  }

  try {
    const rawValue = isIOSNative()
      ? await scanWithNativePlugin()
      : await scanWithMlkit();

    // null means the user cancelled
    if (rawValue === null) {
      return {
        success: false,
        error: 'cancelled',
        errorMessage: 'Scan was cancelled',
      };
    }

    if (!rawValue) {
      return {
        success: false,
        error: 'invalid_format',
        errorMessage: 'QR code is empty',
      };
    }

    const config = parseNextcloudQr(rawValue);
    if (!config) {
      return {
        success: false,
        error: 'invalid_format',
        errorMessage: 'Invalid QR code format. Please scan the QR code from Nextcloud\'s app password screen.',
      };
    }

    return { success: true, config };
  } catch (error) {
    if (error instanceof QrPermissionError) {
      return {
        success: false,
        error: 'permission_denied',
        errorMessage: error.message,
      };
    }
    if (error instanceof QrUnsupportedError) {
      return {
        success: false,
        error: 'not_supported',
        errorMessage: error.message,
      };
    }
    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // User cancelled via back button or similar
    if (errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
      return {
        success: false,
        error: 'cancelled',
        errorMessage: 'Scan was cancelled',
      };
    }

    console.error('QR scan error:', error);
    
    return {
      success: false,
      error: 'unknown',
      errorMessage: errorMessage,
    };
  }
}
