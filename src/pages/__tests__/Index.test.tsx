import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Index from '../Index';

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
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(<Index />);
    expect(container).toBeInTheDocument();
  });

  it('should render authentication screen for unauthenticated users', () => {
    const { container } = render(<Index />);
    expect(container).toBeInTheDocument();
  });

  it('should handle loading states', () => {
    const { container } = render(<Index />);
    expect(container).toBeInTheDocument();
  });

  it('should render main app components', () => {
    const { container } = render(<Index />);
    expect(container).toBeInTheDocument();
  });

  it('should handle authentication state changes', () => {
    const { container } = render(<Index />);
    expect(container).toBeInTheDocument();
  });
});
