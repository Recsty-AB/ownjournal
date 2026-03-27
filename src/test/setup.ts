import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Suppress unhandled rejections from leaked async operations during test teardown
// (e.g. "window is not defined" after jsdom environment is cleaned up)
process.on('unhandledRejection', (reason) => {
  if (reason instanceof ReferenceError && reason.message.includes('window is not defined')) {
    return; // Suppress — this is a test isolation artifact, not a real error
  }
});

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
    importKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'AES-GCM' },
      usages: ['encrypt', 'decrypt'],
    } as unknown as CryptoKey),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    generateKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'AES-GCM' },
      usages: ['encrypt', 'decrypt'],
    } as unknown as CryptoKey),
    deriveKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'AES-GCM' },
      usages: ['encrypt', 'decrypt'],
    } as unknown as CryptoKey),
    deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    verify: vi.fn().mockResolvedValue(true),
    wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    unwrapKey: vi.fn().mockResolvedValue({
      type: 'secret',
      algorithm: { name: 'AES-GCM' },
      usages: ['encrypt', 'decrypt'],
    } as unknown as CryptoKey),
  },
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
});

// Mock localStorage
const createStorageMock = () => {
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
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
};

Object.defineProperty(global, 'localStorage', {
  value: createStorageMock(),
});

Object.defineProperty(global, 'sessionStorage', {
  value: createStorageMock(),
  writable: true,
});

// Global react-i18next mock
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return key;
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn().mockResolvedValue(undefined) },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

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

// Mock window.matchMedia for components using media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Supabase config and client globally to avoid "supabaseUrl is required" errors
vi.mock('@/config/supabase', () => ({
  SUPABASE_CONFIG: {
    url: 'https://test.supabase.co',
    anonKey: 'test-anon-key',
    projectId: 'test-project-id',
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));
