const CACHE_NAME = 'journal-pwa-v3';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(urlsToCache);
      } catch (e) {
        // Ignore install cache errors to avoid blocking activation
        console.warn('SW: Precache failed, continuing without it', e);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Skip navigation requests (handled by the browser)
  if (req.mode === 'navigate') return;

  const url = new URL(req.url);

  // Only same-origin
  if (url.origin !== self.location.origin) return;

  // Ignore dev/HMR and special runtime files
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/~flock') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  const dest = req.destination;
  const isStaticAsset = (
    ['script','style','image','font'].includes(dest) ||
    url.pathname.startsWith('/assets/')
  );

  if (!isStaticAsset) return; // Let the browser handle everything else

  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const res = await fetch(req);
        // Cache successful or opaque responses
        if (res && (res.ok || res.type === 'opaque')) {
          cache.put(req, res.clone()).catch(() => {}); // Ignore cache write failures
        }
        return res;
      } catch (err) {
        // Network failed, return offline response
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    } catch (err) {
      // Cache API failed - try network as last resort
      try {
        return await fetch(req);
      } catch {
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    }
  })());
});

// Activate: clean old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

// Background sync for journal entries
self.addEventListener('sync', event => {
  if (event.tag === 'journal-sync') {
    event.waitUntil(
      // Sync journal entries with cloud storage
      syncJournalEntries()
    );
  }
});

// Push notification handler
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Time to reflect on your day',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'write',
        title: 'Write Entry',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Journal Reminder', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'write') {
    // Open the app and focus on new entry
    event.waitUntil(
      clients.openWindow('/?new=true')
    );
  }
});

async function syncJournalEntries() {
  if (!self.navigator.onLine) {
    return Promise.resolve();
  }
  try {
    // This would sync with the user's chosen cloud storage
    console.log('Background sync: Syncing journal entries...');
    return Promise.resolve();
  } catch (error) {
    console.error('Background sync failed:', error);
    throw error;
  }
}