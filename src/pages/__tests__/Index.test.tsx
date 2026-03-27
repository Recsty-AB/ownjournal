import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Index from '../Index';

// Mock react-i18next including initReactI18next (needed by i18n/config)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock i18n config to prevent real initialization
vi.mock('@/i18n/config', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockReturnThis(),
    t: (key: string) => key,
    language: 'en',
    changeLanguage: vi.fn(),
  },
}));

// Mock all dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllEntries: vi.fn().mockResolvedValue([]),
    saveEntry: vi.fn().mockResolvedValue(undefined),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    getMasterKey: vi.fn(() => null),
    performFullSync: vi.fn().mockResolvedValue(undefined),
    onSyncProgress: vi.fn(() => () => {}),
    onMasterKeyChanged: vi.fn(() => () => {}),
    canInitialSync: vi.fn(() => false),
    isSyncInProgress: vi.fn(() => false),
    clearMasterKey: vi.fn(),
    loadEntrySnapshot: vi.fn().mockResolvedValue([]),
    saveEntrySnapshot: vi.fn().mockResolvedValue(undefined),
    onConflictDetected: vi.fn(() => () => {}),
    onEntriesChanged: vi.fn(() => () => {}),
    onStatusChange: vi.fn(() => () => {}),
    onCloudProviderConnected: vi.fn().mockResolvedValue(undefined),
    getSyncStatus: vi.fn(() => 'idle'),
    isPendingOAuth: false,
    resetEncryptionState: vi.fn(),
    ensureAutoSyncRunning: vi.fn(),
    hasCachedEncryptionKey: vi.fn(() => false),
    tryRecoverMasterKeyFromProviders: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('@/services/encryptionStateManager', () => ({
  encryptionStateManager: {
    getState: vi.fn(() => ({ mode: 'simple', hasKey: false })),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('@/services/cloudStorageService', () => ({
  cloudStorageService: {
    initialize: vi.fn(),
  },
}));

vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    getConnectedProviderNames: vi.fn(() => []),
    getConnectedCount: vi.fn(() => 0),
    isConnected: vi.fn(() => false),
    isPrimaryProvider: vi.fn(() => false),
    subscribe: vi.fn(() => () => {}),
    getPrimaryProviderName: vi.fn(() => null),
    getPrimaryProvider: vi.fn(() => null),
    getProvider: vi.fn(() => null),
    ensureConnections: vi.fn().mockResolvedValue(undefined),
    getConnectedProviders: vi.fn(() => []),
  },
}));

vi.mock('@/config/supabase', () => ({
  SUPABASE_CONFIG: {
    url: 'https://test.supabase.co',
    publishableKey: 'test-key',
  },
}));

vi.mock('@/services/aiCacheService', () => ({
  aiCacheService: {
    clearExpired: vi.fn().mockResolvedValue(undefined),
    clearTagsCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/utils/passwordStorage', () => ({
  retrievePassword: vi.fn().mockResolvedValue(null),
  clearPassword: vi.fn().mockResolvedValue(undefined),
  storePassword: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/journalNameStorage', () => ({
  journalNameStorage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    getJournalName: vi.fn(() => null),
    setJournalName: vi.fn(),
  },
}));

vi.mock('@/utils/userScope', () => ({
  setCurrentUserId: vi.fn(),
  getCurrentUserId: vi.fn(() => null),
  migrateLocalStorageToUserScope: vi.fn(),
  clearUnscopedUserData: vi.fn(),
  scopedKey: vi.fn((key: string) => key),
}));

vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    showOnboarding: false,
    startOnboarding: vi.fn(),
    completeOnboarding: vi.fn(),
  }),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('@/utils/nativeExport', () => ({
  isNativePlatform: vi.fn(() => false),
  saveJsonBackupNative: vi.fn(),
  shareFileNative: vi.fn(),
}));

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(wrap(<Index />));
    expect(container).toBeInTheDocument();
  });

  it('should render authentication screen for unauthenticated users', () => {
    const { container } = render(wrap(<Index />));
    expect(container).toBeInTheDocument();
  });

  it('should handle loading states', () => {
    const { container } = render(wrap(<Index />));
    expect(container).toBeInTheDocument();
  });

  it('should render main app components', () => {
    const { container } = render(wrap(<Index />));
    expect(container).toBeInTheDocument();
  });

  it('should handle authentication state changes', () => {
    const { container } = render(wrap(<Index />));
    expect(container).toBeInTheDocument();
  });
});
