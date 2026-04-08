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
