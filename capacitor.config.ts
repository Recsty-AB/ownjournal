import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ownjournal',
  appName: 'OwnJournal',
  webDir: 'dist',
  plugins: {
    App: {
      appUrlOpen: {
        enabled: true
      }
    },
    // SystemBars supplies CSS insets, including the keyboard/older-WebView
    // workarounds. Page backgrounds paint behind the transparent system bars.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover'
    }
  },
  android: {
    scheme: 'ownjournal',
    allowMixedContent: true
  },
  ios: {
    scheme: 'ownjournal',
    contentInset: 'never',
    backgroundColor: '#f9f8f5'
  }
};

export default config;
