import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker, requestPersistentStorage } from './utils/pwa.ts'
import { aiCacheService } from './services/aiCacheService'

// Android 15+ enforces edge-to-edge. Without this plugin, the WebView extends
// behind the status bar and gesture nav, and env(safe-area-inset-*) returns 0,
// so component-level safe-area padding (Header, FAB, Drawer, Toast, etc.) does
// nothing on Android. The plugin populates the env() values natively.
// Bar colours and icon contrast are theme-dependent and handled by
// useAndroidSystemBars(); the initial values come from capacitor.config.ts.
if (Capacitor.getPlatform() === 'android') {
  void (async () => {
    try {
      const { EdgeToEdge } = await import('@capawesome/capacitor-android-edge-to-edge-support');
      await EdgeToEdge.enable();
    } catch (err) {
      if (import.meta.env.DEV) console.error('Edge-to-edge init failed:', err);
    }
  })();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for PWA functionality
registerServiceWorker();

// Ask the browser to keep our storage persistent so WebKit (Safari ITP) does not
// evict the encryption mode + cloud-provider preferences after 7 days of inactivity.
// Best-effort, never blocks startup.
requestPersistentStorage().then((granted) => {
  if (import.meta.env.DEV) console.log('[storage] persistent =', granted);
}).catch(() => { /* non-fatal */ });

// Cleanup expired AI cache on app launch
aiCacheService.cleanupExpired().catch(err =>
  console.error('Failed to cleanup AI cache on launch:', err)
);
