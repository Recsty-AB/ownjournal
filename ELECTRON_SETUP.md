# Electron Desktop App Setup Guide

## Overview
This guide covers setting up and building OwnJournal as a native desktop application for Windows, macOS, and Linux using Electron.

**Note:** Electron scripts are not in `package.json` by default. Add them first using [ELECTRON_SCRIPTS.md](ELECTRON_SCRIPTS.md).

## Prerequisites

### All Platforms
- Node.js 20+ and npm installed
- Git installed
- At least 2GB of free disk space

### Windows
- Windows 10 or later
- Windows Build Tools (automatically installed with electron-builder)

### macOS
- macOS 10.13 or later
- Xcode Command Line Tools: `xcode-select --install`

### Linux
- Ubuntu 18.04+ or equivalent
- Build essentials: `sudo apt-get install build-essential`

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode
Run the app in development mode with hot reload:
```bash
npm run electron:dev
```

This will:
- Start the Vite dev server on port 8080
- Launch Electron with the app
- Enable live reload for both main and renderer processes
- Open DevTools automatically

### 3. Build for Production

#### Build for Current Platform
```bash
npm run electron:build
```

#### Build for Specific Platforms
```bash
# macOS
npm run electron:build:mac

# Windows
npm run electron:build:win

# Linux
npm run electron:build:linux

# All platforms (requires proper setup)
npm run electron:build:all
```

### 4. Test Production Build
After building, you can find the installers in `dist-electron/`:
- **macOS**: `OwnJournal-{version}.dmg` or `.zip`
- **Windows**: `OwnJournal Setup {version}.exe` or `.exe` (portable)
- **Linux**: `OwnJournal-{version}.AppImage`, `.deb`, or `.rpm`

## Project Structure

```
electron/
├── main.js          # Main Electron process (app lifecycle, OAuth, native APIs)
└── preload.js       # Preload script (secure IPC bridge)

resources/
├── icon.png         # App icon (512x512 recommended)
└── splash.png       # Splash screen (optional)

electron-builder.json # Build configuration for all platforms
```

## Features

### 1. Native File System Access
The app has full native file system access through secure IPC:

```typescript
// Available in renderer process via window.electronAPI
await window.electronAPI.readFile(filePath);
await window.electronAPI.writeFile(filePath, data);
await window.electronAPI.deleteFile(filePath);
await window.electronAPI.listFiles(dirPath);
```

### 2. OAuth Authentication
OAuth flows work via native browser windows with deep linking:

```typescript
// In authService.ts
const result = await authService.authenticate({
  provider: 'google-drive',
  clientId: 'YOUR_CLIENT_ID',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
```

The OAuth flow:
1. Opens a native modal window with the provider's auth page
2. User authenticates in the native window
3. Provider redirects to `ownjournal://oauth/callback`
4. Electron intercepts the deep link and extracts the auth code
5. App exchanges code for tokens

### 3. Platform Detection
The app automatically detects it's running in Electron:

```typescript
import { usePlatform } from '@/hooks/usePlatform';

const { isElectron, platform, capabilities } = usePlatform();
```

## Configuration

### App Icons
Place your app icon at `resources/icon.png` (512x512 PNG recommended).
electron-builder will automatically generate all required sizes for each platform.

### Deep Linking
The app is configured to handle `ownjournal://` URLs for OAuth callbacks.
This is configured in:
- `electron-builder.json` (protocols section)
- `electron/main.js` (protocol registration)

### Build Settings
Customize build settings in `electron-builder.json`:
- Change app ID, product name
- Configure code signing (macOS, Windows)
- Add file associations
- Customize installer options

## Building for Distribution

### Code Signing (Required for macOS/Windows)

#### macOS
1. Enroll in Apple Developer Program
2. Create signing certificates in Xcode
3. Set environment variables:
```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app_specific_password
```

#### Windows
1. Obtain code signing certificate
2. Set environment variables:
```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password
```

### Auto-Updates (Optional)
To enable auto-updates, you'll need to:
1. Set up a release server (GitHub Releases, S3, etc.)
2. Configure update settings in `electron-builder.json`
3. Add update logic in `electron/main.js`

## Platform-Specific Notes

### macOS
- **Universal Builds**: Builds for both Intel (x64) and Apple Silicon (arm64)
- **Notarization**: Required for distribution outside App Store
- **DMG**: Provides drag-to-Applications installer
- **Gatekeeper**: Users may need to right-click > Open on first launch

### Windows
- **NSIS Installer**: Full installer with uninstall support
- **Portable**: Single .exe, no installation required
- **SmartScreen**: May show warning without code signing
- **Admin Rights**: Installer may request admin for system-wide install

### Linux
- **AppImage**: Universal format, no installation required
- **DEB**: For Debian/Ubuntu-based distributions
- **RPM**: For Fedora/RHEL-based distributions
- **Permissions**: May need to make AppImage executable: `chmod +x`

## Troubleshooting

### Development

**App won't start:**
```bash
# Clear cache and reinstall
rm -rf node_modules dist dist-electron
npm install
npm run electron:dev
```

**Hot reload not working:**
- Check that Vite dev server is running on port 8080
- Try restarting the electron:dev script

**OAuth not working:**
- Verify redirect URI is set to `ownjournal://oauth/callback`
- Check that protocol is registered (should happen automatically)
- Look for errors in DevTools and main process console

### Building

**Build fails on macOS:**
- Ensure Xcode Command Line Tools are installed
- Try: `xcode-select --install`

**Build fails on Windows:**
- Ensure Visual Studio Build Tools are installed
- Try running as Administrator

**Build fails on Linux:**
- Install missing dependencies: `sudo apt-get install build-essential`
- For icon conversion: `sudo apt-get install icnsutils graphicsmagick`

**Large bundle size:**
- Check that `devDependencies` are properly separated in package.json
- Review what's being included in `electron-builder.json` files array

## Testing

### Manual Testing Checklist
- [ ] App launches successfully
- [ ] OAuth flow works (Google Drive/Dropbox)
- [ ] Native file system operations work
- [ ] App persists data between restarts
- [ ] Auto-update works (if configured)
- [ ] Deep links are handled correctly
- [ ] App icon displays correctly
- [ ] Menu bar works
- [ ] Keyboard shortcuts work
- [ ] App quits properly

### Automated Testing
```bash
# Run tests
npm run test

# With UI or coverage
npm run test:ui
npm run test:coverage
```

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder Documentation](https://www.electron.build/)
- [Platform-specific guides](https://www.electronjs.org/docs/latest/development/build-instructions-gn)

## Support

For issues or questions:
1. Check this documentation
2. Review Electron/electron-builder docs
3. Search existing GitHub issues
4. Create a new issue with detailed description
