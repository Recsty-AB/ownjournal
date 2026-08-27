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
    // Initial colours for the native overlays drawn behind the Android system bars,
    // applied at plugin load so the first frame is not transparent. The deprecated
    // `backgroundColor` option is avoided; useAndroidSystemBars() re-applies these
    // per theme once React mounts.
    EdgeToEdge: {
      statusBarColor: '#f8f6f3',
      navigationBarColor: '#f8f6f3'
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
