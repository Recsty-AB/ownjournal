import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker, requestPersistentStorage } from './utils/pwa.ts'
import { aiCacheService } from './services/aiCacheService'

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
