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

  /**
   * Cloud crypto format v2 — WRITE side of two security upgrades:
   *  1. Master-key wrapping with Argon2id instead of legacy PBKDF2-SHA256/100k.
   *  2. E2E entries carry tags/mood/activities/date/aiMetadata INSIDE the
   *     encrypted payload instead of plaintext metadata.
   *
   * READ support for both formats is always on (shipped first, in every build
   * that contains this flag). Clients on builds WITHOUT read support cannot
   * open v2 artifacts: a v2 key file looks like a wrong password, and a v2
   * entry loses its date/tags/mood on display. Because these artifacts are
   * shared through the user's cloud across all their devices, enabling this
   * flag is only safe once read-capable builds have saturated all platforms.
   *
   * DO NOT enable until the read-support release has been the minimum
   * available version on every store/channel long enough for real-world
   * update lag (recommendation: several release cycles). Flipping this is a
   * one-way door per journal — once a v2 key file or entry is written, older
   * builds can no longer fully read that journal.
   */
  CLOUD_CRYPTO_V2_WRITE: false,
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
