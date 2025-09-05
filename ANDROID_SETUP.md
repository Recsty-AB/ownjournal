# Android Setup Guide

This guide explains how to set up the Android project for OwnJournal.

## Prerequisites

- Node.js 20+ installed
- Android Studio installed with SDK
- An Android device or emulator

## Important Note

The `android/` folder is tracked in git. To regenerate it (e.g. after changing `capacitor.config.ts`), remove the folder and run `npx cap add android`.

## Step 1: Build the Web App

```bash
npm install
npm run build
```

## Step 2: Add Android Platform

```bash
npx cap add android
```

This creates a fresh `android/` folder with the correct package name (`app.ownjournal`).

## Step 3: Generate App Icons and Splash Screens

Source assets live in `resources/` (see [resources/README.md](resources/README.md)). Generate all required icon and splash screen sizes:

```bash
npx capacitor-assets generate --android
```

Or generate for all platforms: `npx capacitor-assets generate`. This uses `resources/icon.png` and `resources/splash.png`.

## Step 4: Sync the Project

```bash
npx cap sync android
```

**Important:** After sync, verify assets are populated:
```bash
ls android/app/src/main/assets/public/
# Should show: index.html, assets/, etc.
```

If the folder is empty, run `npm run build` first, then `npx cap sync android` again.

## Step 5: Add OAuth Deep Linking (Required)

After generating the Android project, you must manually add OAuth deep linking support.

Edit `android/app/src/main/AndroidManifest.xml` and add these intent filters inside the `<activity>` tag (after the existing `LAUNCHER` intent-filter):

```xml
<!-- OAuth callback deep linking -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    
    <data android:scheme="ownjournal" android:host="oauth" android:pathPrefix="/callback" />
</intent-filter>

<!-- Catch all ownjournal:// links -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    
    <data android:scheme="ownjournal" />
</intent-filter>
```

## Step 6: Add Extra Permissions (Optional)

If you need network state detection or external storage access, add these permissions in `AndroidManifest.xml` (before the `<application>` tag):

```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## Step 7: Open in Android Studio

```bash
npx cap open android
```

## Step 8: Build and Run

In Android Studio:

1. **Build > Clean Project** (important for first build)
2. **Build > Rebuild Project**
3. Connect your device or start an emulator
4. Click the **Run** button (green play icon)

## Troubleshooting

### URL Bar Appears in App

If you see a URL bar, ensure the app is loading from local assets (no `server` or `server.url` in capacitor.config.ts). Do a full rebuild: uninstall the app, then `rm -rf android`, `npm run build`, `npx cap add android`, `npx cap sync android`, and in Android Studio run **Build > Clean Project** then run again.

### Package Name Issues

The package name is defined in `capacitor.config.ts` as `appId: 'app.ownjournal'`. If you need to change it:

1. Update `capacitor.config.ts`
2. Delete the `android/` folder
3. Run `npx cap add android` to regenerate

### OAuth Not Working

Ensure the intent filters are correctly added to `AndroidManifest.xml` as shown in Step 4.

## Complete AndroidManifest.xml Example

Here's what your complete `AndroidManifest.xml` should look like after modifications:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- OAuth callback deep linking -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                
                <data android:scheme="ownjournal" android:host="oauth" android:pathPrefix="/callback" />
            </intent-filter>

            <!-- Catch all ownjournal:// links -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                
                <data android:scheme="ownjournal" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>

</manifest>
```
