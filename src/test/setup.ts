import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock crypto API
const mockCrypto = {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => '12345678-1234-1234-1234-123456789012',
  subtle: {
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    importKey: vi.fn().mockResolvedValue({} as CryptoKey),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    generateKey: vi.fn().mockResolvedValue({} as CryptoKey),
  },
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: false,
      VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
      VITE_GOOGLE_CLIENT_SECRET: 'test-google-secret',
      VITE_DROPBOX_CLIENT_ID: 'test-dropbox-client-id',
      VITE_DROPBOX_CLIENT_SECRET: 'test-dropbox-secret',
    },
  },
});
