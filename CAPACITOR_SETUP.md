# Capacitor Android Setup Guide

## Initial Setup

Capacitor is already initialized in this repo (`capacitor.config.ts` with app ID `app.ownjournal`). Only run `npx cap init` if you are creating a fresh project elsewhere.

After installing dependencies:

```bash
# Add Android platform (if not already present)
npx cap add android

# Sync web assets to native project
npm run build
npx cap sync android
```

## Deep Linking Configuration

Deep links are configured in `capacitor.config.ts` with the custom scheme `ownjournal://`.

### OAuth Callback URLs

When setting up OAuth providers (Google Drive, Dropbox, etc.), use these callback URLs:

- **Android**: `ownjournal://oauth/callback`
- **iOS**: `ownjournal://oauth/callback`

The app will automatically handle these deep links and complete the OAuth flow.

## App Icons and Splash Screens

### Required Assets

Place the following files in the [resources/](resources/) folder (see [resources/README.md](resources/README.md)):

1. **App Icon**: `resources/icon.png` (1024x1024px)
2. **Splash Screen**: `resources/splash.png` (2732x2732px)

### Generate Resources

Use Capacitor's asset generator (it reads from `resources/` by default):

```bash
# Install the asset generator (one-time)
npm install -g @capacitor/assets

# Generate all icon and splash screen sizes for Android
npx capacitor-assets generate --android

# Or generate for all platforms
npx capacitor-assets generate
```

This will generate all required sizes and place them in `android/app/src/main/res/`.

## Building for Testing

### Prerequisites

- **Android Studio** installed
- **Java JDK 17** or higher
- **Android SDK** (API level 33 or higher)

### Development Build (with hot reload)

```bash
# Build the web app
npm run build

# Sync changes to native project
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio, click the "Run" button to deploy to a connected device or emulator.

### Testing on Physical Device

1. Enable Developer Mode on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Enable USB Debugging in Developer Options

2. Connect device via USB

3. Run from command line:
```bash
npx cap run android
```

### Testing on Emulator

1. Open Android Studio
2. Click "AVD Manager" (Android Virtual Device Manager)
3. Create a new virtual device or select existing
4. Run: `npx cap run android`

## Production Build

### Create Release APK

```bash
# Build optimized web assets
npm run build

# Sync to Android
npx cap sync android

# Open Android Studio
npx cap open android
```

In Android Studio:
1. Go to Build > Generate Signed Bundle / APK
2. Select APK
3. Create or select a keystore
4. Build release APK

### For Google Play Store

Generate an AAB (Android App Bundle):

1. In Android Studio: Build > Generate Signed Bundle / APK
2. Select "Android App Bundle"
3. Sign with your release keystore
4. Upload to Google Play Console

## Common Commands

```bash
# Sync web assets and native dependencies
npx cap sync android

# Update native dependencies only
npx cap update android

# Open native project in Android Studio
npx cap open android

# Run on device/emulator
npx cap run android

# Copy web assets only
npx cap copy android
```

## Troubleshooting

### Deep Links Not Working

1. Check `AndroidManifest.xml` includes intent filters
2. Verify the scheme matches your OAuth callback URLs
3. Test deep link with: `adb shell am start -a android.intent.action.VIEW -d "ownjournal://oauth/callback?code=test"`

### Build Errors

- Clean build: In Android Studio, select Build > Clean Project
- Invalidate caches: File > Invalidate Caches / Restart
- Delete `node_modules` and reinstall: `npm install`

### Hot Reload Not Working

1. Ensure device and computer are on same network
2. Check the server URL in `capacitor.config.ts`
3. Rebuild: `npm run build && npx cap sync android`

## OAuth Provider Configuration

Update your OAuth providers with the mobile callback URL:

### Google Drive
- Authorized redirect URIs: `ownjournal://oauth/callback`

### Dropbox
- Redirect URIs: `ownjournal://oauth/callback`

### Nextcloud
- Redirect URIs: `ownjournal://oauth/callback`

## Next Steps

1. **Export to GitHub**: Transfer your project to GitHub for version control
2. **Pull Repository**: `git clone [your-repo-url]`
3. **Install Dependencies**: `npm install`
4. **Add Android Platform**: `npx cap add android`
5. **Build and Run**: Follow the commands above

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio Download](https://developer.android.com/studio)
- [Capacitor Deep Links Guide](https://capacitorjs.com/docs/guides/deep-links)
