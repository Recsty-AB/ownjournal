# Desktop App Build Guide

## Overview

OwnJournal now supports native desktop applications for Windows, macOS, and Linux using Electron. This guide covers the complete setup process.

**Note:** Electron scripts are not in `package.json` by default. Add them first using [ELECTRON_SCRIPTS.md](ELECTRON_SCRIPTS.md).

## Quick Start

### 1. Export to GitHub

Since Lovable doesn't run Electron directly, you need to export your project:

1. Click the GitHub button in the top right of Lovable
2. Export/transfer your project to GitHub
3. Clone the repository to your local machine:

```bash
git clone YOUR_GITHUB_REPO_URL
cd ownjournal
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Electron Scripts

**Important:** You need to manually add Electron scripts to `package.json`. See `ELECTRON_SCRIPTS.md` for detailed instructions.

Quick version - add to package.json (see [ELECTRON_SCRIPTS.md](ELECTRON_SCRIPTS.md) for full details):

```json
"main": "electron/main.js",
"scripts": {
  "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron electron/main.js\"",
  "electron:build": "BUILD_TARGET=electron npm run build && electron-builder",
  "electron:build:mac": "BUILD_TARGET=electron npm run build && electron-builder --mac",
  "electron:build:win": "BUILD_TARGET=electron npm run build && electron-builder --win",
  "electron:build:linux": "BUILD_TARGET=electron npm run build && electron-builder --linux"
}
```

### 4. Run in Development

```bash
npm run electron:dev
```

This will:
- Start the Vite dev server
- Launch the Electron app
- Enable hot reload for rapid development

### 5. Build for Production

```bash
# Build for your current platform (with proper asset paths)
BUILD_TARGET=electron npm run electron:build

# Or build for a specific platform
BUILD_TARGET=electron npm run electron:build:mac      # macOS (requires macOS)
BUILD_TARGET=electron npm run electron:build:win      # Windows
BUILD_TARGET=electron npm run electron:build:linux    # Linux
```

**Note:** The `BUILD_TARGET=electron` environment variable ensures asset paths are relative (required for Electron).

Built apps will be in the `dist-electron/` directory.

## Features

### ✅ Native OAuth

OAuth authentication works via native browser windows with deep linking:

- Opens provider's auth page in a secure native window
- Automatically captures the OAuth callback
- Supports Google Drive, Dropbox, and other providers
- No manual URL copying required

### ✅ Native File System

Full access to the file system for:

- Reading and writing journal entries
- Local file backup
- Import/export functionality
- Offline-first architecture

### ✅ Cross-Platform

Build once, run everywhere:

- **macOS**: Intel and Apple Silicon (Universal builds)
- **Windows**: x64 and x86 (32-bit)
- **Linux**: AppImage, DEB, RPM packages

### ✅ Auto-Updates

Configure auto-updates for:

- Seamless updates for users
- GitHub Releases integration
- Delta updates for smaller downloads

## Platform Requirements

### macOS

- macOS 10.13 or later
- Xcode Command Line Tools
- For building: `xcode-select --install`

### Windows

- Windows 10 or later
- Automatically installs build tools via electron-builder

### Linux

- Ubuntu 18.04+ or equivalent
- Build essentials: `sudo apt-get install build-essential`

## Files & Structure

```
electron/
├── main.js          # Main Electron process (app lifecycle, OAuth)
└── preload.js       # Secure IPC bridge (context isolation)

resources/
├── icon.png         # App icon (512x512 PNG)
└── splash.png       # Splash screen (optional)

electron-builder.json  # Build configuration
src/types/electron.d.ts  # TypeScript definitions
```

## Documentation

- `ELECTRON_SETUP.md` - Comprehensive setup guide with troubleshooting
- `ELECTRON_SCRIPTS.md` - package.json modifications needed
- `electron-builder.json` - Build configuration reference

## Platform-Specific Notes

### macOS

- Universal binaries support both Intel and Apple Silicon
- Code signing required for distribution (needs Apple Developer account)
- DMG installer provides drag-to-Applications experience

### Windows

- NSIS installer includes uninstall support
- Portable executable available (no installation required)
- Code signing recommended to avoid SmartScreen warnings

### Linux

- AppImage works on all distributions (no installation)
- DEB for Debian/Ubuntu-based systems
- RPM for Fedora/RHEL-based systems

## Testing

### Test in Development

```bash
npm run electron:dev
```

### Test Production Build

After building, install and run the built application from `dist-electron/`:

- **macOS**: Double-click the `.dmg` file
- **Windows**: Run the `.exe` installer
- **Linux**: Make AppImage executable and run it

## Troubleshooting

### Build Fails

```bash
# Clear everything and reinstall
rm -rf node_modules dist dist-electron
npm install
npm run electron:build
```

### OAuth Not Working

1. Verify redirect URI is set to `ownjournal://oauth/callback` in your OAuth provider settings
2. Check that the protocol is registered (automatic in Electron)
3. Look for errors in both main process and renderer console

### App Won't Start

- Ensure all dependencies are installed: `npm install`
- Check that `electron/main.js` and `electron/preload.js` exist
- Verify vite.config.ts has `base: "./"` for proper asset loading

## Next Steps

1. **Code Signing**: Set up certificates for macOS and Windows
2. **Auto-Updates**: Configure update server (GitHub Releases, S3, etc.)
3. **CI/CD**: Automate builds with GitHub Actions
4. **Distribution**: Publish to app stores or host downloads

For detailed information, see `ELECTRON_SETUP.md`.

## Support

- Electron documentation: https://www.electronjs.org/docs
- electron-builder docs: https://www.electron.build/
- Platform-specific guides in `ELECTRON_SETUP.md`
