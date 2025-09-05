// PWA utilities for service worker registration and notifications
import { userScopedDBName } from './userScope';

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;

  if (import.meta.env.DEV) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
    if (registrations.length > 0) {
      console.log('[SW] Unregistered service workers in dev mode');
    }
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered successfully:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission;
  }
  return 'denied';
};

export const scheduleJournalReminder = async (registration: ServiceWorkerRegistration) => {
  // Background sync is not universally supported, so we'll use a different approach
  if ('serviceWorker' in navigator) {
    try {
      console.log('Journal reminder capability registered');
      // In a real implementation, this could use push notifications or other timing mechanisms
    } catch (error) {
      console.error('Failed to schedule journal reminder:', error);
    }
  }
};

export const isInstallable = (): boolean => {
  return 'BeforeInstallPromptEvent' in window;
};

export const showInstallPrompt = (deferredPrompt: any) => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    return deferredPrompt.userChoice;
  }
  return Promise.resolve({ outcome: 'dismissed' });
};

// Encryption utilities for journal entries
export const generateEncryptionKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

export const encryptData = async (data: string, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoded
  );
  
  return { encrypted, iv: iv.buffer };
};

export const decryptData = async (encryptedData: ArrayBuffer, key: CryptoKey, iv: ArrayBuffer): Promise<string> => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedData
  );
  
  return new TextDecoder().decode(decrypted);
};

// IndexedDB utilities for offline storage
export const openDB = (): Promise<IDBDatabase> => {
  // Use user-scoped DB name so each account has isolated local storage.
  // Falls back to plain 'JournalDB' before auth resolves (pre-login reads).
  const dbName = userScopedDBName('JournalDB');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2); // Bump version for ai_cache store
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object stores for local caching only
      if (!db.objectStoreNames.contains('entries')) {
        const entriesStore = db.createObjectStore('entries', { keyPath: 'id' });
        entriesStore.createIndex('date', 'date', { unique: false });
        entriesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
      
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Add AI cache store for local caching of analysis results
      if (!db.objectStoreNames.contains('ai_cache')) {
        db.createObjectStore('ai_cache', { keyPath: 'key' });
      }
    };
  });
};

export const saveToIndexedDB = async (storeName: string, data: any): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getFromIndexedDB = async (storeName: string, key: string): Promise<any> => {
  const db = await openDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};