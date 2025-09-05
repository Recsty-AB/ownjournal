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
    // Dynamic import to prevent web build issues
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

    // Check if scanning is supported
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) {
      return {
        success: false,
        error: 'not_supported',
        errorMessage: 'Barcode scanning is not supported on this device',
      };
    }

    // Check and request camera permission with better handling
    let permissionStatus = await BarcodeScanner.checkPermissions();

    if (permissionStatus.camera === 'denied') {
      // Permission was previously denied - user needs to enable in settings
      return {
        success: false,
        error: 'permission_denied',
        errorMessage: 'Camera permission was denied. Please enable camera access in your device settings.',
      };
    }

    if (permissionStatus.camera !== 'granted') {
      // Request permission - this should trigger the system dialog
      try {
        const requestResult = await BarcodeScanner.requestPermissions();
        permissionStatus = requestResult;
      } catch (permError) {
        console.error('Permission request failed:', permError);
        return {
          success: false,
          error: 'permission_denied',
          errorMessage: 'Failed to request camera permission.',
        };
      }
      
      if (permissionStatus.camera !== 'granted') {
        return {
          success: false,
          error: 'permission_denied',
          errorMessage: 'Camera permission is required to scan QR codes',
        };
      }
    }

    // Start scanning
    const result = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });

    // User cancelled
    if (!result.barcodes || result.barcodes.length === 0) {
      return {
        success: false,
        error: 'cancelled',
        errorMessage: 'Scan was cancelled',
      };
    }

    // Parse the QR code content
    const qrContent = result.barcodes[0].rawValue;
    
    if (!qrContent) {
      return {
        success: false,
        error: 'invalid_format',
        errorMessage: 'QR code is empty',
      };
    }

    const config = parseNextcloudQr(qrContent);
    
    if (!config) {
      return {
        success: false,
        error: 'invalid_format',
        errorMessage: 'Invalid QR code format. Please scan the QR code from Nextcloud\'s app password screen.',
      };
    }

    return {
      success: true,
      config,
    };
  } catch (error) {
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
