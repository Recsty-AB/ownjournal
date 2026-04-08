/**
 * Feature flags for conditionally enabling/disabling app features
 * This provides a clean way to manage features that are in development
 */
export const FEATURES = {
  /**
   * iCloud integration (CloudKit)
   * Set to true when iCloud support is ready for production
   */
  ICLOUD_ENABLED: true,

  /**
   * Apple Sign-In (OAuth)
   * Set to true when Apple Sign-In is configured (Supabase Auth + Apple Developer)
   */
  APPLE_SIGNIN_ENABLED: true,
} as const;

/**
 * Check if iCloud should be available on the current platform.
 * - Native iOS: uses native CloudKit plugin (CKDatabase) — no popup needed
 * - Web: uses CloudKit JS (popup-based Apple ID sign-in)
 * - Android: not available (no iCloud on Android)
 */
export function isAppleFeatureAvailable(): boolean {
  const cap = (window as any).Capacitor;
  const isNative = cap?.isNativePlatform?.() === true;
  if (isNative && cap?.getPlatform?.() === 'ios') return true;
  if (isNative) return false;
  return true;
}

/**
 * Check if Apple Sign-In should be available on the current platform.
 * Apple Sign-In works on all platforms:
 * - iOS native: via @capacitor-community/apple-sign-in (native AuthenticationServices)
 * - Web: via Supabase OAuth
 * - Android: not supported (Apple doesn't provide Android SDK)
 */
export function isAppleSignInAvailable(): boolean {
  const isAndroidNative =
    (window as any).Capacitor?.isNativePlatform?.() === true &&
    (window as any).Capacitor?.getPlatform?.() === 'android';
  return !isAndroidNative;
}

/**
 * Safety constants for destructive actions
 * These are intentionally NOT translated to provide universal recognition
 */
export const SAFETY_CONSTANTS = {
  DELETE_ALL_CONFIRMATION: "DELETE ALL",
  DELETE_CONFIRMATION: "DELETE",
  DELETE_ACCOUNT_CONFIRMATION: "DELETE ACCOUNT",
} as const;
