# iOS Setup Guide

Complete guide for building and deploying OwnJournal on iOS.

## Prerequisites

- **macOS** (required for iOS development)
- **Xcode 15+** from the Mac App Store
- **Apple Developer Account** (for device testing and App Store submission)
- **Node.js 20+** and npm

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the web app
npm run build

# 3. Add iOS platform (first time only)
npx cap add ios

# 4. Generate app icons and splash screens
npx capacitor-assets generate --ios

# 5. Sync web build to iOS
npx cap sync ios

# 6. Open in Xcode
npx cap open ios
```

## Detailed Setup

### 1. Install Capacitor CLI

```bash
npm install -g @capacitor/cli @capacitor/assets
```

### 2. Generate Native Assets

Source assets are in the [resources/](resources/) folder (see [resources/README.md](resources/README.md)):
- `resources/icon.png` — App icon (matches web app logo)
- `resources/splash.png` — Splash screen

From the project root, generate all required iOS sizes:

```bash
npx capacitor-assets generate --ios
```

This creates:
- App icons for all device sizes (@1x, @2x, @3x)
- Splash screens for all orientations
- Dark mode variants

### 3. Configure Signing

In Xcode:
1. Select the "App" target
2. Go to "Signing & Capabilities"
3. Select your Team
4. Set Bundle Identifier to `app.ownjournal`

### 4. OAuth Deep Linking

The app uses deep linking for OAuth callbacks. This is already configured in `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>app.ownjournal</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>ownjournal</string>
        </array>
    </dict>
</array>
```

OAuth providers should redirect to: `ownjournal://oauth/callback`

## Building for Development

### Run on Simulator

```bash
npm run build
npx cap sync ios
npx cap run ios
```

### Run on Physical Device

1. Connect your iPhone via USB
2. Trust the computer on your device
3. In Xcode, select your device from the device dropdown
4. Click "Run" (▶️)

## Building for Production

### 1. Update Version Numbers

In Xcode, update:
- **Version** (CFBundleShortVersionString): e.g., "1.0.0"
- **Build** (CFBundleVersion): e.g., "1"

### 2. Create Archive

1. Select "Any iOS Device" as the build target
2. Product → Archive
3. Wait for the archive to complete

### 3. Upload to App Store Connect

1. Window → Organizer
2. Select the archive
3. Click "Distribute App"
4. Choose "App Store Connect"
5. Follow the prompts

## App Store Requirements

### Required Assets (Prepare in Advance)

- **Screenshots**: 6.7" and 5.5" iPhone sizes (required)
- **App Icon**: 1024x1024px (generated from resources/icon.png)
- **Privacy Policy URL**: Required for apps with user data
- **App Description**: Up to 4000 characters

### Privacy Declarations

OwnJournal requires these privacy declarations:
- **Data not collected** (all data stored locally or on user's own cloud)
- **No tracking**

## Troubleshooting

### "No provisioning profile"

1. Xcode → Preferences → Accounts
2. Add your Apple ID
3. Select your team in Signing & Capabilities
4. Enable "Automatically manage signing"

### "Command PhaseScriptExecution failed"

```bash
cd ios/App
pod install
```

### Assets not updating

```bash
rm -rf ios/App/App/Assets.xcassets
npx capacitor-assets generate --ios
npx cap sync ios
```

### OAuth not redirecting back

Ensure the OAuth provider (Google, Dropbox, etc.) has the correct redirect URI:
- `ownjournal://oauth/callback`

## Updating the App

After making changes:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Then rebuild in Xcode.

## Related Documentation

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [ANDROID_SETUP.md](./ANDROID_SETUP.md) — Android build guide
