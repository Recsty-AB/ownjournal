# Android App - Quick Start Guide 🚀

Get your OwnJournal app running on Android in 5 steps!

## Prerequisites

Before starting, make sure you have:

- [ ] **Node.js** installed (v20 or higher)
- [ ] **Android Studio** installed ([Download here](https://developer.android.com/studio))
- [ ] **Java JDK 17** or higher
- [ ] **Git** for version control

## Step 1: Clone and Setup

```bash
# Clone your repository
git clone [your-repo-url]
cd [your-repo-name]   # e.g. personal-cipher

# Install dependencies
npm install
```

Capacitor is already configured in this repo (app ID: `app.ownjournal`). If the `android/` folder is not present, add the Android platform:

```bash
npx cap add android
```

If you ever need to re-initialize Capacitor (e.g. new repo): `npx cap init OwnJournal app.ownjournal`

## Step 2: Configure OAuth Providers

Update your OAuth provider settings with mobile callback URLs:

### Google Drive
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Credentials"
4. Edit your OAuth 2.0 Client ID
5. Add to "Authorized redirect URIs":
   ```
   ownjournal://oauth/callback
   ```

### Dropbox
1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app
3. Add to "Redirect URIs":
   ```
   ownjournal://oauth/callback
   ```

### Nextcloud
1. Go to your Nextcloud instance settings
2. Navigate to Security > OAuth 2.0 clients
3. Add redirect URI:
   ```
   ownjournal://oauth/callback
   ```

## Step 3: Build and Sync

```bash
# Build the web app
npm run build

# Sync to Android
npx cap sync android
```

## Step 4: Run on Device/Emulator

### Option A: Using Android Studio (Recommended)
```bash
# Open in Android Studio
npx cap open android

# Then in Android Studio, click the green "Run" button
```

### Option B: Command Line
```bash
# Run directly
npx cap run android
```

This will:
- Build the project
- Launch emulator (if no device connected)
- Install and run the app

## Testing OAuth Deep Links

After the app is running, test the deep link functionality:

```bash
# Connect your device via USB or start emulator
# Then run:
adb shell am start -a android.intent.action.VIEW -d "ownjournal://oauth/callback?code=test&state=test"
```

If the app opens when you run this command, deep linking is working! ✅

## App Icons and Splash Screens

### Quick Setup (Recommended)

1. Place your assets in the `resources/` folder:
   - `icon.png` (1024x1024px)
   - `splash.png` (2732x2732px)

2. Generate all sizes:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

### Manual Setup

Place icons and splash screens in:
- `android/app/src/main/res/mipmap-*/ic_launcher.png`
- `android/app/src/main/res/drawable-*/splash.png`

## Development with Hot Reload

For faster development, edit `capacitor.config.ts` to enable hot reload:

```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:8080',  // e.g., 192.168.1.100:8080
  cleartext: true
}
```

Then:
```bash
# Start dev server
npm run dev

# In another terminal, open Android Studio
npx cap open android

# Run the app - it will connect to your dev server
```

Every code change will instantly appear on the device! 🔥

## Common Issues & Solutions

### Issue: "Capacitor not initialized"
**Solution:** Run `npx cap init` first

### Issue: "Platform not found"
**Solution:** Run `npx cap add android`

### Issue: "Changes not showing up"
**Solution:** 
```bash
npm run build
npx cap sync android
```

### Issue: OAuth not working
**Solution:** 
1. Check OAuth provider has `ownjournal://oauth/callback` configured
2. Verify AndroidManifest.xml has intent filters
3. Test with: `adb shell am start -a android.intent.action.VIEW -d "ownjournal://oauth/callback?code=test"`

### Issue: "Cannot find Android SDK"
**Solution:** 
1. Open Android Studio
2. Go to Tools > SDK Manager
3. Install Android SDK Platform 33 or higher
4. Set ANDROID_HOME environment variable

## Next Steps

✅ App running on Android  
⬜ Customize app icon and splash screen  
⬜ Test OAuth with real providers  
⬜ Test on physical device  
⬜ Build release APK  
⬜ Publish to Google Play Store  

## Building for Production

When you're ready to publish:

1. **Generate Signing Key**
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. **Build Release APK**
```bash
npx cap open android
```

In Android Studio:
- Build > Generate Signed Bundle / APK
- Select "Android App Bundle" (for Play Store)
- Choose your keystore file
- Build release bundle

3. **Upload to Google Play**
- Go to [Google Play Console](https://play.google.com/console)
- Create app listing
- Upload your AAB file
- Submit for review

## Useful Resources

- 📚 [Capacitor Documentation](https://capacitorjs.com/docs)
- 📚 [Android Studio Guide](https://developer.android.com/studio/intro)
- 📚 [Google Play Publishing Guide](https://developer.android.com/distribute/console)
- 💬 [Lovable Discord](https://discord.gg/lovable) - Get help from the community

## Need Help?

Check these guides in your project:
- `CAPACITOR_SETUP.md` - Detailed setup instructions
- `MOBILE_BUILD_COMMANDS.md` - Command reference
- `resources/README.md` - Asset generation guide
- `android/README.md` - Native project details

---

**Congratulations!** 🎉 You now have a native Android app running. The same codebase can also be used for iOS with `npx cap add ios` (macOS only).
