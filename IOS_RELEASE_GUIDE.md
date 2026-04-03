# iOS Release & Publish Guide

Complete step-by-step guide for releasing OwnJournal to the Apple App Store.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Apple Developer Account Setup](#2-apple-developer-account-setup)
3. [Prepare the App for Release](#3-prepare-the-app-for-release)
4. [Configure Signing & Capabilities in Xcode](#4-configure-signing--capabilities-in-xcode)
5. [Build the Production Archive](#5-build-the-production-archive)
6. [Upload to App Store Connect](#6-upload-to-app-store-connect)
7. [Configure App Store Listing](#7-configure-app-store-listing)
8. [TestFlight Beta Testing](#8-testflight-beta-testing)
9. [Submit for App Review](#9-submit-for-app-review)
10. [Post-Release](#10-post-release)

---

## 1. Prerequisites

Before you begin, make sure you have:

- **macOS** (required — iOS builds cannot be done on Windows/Linux)
- **Xcode 15+** installed from the Mac App Store
- **Apple Developer Account** ($99/year) — enroll at [developer.apple.com/programs](https://developer.apple.com/programs/)
- **Node.js 20+** and npm installed
- **The OwnJournal codebase** cloned and dependencies installed (`npm install`)

## 2. Apple Developer Account Setup

### 2.1 Enroll in the Apple Developer Program

1. Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)
2. Sign in with your Apple ID (or create one)
3. Choose **Individual** or **Organization** enrollment
   - Individual: Use your personal name as the seller
   - Organization: Requires a D-U-N-S number (takes 1-2 weeks to obtain)
4. Pay the $99/year fee
5. Wait for enrollment approval (usually 24-48 hours)

### 2.2 Create an App ID

1. Go to [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+** to register a new identifier
3. Select **App IDs** → **App**
4. Fill in:
   - **Description**: `OwnJournal`
   - **Bundle ID**: Select **Explicit** and enter `app.ownjournal`
5. Under **Capabilities**, enable:
   - **Associated Domains** (if using universal links for OAuth)
6. Click **Continue** → **Register**

### 2.3 Create a Distribution Certificate

1. Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click **+** to create a new certificate
3. Select **Apple Distribution**
4. Follow the instructions to create a Certificate Signing Request (CSR) using Keychain Access:
   - Open **Keychain Access** → Certificate Assistant → Request a Certificate From a Certificate Authority
   - Enter your email, select **Saved to disk**
5. Upload the CSR file
6. Download and double-click the certificate to install it in Keychain

### 2.4 Create a Provisioning Profile

1. Go to [developer.apple.com/account/resources/profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** to create a new profile
3. Select **App Store Connect** (under Distribution)
4. Select the App ID `app.ownjournal`
5. Select your distribution certificate
6. Name it `OwnJournal App Store`
7. Download and double-click to install

> **Tip**: If you enable "Automatically manage signing" in Xcode (recommended), steps 2.3 and 2.4 are handled for you automatically.

## 3. Prepare the App for Release

### 3.1 Update Version Numbers

Edit the version in `package.json`:

```bash
# Check current version
grep '"version"' package.json
```

Update the version following [semantic versioning](https://semver.org/) (e.g., `1.0.0`, `1.1.0`, `2.0.0`).

### 3.2 Build the Web App

```bash
# Install dependencies (if not already done)
npm install

# Run tests to make sure everything passes
npm run test -- --run

# Run linter
npm run lint

# Create production build
npm run build
```

### 3.3 Sync to iOS

```bash
# Sync the production build to the iOS project
npx cap sync ios
```

This copies the `dist/` output into the iOS native project and updates native plugins.

### 3.4 Generate App Icons and Splash Screens

If you haven't already, or if icons/splash have changed:

```bash
npx capacitor-assets generate --ios
```

Source assets are in `resources/icon.png` (1024x1024) and `resources/splash.png` (2732x2732).

### 3.5 Open in Xcode

```bash
npx cap open ios
```

Or manually open `ios/App/App.xcodeproj` in Xcode.

## 4. Configure Signing & Capabilities in Xcode

### 4.1 Set the Team and Signing

1. In Xcode, select the **App** project in the navigator
2. Select the **App** target
3. Go to the **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** from the dropdown (your Apple Developer account)
6. Verify the **Bundle Identifier** is `app.ownjournal`

### 4.2 Set Version and Build Number

1. Go to the **General** tab
2. Set **Version** (e.g., `1.0.0`) — this is what users see on the App Store
3. Set **Build** (e.g., `1`) — increment this for each upload to App Store Connect
   - Each build uploaded must have a unique build number
   - Convention: increment by 1 for each upload (1, 2, 3, ...)

### 4.3 Set Deployment Target

1. In the **General** tab, set **Minimum Deployments** to **iOS 15.0** (matches the SPM config)

### 4.4 Configure App Transport Security (if needed)

OwnJournal connects to external services (Supabase, cloud providers). The default ATS settings should work since all connections use HTTPS.

## 5. Build the Production Archive

### 5.1 Select the Build Target

1. In the Xcode toolbar, set the destination to **Any iOS Device (arm64)**
   - Do NOT select a simulator — archives require a real device target

### 5.2 Create the Archive

1. Menu: **Product** → **Archive**
2. Wait for the build to complete (this may take a few minutes)
3. When finished, the **Organizer** window opens automatically

### 5.3 Validate the Archive (Optional but Recommended)

1. In the Organizer, select your archive
2. Click **Validate App**
3. Choose defaults for all options
4. Fix any validation errors before uploading

Common validation issues:
- **Missing icons**: Re-run `npx capacitor-assets generate --ios`
- **Invalid provisioning**: Check Signing & Capabilities settings
- **Missing privacy manifest**: See step 7.5

## 6. Upload to App Store Connect

### 6.1 Create the App on App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com/)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platforms**: iOS
   - **Name**: `OwnJournal` (must be unique on the App Store)
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `app.ownjournal`
   - **SKU**: `ownjournal` (internal identifier, anything unique)
   - **User Access**: Full Access
4. Click **Create**

### 6.2 Upload the Build

Back in Xcode Organizer:

1. Select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Choose **Upload** (not Export)
5. Leave default options:
   - Include bitcode: No (deprecated)
   - Upload symbols: Yes
   - Manage version and build number: Yes
6. Click **Upload**
7. Wait for the upload to complete

The build will appear in App Store Connect within 15-30 minutes after processing.

### 6.3 Alternative: Upload via Transporter

If Xcode upload fails, you can use the free **Transporter** app from the Mac App Store:

1. In Xcode Organizer, **Export** the archive as an `.ipa` file
2. Open Transporter
3. Drag in the `.ipa` file
4. Click **Deliver**

## 7. Configure App Store Listing

Go to your app in [App Store Connect](https://appstoreconnect.apple.com/) → **App Store** tab.

### 7.1 App Information

- **Name**: OwnJournal
- **Subtitle**: Private Encrypted Journal (max 30 chars)
- **Category**: Primary — **Lifestyle**, Secondary — **Productivity**

### 7.2 Pricing and Availability

1. Go to **Pricing and Availability**
2. Set your price (or Free if using in-app subscriptions via Stripe)
3. Select availability by country/region

### 7.3 App Screenshots

You need screenshots for at least these device sizes:
- **6.7" iPhone** (iPhone 15 Pro Max / 14 Pro Max) — 1290 x 2796 px
- **5.5" iPhone** (iPhone 8 Plus) — 1242 x 2208 px

Optional but recommended:
- **6.5" iPhone** (iPhone 11 Pro Max) — 1242 x 2688 px
- **12.9" iPad Pro** — 2048 x 2732 px (if supporting iPad)

To take screenshots:
1. Run the app in Simulator at the required device size
2. Press **Cmd + S** in Simulator to save a screenshot
3. Or use **Cmd + Shift + 4** for macOS screenshot

Upload 3-10 screenshots per device size showing key features:
- Journal entry view
- Editor with markdown
- Encrypted storage indicator
- Cloud sync settings
- AI analysis (if enabled)

### 7.4 App Description and Keywords

**Description** (up to 4000 chars):
```
OwnJournal is a privacy-first encrypted journal that keeps your thoughts truly private.

Key Features:
- End-to-end encryption (AES-256-GCM) — your entries are encrypted before leaving your device
- Bring Your Own Storage — connect Google Drive, Dropbox, or Nextcloud
- Works offline — write anytime, sync when connected
- Markdown editor with rich formatting
- AI-powered insights — sentiment analysis runs locally on your device
- Multi-language support (18 languages)
- No account required for basic use

Your journal, your storage, your privacy.
```

**Keywords** (max 100 chars, comma-separated):
```
journal,diary,encrypted,private,markdown,notes,writing,secure,offline,privacy
```

**Promotional Text** (can be updated without a new build):
```
Your private encrypted journal — write freely knowing your thoughts are safe.
```

### 7.5 Privacy Details

This is critical for App Store approval. Go to **App Privacy**:

1. Click **Get Started**
2. For **Data Collection**: Select **Yes, we collect data**
3. Declare the following data types:

| Data Type | Purpose | Linked to User | Tracking |
|-----------|---------|----------------|----------|
| Email Address | App Functionality (auth) | Yes | No |
| Name | App Functionality (profile) | Yes | No |

4. If all journal data is encrypted client-side and you don't process it server-side, you can note that data is encrypted end-to-end

> **Important**: Since OwnJournal uses Supabase for auth, you collect email. Journal content is encrypted and never readable by the server, but you still need to declare auth-related data.

### 7.6 App Review Information

- **Contact Info**: Your name, phone, email
- **Sign-in Required**: Yes — provide a demo account or explain how to use demo mode
  - You can reference the `/demo` route for review purposes
- **Notes for Reviewer**:
  ```
  This app is an encrypted journaling app. To test without creating an account,
  navigate to the demo mode which is accessible from the login screen.
  Journal entries are encrypted client-side using AES-256-GCM before any
  cloud storage. The app works fully offline.
  ```

### 7.7 Age Rating

Fill out the age rating questionnaire. OwnJournal should qualify for **4+** since it:
- Contains no objectionable content
- Has no user-generated content visible to others
- Has no gambling, horror, or mature themes

## 8. TestFlight Beta Testing

Before submitting to the App Store, test via TestFlight.

### 8.1 Internal Testing

1. In App Store Connect → **TestFlight** tab
2. Your uploaded build should appear (after processing)
3. Click **Internal Testing** → **+** to create a group
4. Add team members by email (up to 100 internal testers)
5. Select the build to test
6. Testers receive an email with TestFlight install instructions

### 8.2 External Testing (Optional)

1. Click **External Testing** → **+** to create a group
2. Add testers by email or share a public link (up to 10,000 testers)
3. Submit the build for **Beta App Review** (usually approved in 24-48 hours)
4. Once approved, testers can install via TestFlight

### 8.3 What to Test

- [ ] App launches and shows login/demo screen
- [ ] Account creation and login works
- [ ] Demo mode works correctly
- [ ] Journal entry creation, editing, deletion
- [ ] Markdown editor functionality
- [ ] Encryption setup (password creation, E2E mode)
- [ ] Cloud storage connection (Google Drive, Dropbox, Nextcloud)
- [ ] OAuth flows redirect back to app correctly (`ownjournal://oauth/callback`)
- [ ] Sync works (upload and download entries)
- [ ] Offline mode (disable network, create entry, re-enable, verify sync)
- [ ] AI analysis runs locally (if enabled)
- [ ] Settings and preferences persist
- [ ] App works in landscape and portrait
- [ ] iPad layout (if applicable)

## 9. Submit for App Review

### 9.1 Pre-Submission Checklist

- [ ] Version and build numbers are correct
- [ ] All screenshots uploaded for required device sizes
- [ ] App description, keywords, and promotional text filled in
- [ ] Privacy policy URL is set (link to `/privacy` page hosted on your domain)
- [ ] Support URL is set
- [ ] Age rating questionnaire completed
- [ ] App privacy declarations completed
- [ ] Review notes and demo credentials provided
- [ ] TestFlight testing passed

### 9.2 Submit

1. In App Store Connect → **App Store** tab
2. Select the build you want to submit
3. Scroll to the bottom and click **Add for Review**
4. Click **Submit to App Review**

### 9.3 Review Timeline

- **Typical review time**: 24-48 hours (can be longer for first submissions)
- **Status updates**: You'll receive email notifications
- **If rejected**: Read the rejection reason carefully, fix the issues, and resubmit

### 9.4 Common Rejection Reasons

| Reason | Fix |
|--------|-----|
| Guideline 2.1 — App crashes | Test thoroughly on real devices before submitting |
| Guideline 2.3 — Inaccurate metadata | Ensure screenshots and description match actual app |
| Guideline 5.1.1 — Privacy policy missing | Add privacy policy URL (use the `/privacy` route) |
| Guideline 5.1.2 — Data collection not declared | Update App Privacy section accurately |
| Guideline 4.0 — Login required without demo | Provide demo mode access or test credentials in review notes |
| Guideline 3.1.1 — In-App Purchase required | If charging, must use Apple's IAP (not Stripe directly) |

> **Important Note on Payments**: If OwnJournal offers paid subscriptions, Apple requires you to use In-App Purchases for iOS. You cannot direct users to an external payment system (like Stripe web checkout) from within the iOS app. You would need to implement StoreKit or use a service like RevenueCat. This is a significant consideration if your app has premium features.

## 10. Post-Release

### 10.1 Monitor

- Check **App Store Connect → App Analytics** for downloads and usage
- Monitor **Crashes** in Xcode Organizer or App Store Connect
- Respond to **App Store reviews** in App Store Connect

### 10.2 Releasing Updates

For each update:

```bash
# 1. Make your code changes and test
npm run test -- --run
npm run lint

# 2. Build production web app
npm run build

# 3. Sync to iOS
npx cap sync ios

# 4. Open Xcode
npx cap open ios

# 5. In Xcode:
#    - Increment the Version (e.g., 1.0.0 → 1.1.0)
#    - Increment the Build number
#    - Product → Archive
#    - Distribute App → App Store Connect → Upload

# 6. In App Store Connect:
#    - Create a new version
#    - Add "What's New" release notes
#    - Select the new build
#    - Submit for review
```

### 10.3 Phased Release (Recommended)

When submitting an update, you can choose **Phased Release**:
- Gradually rolls out the update over 7 days
- Day 1: 1%, Day 2: 2%, Day 3: 5%, Day 4: 10%, Day 5: 20%, Day 6: 50%, Day 7: 100%
- You can pause, resume, or release to all users at any time
- Helps catch issues before they affect all users

---

## Quick Reference Commands

```bash
# Full build and sync pipeline
npm run build && npx cap sync ios && npx cap open ios

# Or use the shorthand
npm run ios:sync && npm run ios:open

# Generate assets
npx capacitor-assets generate --ios

# Run on connected device
npx cap run ios
```

## Related Documentation

- [IOS_SETUP.md](./IOS_SETUP.md) — Development setup and debugging
- [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md) — Cross-platform Capacitor guide
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Capacitor iOS Docs](https://capacitorjs.com/docs/ios)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
