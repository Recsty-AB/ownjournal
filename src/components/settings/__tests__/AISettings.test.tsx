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

vi.mock('@/hooks/useLocalAICapability', () => ({
  useLocalAICapability: () => ({
    capability: {
      tier: 'unsupported',
      reason: 'no-webgpu',
      detail: 'No WebGPU',
      detected: {
        platform: 'desktop',
        hasWebGPU: false,
        estimatedRamBytes: null,
        ramSource: 'unknown',
        availableStorageBytes: null,
        userAgent: 'test',
      },
    },
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/services/localAIGenerative', () => ({
  localAIGenerative: {
    loadModel: vi.fn(),
    clearCache: vi.fn(),
    runBenchmark: vi.fn(),
    isReady: vi.fn(() => false),
    getLoadedModel: vi.fn(() => null),
    supportsFeature: vi.fn(() => false),
  },
}));

describe('AISettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Plus lock card when the user is not Plus', () => {
    const { container } = render(<AISettings isPro={false} />);
    expect(container.textContent).toContain('settings.aiTab.plusRequired');
  });

  it('renders without error for Plus users when local AI feature flag is off', () => {
    const { container } = render(<AISettings isPro={true} />);
    expect(container).toBeInTheDocument();
  });
});
