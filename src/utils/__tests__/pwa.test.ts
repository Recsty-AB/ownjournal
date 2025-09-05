import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerServiceWorker,
  requestNotificationPermission,
  scheduleJournalReminder,
  isInstallable,
  showInstallPrompt,
  generateEncryptionKey,
  encryptData,
  decryptData,
  openDB,
  saveToIndexedDB,
  getFromIndexedDB,
} from '../pwa';

// Mock global objects
const mockServiceWorkerContainer = {
  register: vi.fn(),
};

const mockNotification = {
  requestPermission: vi.fn(),
};

describe('PWA Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup navigator mock
    Object.defineProperty(global, 'navigator', {
      value: {
        serviceWorker: mockServiceWorkerContainer,
      },
      writable: true,
    });

    // Setup Notification mock
    Object.defineProperty(global, 'Notification', {
      value: mockNotification,
      writable: true,
    });

    // Setup window mock
    Object.defineProperty(global, 'window', {
      value: {
        BeforeInstallPromptEvent: class {},
      },
      writable: true,
    });
  });

  describe('Service Worker', () => {
    it('should register service worker successfully', async () => {
      const mockRegistration = { scope: '/' };
      mockServiceWorkerContainer.register.mockResolvedValue(mockRegistration);

      const result = await registerServiceWorker();

      expect(mockServiceWorkerContainer.register).toHaveBeenCalledWith('/sw.js');
      expect(result).toBe(mockRegistration);
    });

    it('should handle service worker registration failure', async () => {
      mockServiceWorkerContainer.register.mockRejectedValue(new Error('Registration failed'));

      const result = await registerServiceWorker();

      expect(result).toBeNull();
    });

    it('should return null if service worker not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      const result = await registerServiceWorker();

      expect(result).toBeNull();
    });
  });

  describe('Notifications', () => {
    it('should request notification permission', async () => {
      mockNotification.requestPermission.mockResolvedValue('granted');

      const result = await requestNotificationPermission();

      expect(mockNotification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('should return denied if Notification API not available', async () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });

      const result = await requestNotificationPermission();

      expect(result).toBe('denied');
    });

    it('should schedule journal reminder', async () => {
      const mockRegistration = {} as ServiceWorkerRegistration;

      await expect(scheduleJournalReminder(mockRegistration)).resolves.toBeUndefined();
    });
  });

  describe('Install Prompt', () => {
    it('should detect installability', () => {
      const result = isInstallable();

      expect(result).toBe(true);
    });

    it('should show install prompt', async () => {
      const mockPrompt = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      const result = await showInstallPrompt(mockPrompt);

      expect(mockPrompt.prompt).toHaveBeenCalled();
      expect(result).toEqual({ outcome: 'accepted' });
    });

    it('should handle missing prompt', async () => {
      const result = await showInstallPrompt(null);

      expect(result).toEqual({ outcome: 'dismissed' });
    });
  });

  describe('Encryption', () => {
    beforeEach(() => {
      // Mock crypto API
      Object.defineProperty(global, 'crypto', {
        value: {
          subtle: {
            generateKey: vi.fn(),
            encrypt: vi.fn(),
            decrypt: vi.fn(),
          },
          getRandomValues: vi.fn((arr) => arr),
        },
        writable: true,
      });
    });

    it('should generate encryption key', async () => {
      const mockKey = {} as CryptoKey;
      vi.mocked(crypto.subtle.generateKey).mockResolvedValue(mockKey as any);

      const result = await generateEncryptionKey();

      expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockKey);
    });

    it('should encrypt data', async () => {
      const mockKey = {} as CryptoKey;
      const mockEncrypted = new ArrayBuffer(8);
      
      vi.mocked(crypto.subtle.encrypt).mockResolvedValue(mockEncrypted);

      const result = await encryptData('test data', mockKey);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result.encrypted).toBe(mockEncrypted);
    });

    it('should decrypt data', async () => {
      const mockKey = {} as CryptoKey;
      const mockEncrypted = new ArrayBuffer(8);
      const mockIv = new ArrayBuffer(12);
      const mockDecrypted = new TextEncoder().encode('test data');
      
      vi.mocked(crypto.subtle.decrypt).mockResolvedValue(mockDecrypted.buffer);

      const result = await decryptData(mockEncrypted, mockKey, mockIv);

      expect(result).toBe('test data');
    });

    it('should handle encryption errors', async () => {
      const mockKey = {} as CryptoKey;
      vi.mocked(crypto.subtle.encrypt).mockRejectedValue(new Error('Encryption failed'));

      await expect(encryptData('test', mockKey)).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption errors', async () => {
      const mockKey = {} as CryptoKey;
      vi.mocked(crypto.subtle.decrypt).mockRejectedValue(new Error('Decryption failed'));

      await expect(
        decryptData(new ArrayBuffer(8), mockKey, new ArrayBuffer(12))
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('IndexedDB', () => {
    let mockDB: any;
    let mockRequest: any;

    beforeEach(() => {
      mockDB = {
        objectStoreNames: {
          contains: vi.fn(),
        },
        createObjectStore: vi.fn(),
        transaction: vi.fn(),
      };

      mockRequest = {
        result: mockDB,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      Object.defineProperty(global, 'indexedDB', {
        value: {
          open: vi.fn(() => mockRequest),
        },
        writable: true,
      });
    });

    it('should open database', async () => {
      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      const result = await openDB();

      expect(indexedDB.open).toHaveBeenCalledWith('JournalDB', 2);
      expect(result).toBe(mockDB);
    });

    it('should handle database open error', async () => {
      setTimeout(() => {
        mockRequest.error = new Error('Failed to open');
        mockRequest.onerror();
      }, 0);

      await expect(openDB()).rejects.toThrow();
    });

    it('should create object stores on upgrade', async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(false);

      setTimeout(() => {
        const upgradeEvent = {
          target: mockRequest,
        };
        mockRequest.onupgradeneeded(upgradeEvent);
        mockRequest.onsuccess();
      }, 0);

      await openDB();

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('entries', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('settings', { keyPath: 'key' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('ai_cache', { keyPath: 'key' });
    });

    it('should save to IndexedDB', async () => {
      const mockStore = {
        put: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      const data = { id: 'test', value: 'data' };
      
      setTimeout(() => {
        const putRequest = mockStore.put();
        putRequest.onsuccess();
      }, 0);

      await saveToIndexedDB('entries', data);

      expect(mockTransaction.objectStore).toHaveBeenCalledWith('entries');
    });

    it('should get from IndexedDB', async () => {
      const mockData = { id: 'test', value: 'data' };
      const mockStore = {
        get: vi.fn(() => ({
          result: mockData,
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      setTimeout(() => {
        const getRequest = mockStore.get();
        getRequest.onsuccess();
      }, 10);

      const result = await getFromIndexedDB('entries', 'test');

      expect(result).toBe(mockData);
    });

    it('should handle IndexedDB save errors', async () => {
      const mockStore = {
        put: vi.fn(() => ({
          error: new Error('Save failed'),
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      setTimeout(() => {
        const putRequest = mockStore.put();
        putRequest.onerror();
      }, 0);

      await expect(saveToIndexedDB('entries', {})).rejects.toThrow();
    });

    it('should handle IndexedDB get errors', async () => {
      const mockStore = {
        get: vi.fn(() => ({
          error: new Error('Get failed'),
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      setTimeout(() => {
        const getRequest = mockStore.get();
        getRequest.onerror();
      }, 10);

      await expect(getFromIndexedDB('entries', 'test')).rejects.toThrow();
    });
  });
});
