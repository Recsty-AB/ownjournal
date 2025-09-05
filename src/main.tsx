import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './utils/pwa.ts'
import { aiCacheService } from './services/aiCacheService'

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for PWA functionality
registerServiceWorker();

// Cleanup expired AI cache on app launch
aiCacheService.cleanupExpired().catch(err =>
  console.error('Failed to cleanup AI cache on launch:', err)
);
