# OAuth Setup Guide for All Platforms

This guide covers OAuth redirect URI configuration for Web, Capacitor (iOS/Android), and Electron.

## Overview

OwnJournal supports OAuth authentication across all platforms:

| Platform | OAuth Method | Redirect URI |
|----------|--------------|--------------|
| Web | Full-page redirect | `https://yourdomain.com/` |
| Android | Deep linking | `ownjournal://oauth/callback` |
| iOS | URL scheme | `ownjournal://oauth/callback` |
| Electron | Native browser + deep link | `ownjournal://oauth/callback` |

## Google Drive OAuth Setup

### 1. Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**

### 2. Configure Redirect URIs

Add the following redirect URIs based on platforms you support:

#### Web Application
```
https://yourdomain.com/
https://yourdomain.com/index.html
http://localhost:8080/  (for development)
```

#### Android
```
ownjournal://oauth/callback
```

#### iOS
```
ownjournal://oauth/callback
```

#### Electron
```
ownjournal://oauth/callback
```

### 3. Configure OAuth Consent Screen

- Set **Application name**: OwnJournal
- Add **Scopes**:
  - `https://www.googleapis.com/auth/drive.file` (recommended - app data only)
  - OR `https://www.googleapis.com/auth/drive` (full access)
- Add test users if app is in testing phase

### 4. Client ID in Code

Use the same Client ID for all platforms:

```typescript
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

## Dropbox OAuth Setup

### 1. Create Dropbox App

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click **Create app**
3. Choose **Scoped access**
4. Choose **Full Dropbox** or **App folder** access
5. Name your app

### 2. Configure Redirect URIs

In the **OAuth 2** section, add:

#### Web Application
```
https://yourdomain.com/
https://yourdomain.com/index.html
http://localhost:8080/  (for development)
```

#### Mobile & Desktop (all use same redirect)
```
ownjournal://oauth/callback
```

### 3. Configure Permissions

Under **Permissions** tab:
- `files.content.write` - Write files
- `files.content.read` - Read files
- Click **Submit** to save permissions

### 4. App Key in Code

```typescript
const DROPBOX_CLIENT_ID = 'YOUR_APP_KEY';
```

## Platform-Specific Implementation

### Web Platform

The web platform uses **full-page redirects** for better reliability:

1. User clicks "Connect Google Drive"
2. App redirects to Google OAuth page
3. User authorizes
4. Google redirects back to your app with `?code=...&state=...`
5. App exchanges code for tokens

**Important:** PKCE verifiers are stored in `sessionStorage` to persist across redirects.

### Capacitor (Android/iOS)

Mobile platforms use **deep linking** via in-app browser:

1. User clicks "Connect Google Drive"
2. App opens in-app browser with OAuth URL
3. User authorizes in browser
4. Provider redirects to `ownjournal://oauth/callback?code=...`
5. App catches deep link, extracts code
6. App exchanges code for tokens

**Configuration:**
- Android: `android/app/src/main/AndroidManifest.xml` (auto-created)
- iOS: `ios/App/App/Info.plist` (auto-created)

### Electron (Desktop)

Desktop uses **native modal window** with deep linking:

1. User clicks "Connect Google Drive"
2. App opens native modal window with OAuth URL
3. User authorizes
4. Provider redirects to `ownjournal://oauth/callback?code=...`
5. Electron intercepts protocol, extracts code
6. App exchanges code for tokens

**Configuration:** Protocol registered in `electron/main.js` automatically.

## Testing OAuth on Each Platform

### Web
1. Run `npm run dev`
2. Open http://localhost:8080
3. Click "Connect" → should redirect to provider
4. After auth → redirects back with code

### Android
```bash
npm run build
npx cap sync android
npx cap run android
```

Test deep linking:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "ownjournal://oauth/callback?code=test&state=test"
```

### iOS
```bash
npm run build
npx cap sync ios
npx cap run ios
```

Test URL scheme:
```bash
xcrun simctl openurl booted "ownjournal://oauth/callback?code=test&state=test"
```

### Electron
```bash
npm run electron:dev
```

## Common Issues

### "Redirect URI mismatch"

**Cause:** The redirect URI in your OAuth provider doesn't match the one your app is using.

**Fix:**
1. Check the exact URI in the error message
2. Add that exact URI to your OAuth provider's allowed redirects
3. Include the port for localhost: `http://localhost:8080/`

### "Invalid state parameter"

**Cause:** PKCE state doesn't match (CSRF protection).

**Fix:**
- Web: Check that sessionStorage is enabled
- Mobile/Desktop: This shouldn't happen (memory-based)
- Clear browser/app data and try again

### Deep links not working on Android

**Fix:**
1. Verify `AndroidManifest.xml` has the intent filters
2. Run `npx cap sync android` after adding
3. Rebuild the app
4. Test with `adb shell am start...` command above

### Deep links not working on iOS

**Fix:**
1. Verify `Info.plist` has `CFBundleURLTypes`
2. Run `npx cap sync ios` after adding
3. Rebuild in Xcode
4. Test with `xcrun simctl openurl...` command above

### Electron protocol not registered

**Fix:**
1. Check `electron/main.js` calls `app.setAsDefaultProtocolClient('ownjournal')`
2. On Windows: May need to reinstall app to register protocol
3. On macOS: Check System Preferences → General → Default apps

## Security Best Practices

### ✅ DO:
- Use PKCE (Proof Key for Code Exchange) - **always enabled**
- Validate state parameter on callback - **always validated**
- Use HTTPS for web deployments - **required for production**
- Store tokens encrypted - **use CloudCredentialStorage**
- Set short token expiry and use refresh tokens - **automatic**

### ❌ DON'T:
- Store OAuth tokens in localStorage without encryption
- Use implicit grant flow (code flow with PKCE only)
- Share client secrets in frontend code
- Log sensitive OAuth parameters

## Environment Variables

The project may use hardcoded values in `src/config/oauth.ts`. The approach below uses environment variables so you can keep client IDs out of the repo if you prefer.

Store OAuth configuration securely:

```typescript
// src/config/oauth.ts
export const OAUTH_CONFIG = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
  dropbox: {
    clientId: import.meta.env.VITE_DROPBOX_CLIENT_ID || '',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scopes: ['files.content.write', 'files.content.read'],
  },
};
```

Add to `.env`:
```
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
VITE_DROPBOX_CLIENT_ID=your_app_key
```

## Need Help?

- Google OAuth: https://developers.google.com/identity/protocols/oauth2
- Dropbox OAuth: https://www.dropbox.com/developers/documentation/http/documentation
- Capacitor Deep Links: https://capacitorjs.com/docs/guides/deep-links
- Electron Protocol Handlers: https://www.electronjs.org/docs/latest/api/protocol
