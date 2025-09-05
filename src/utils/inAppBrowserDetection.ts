/**
 * In-App Browser Detection Utility
 * 
 * Detects when the app is running inside social app WebViews (LINE, Facebook, Instagram, etc.)
 * These embedded browsers block Google OAuth with "403: disallowed_useragent" error.
 */

interface InAppBrowserInfo {
  isInApp: boolean;
  appName: string | null;
  userAgent: string;
}

/**
 * User-agent patterns for common in-app browsers
 */
const IN_APP_BROWSER_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /Line\//i, name: 'LINE' },
  { pattern: /FBAN|FBAV/i, name: 'Facebook' },
  { pattern: /Instagram/i, name: 'Instagram' },
  { pattern: /\bTwitter\b|TwitterAndroid/i, name: 'X (Twitter)' },
  { pattern: /MicroMessenger/i, name: 'WeChat' },
  { pattern: /BytedanceWebview|TikTok/i, name: 'TikTok' },
  { pattern: /Snapchat/i, name: 'Snapchat' },
  { pattern: /LinkedInApp/i, name: 'LinkedIn' },
  { pattern: /MESSENGER/i, name: 'Messenger' },
  { pattern: /Pinterest/i, name: 'Pinterest' },
  { pattern: /Slack/i, name: 'Slack' },
  { pattern: /Discord/i, name: 'Discord' },
  { pattern: /Telegram/i, name: 'Telegram' },
  { pattern: /Kakao/i, name: 'KakaoTalk' },
  { pattern: /NAVER/i, name: 'NAVER' },
];

/**
 * Detect if running in an in-app browser
 */
function detectInAppBrowser(): InAppBrowserInfo {
  const userAgent = navigator.userAgent || '';
  
  for (const { pattern, name } of IN_APP_BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      return {
        isInApp: true,
        appName: name,
        userAgent,
      };
    }
  }
  
  return {
    isInApp: false,
    appName: null,
    userAgent,
  };
}

// Cache the detection result (user-agent doesn't change during session)
let cachedResult: InAppBrowserInfo | null = null;

/**
 * Check if running in any in-app browser
 */
export function isInAppBrowser(): boolean {
  if (!cachedResult) {
    cachedResult = detectInAppBrowser();
  }
  return cachedResult.isInApp;
}

/**
 * Get the name of the in-app browser for display
 * Returns null if not in an in-app browser
 */
export function getInAppBrowserName(): string | null {
  if (!cachedResult) {
    cachedResult = detectInAppBrowser();
  }
  return cachedResult.appName;
}

/**
 * Detect if the device is iOS
 */
export function isIOS(): boolean {
  const userAgent = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * Detect if the device is Android
 */
export function isAndroid(): boolean {
  const userAgent = navigator.userAgent || '';
  return /Android/i.test(userAgent);
}

/**
 * Get platform-specific instructions for opening in external browser
 */
export function getOpenInBrowserInstructions(): string {
  if (isIOS()) {
    return 'iosInstructions'; // Translation key
  }
  return 'androidInstructions'; // Translation key
}

/**
 * Get the full detection info (for debugging)
 */
export function getInAppBrowserInfo(): InAppBrowserInfo {
  if (!cachedResult) {
    cachedResult = detectInAppBrowser();
  }
  return { ...cachedResult };
}

/**
 * Copy URL to clipboard and return success status
 */
export async function copyCurrentUrl(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Reset cached detection (for testing)
 */
export function resetInAppBrowserCache(): void {
  cachedResult = null;
}
