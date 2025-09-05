# App Resources

This folder contains the official branded assets for generating iOS and Android app icons and splash screens.

## Assets

- **icon.png**: The OwnJournal logo (navy feather quill) — identical to `src/assets/logo.png`
- **splash.png**: Splash screen with centered logo on cream background

## Generating Native Assets

After modifying these files, run the asset generator to create all required sizes:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

This will automatically generate all required sizes for:
- Android: ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
- iOS: @1x, @2x, @3x variants
- Splash screens for all orientations and screen sizes

## Branding Specifications

### App Icon (`icon.png`)
- Navy feather quill logo (#1e3a5f)
- Transparent background for adaptive icon support
- Matches the web app logo exactly

### Splash Screen (`splash.png`)
- **Background**: Solid cream color `#f8f6f3`
- **Logo**: Centered OwnJournal feather quill
- **Safe zone**: Keep logo within center 1024x1024px area
- **Dimensions**: 2732x2732px recommended

## Manual Asset Placement (Alternative)

If you prefer manual control, place generated assets in:

### Android
- `android/app/src/main/res/mipmap-*dpi/ic_launcher.png`
- `android/app/src/main/res/drawable-*dpi/splash.png`

### iOS
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- `ios/App/App/Assets.xcassets/Splash.imageset/`
