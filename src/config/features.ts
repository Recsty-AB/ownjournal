/**
 * Feature flags for conditionally enabling/disabling app features
 * This provides a clean way to manage features that are in development
 */
export const FEATURES = {
  /**
   * iCloud integration (CloudKit)
   * Set to true when iCloud support is ready for production
   */
  ICLOUD_ENABLED: false,

  /**
   * Apple Sign-In (OAuth)
   * Set to true when Apple Sign-In is configured (Supabase Auth + Apple Developer)
   */
  APPLE_SIGNIN_ENABLED: false,
} as const;

/**
 * Safety constants for destructive actions
 * These are intentionally NOT translated to provide universal recognition
 */
export const SAFETY_CONSTANTS = {
  DELETE_ALL_CONFIRMATION: "DELETE ALL",
  DELETE_CONFIRMATION: "DELETE",
  DELETE_ACCOUNT_CONFIRMATION: "DELETE ACCOUNT",
} as const;
