# Electron Scripts Setup

## Required package.json Modifications

To enable Electron development and building, add the following to your `package.json`:

### 1. Add Main Entry Point

Add this line at the root level of package.json (after "dependencies"):

```json
"main": "electron/main.js",
```

### 2. Add Electron Scripts

Add these scripts to the "scripts" section:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview",
  
  // Add these new Electron scripts:
  "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron electron/main.js\"",
  "electron:build": "BUILD_TARGET=electron npm run build && electron-builder",
  "electron:build:mac": "BUILD_TARGET=electron npm run build && electron-builder --mac",
  "electron:build:win": "BUILD_TARGET=electron npm run build && electron-builder --win",
  "electron:build:linux": "BUILD_TARGET=electron npm run build && electron-builder --linux",
  "electron:build:all": "BUILD_TARGET=electron npm run build && electron-builder -mwl"
}
```

On Windows, use `set BUILD_TARGET=electron && npm run build && electron-builder` or a cross-platform script if needed.

### Complete Example

Add the following to your existing `package.json` (keep your current `name`, `version`, etc.):

```json
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron electron/main.js\"",
    "electron:build": "BUILD_TARGET=electron npm run build && electron-builder",
    "electron:build:mac": "BUILD_TARGET=electron npm run build && electron-builder --mac",
    "electron:build:win": "BUILD_TARGET=electron npm run build && electron-builder --win",
    "electron:build:linux": "BUILD_TARGET=electron npm run build && electron-builder --linux",
    "electron:build:all": "BUILD_TARGET=electron npm run build && electron-builder -mwl"
  }
```

The dev server runs on port 8080 (see `vite.config.ts`). Use `BUILD_TARGET=electron` for production builds so asset paths are correct for Electron.

## Usage

After adding these scripts:

### Development
```bash
npm run electron:dev
```

### Build for Current Platform
```bash
# Set BUILD_TARGET for proper asset paths
BUILD_TARGET=electron npm run electron:build
```

### Build for Specific Platform
```bash
BUILD_TARGET=electron npm run electron:build:mac     # macOS
BUILD_TARGET=electron npm run electron:build:win     # Windows
BUILD_TARGET=electron npm run electron:build:linux   # Linux
BUILD_TARGET=electron npm run electron:build:all     # All platforms
```

## Next Steps

1. Copy the scripts above to your package.json
2. Run `npm install` to ensure all dependencies are installed
3. Follow the instructions in `ELECTRON_SETUP.md` for full setup
