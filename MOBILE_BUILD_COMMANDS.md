# Mobile Build Commands Reference

Quick reference for common Capacitor commands you'll need during development.

## Initial Setup (One-Time)

```bash
# Initialize Capacitor (creates capacitor.config.ts)
npx cap init

# Add Android platform
npx cap add android

# Add iOS platform (macOS only)
npx cap add ios
```

## Development Workflow

### Build and Sync
```bash
# Build web app and sync to all platforms
npm run build && npx cap sync

# Sync to Android only
npm run build && npx cap sync android

# Sync to iOS only
npm run build && npx cap sync ios
```

### Open Native IDEs
```bash
# Open Android Studio
npx cap open android

# Open Xcode (macOS only)
npx cap open ios
```

### Run on Devices/Emulators
```bash
# Run on Android device/emulator
npm run build && npx cap sync android && npx cap run android

# Run on iOS device/simulator (macOS only)
npm run build && npx cap sync ios && npx cap run ios
```

## Asset Generation

```bash
# Install asset generator (one-time)
npm install -g @capacitor/assets

# Generate all icons and splash screens
npx capacitor-assets generate

# Generate for specific platform
npx capacitor-assets generate --android
npx capacitor-assets generate --ios
```

## Maintenance

```bash
# Update Capacitor and plugins to latest versions
npx cap update

# Update specific platform
npx cap update android
npx cap update ios

# Copy web assets only (no native updates)
npx cap copy android
npx cap copy ios
```

## Debugging

```bash
# View native logs
# Android:
npx cap run android --livereload

# iOS (macOS only):
npx cap run ios --livereload
```

## Testing Deep Links

```bash
# Test deep link on Android (device must be connected)
adb shell am start -a android.intent.action.VIEW -d "ownjournal://oauth/callback?code=test&state=test"

# Test deep link on iOS simulator
xcrun simctl openurl booted "ownjournal://oauth/callback?code=test&state=test"
```

## Production Build

### Android
```bash
# 1. Build optimized web assets
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open Android Studio
npx cap open android

# 4. In Android Studio:
#    - Build > Generate Signed Bundle / APK
#    - Choose AAB for Play Store or APK for direct distribution
#    - Sign with your release keystore
```

### iOS (macOS only)
```bash
# 1. Build optimized web assets
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open Xcode
npx cap open ios

# 4. In Xcode:
#    - Product > Archive
#    - Distribute App > App Store Connect
```

## Quick Start (After Git Clone)

```bash
# 1. Install dependencies
npm install

# 2. If android/ and ios/ are already in the repo: build and sync
npm run build && npx cap sync
# Optionally: npx cap update

# 3. Run on device
npx cap run android  # or ios
```

If the native project folders are not present, add platforms first:

```bash
npx cap add android
npx cap add ios  # macOS only
npx cap update
npm run build && npx cap sync
npx cap run android  # or ios
```

## Common Issues

### "Capacitor not found"
- Run: `npm install`
- Make sure @capacitor/core and @capacitor/cli are installed

### "Platform not found"
- Run: `npx cap add android` or `npx cap add ios`

### Changes not appearing
- Always run `npm run build` before `npx cap sync`
- Clean build in native IDE (Android Studio / Xcode)

### Deep links not working
- Check AndroidManifest.xml has correct intent filters
- Verify OAuth provider has correct callback URL configured
- Test with: `adb shell am start -a android.intent.action.VIEW -d "ownjournal://test"`
