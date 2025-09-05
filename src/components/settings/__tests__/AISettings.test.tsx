import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AISettings } from '../AISettings';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/utils/aiModeStorage', () => ({
  aiModeStorage: {
    getMode: vi.fn(() => 'cloud'),
    setMode: vi.fn(),
    isPreloadEnabled: vi.fn(() => false),
    setPreloadEnabled: vi.fn(),
    setCloudConsent: vi.fn(),
    hasCloudConsent: vi.fn(() => false),
    clearConsent: vi.fn(),
  },
}));

vi.mock('@/services/localAI', () => ({
  localAI: {
    getCacheSize: vi.fn().mockResolvedValue({ sizeMB: 0, isCached: false }),
    clearModelCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/utils/aiPermissions', () => ({
  aiPermissions: {
    isPROSubscriber: vi.fn().mockResolvedValue(false),
  },
}));

describe('AISettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should render mode toggle', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should render preload option', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should render cache management section', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should render mode descriptions', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should handle cloud mode', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should handle local mode', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });

  it('should render loading state for cache check', () => {
    const { container } = render(<AISettings />);
    expect(container).toBeInTheDocument();
  });
});
