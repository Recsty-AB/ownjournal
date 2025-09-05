// OAuth configuration for cloud storage providers
// These are public client IDs (safe to store in code)
// VITE_GOOGLE_CLIENT_ID in .env takes precedence when set (e.g. npm run dev)

const envVar = (name: string) => {
  if (typeof import.meta !== "undefined") {
    const val = import.meta.env?.[name];
    return val ? String(val).trim() : "";
  }
  return "";
};

export const oauthConfig = {
  googleDrive: {
    // Web application client ID (for browser/PWA)
    // Get from Google Cloud Console > APIs & Services > Credentials
    webClientId: envVar("VITE_GOOGLE_CLIENT_ID"),
    // Android application client ID (for Capacitor Android)
    // Create a separate "Android" type OAuth client in Google Console with:
    // - Package name: app.ownjournal
    // - SHA-1 certificate fingerprint from your signing keystore
    androidClientId: "YOUR_ANDROID_CLIENT_ID_HERE.apps.googleusercontent.com",
    scopes: ["https://www.googleapis.com/auth/drive.appdata"],
  },
  dropbox: {
    // Get your App Key from Dropbox App Console:
    // 1. Go to https://www.dropbox.com/developers/apps
    // 2. Create an app with "Full Dropbox" access
    // 3. Copy the App key (not App secret - we use PKCE)
    clientId: envVar("VITE_DROPBOX_CLIENT_ID"),
  },
};

/**
 * Get the appropriate Google client ID based on platform
 * - Android native: uses Android-specific client ID
 * - Web/PWA: uses Web application client ID
 */
export function getGoogleClientId(): string {
  // For browser-based OAuth (including Android via Capacitor Browser),
  // always use the Web Client ID since we're using HTTPS App Links
  return oauthConfig.googleDrive.webClientId;
}

/**
 * Check if running on a native platform (Android/iOS) via Capacitor
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as any).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

// Helper to check if OAuth is configured
export const isGoogleDriveConfigured = (): boolean => {
  const clientId = getGoogleClientId();
  return Boolean(
    clientId && 
    clientId !== "YOUR_GOOGLE_CLIENT_ID_HERE" && 
    clientId !== "YOUR_ANDROID_CLIENT_ID_HERE.apps.googleusercontent.com" &&
    clientId.trim() !== ""
  );
};

export const isDropboxConfigured = (): boolean => {
  const clientId = oauthConfig.dropbox.clientId;
  return Boolean(clientId && clientId !== "YOUR_DROPBOX_APP_KEY_HERE" && clientId.trim() !== "");
};
