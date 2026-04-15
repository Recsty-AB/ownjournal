import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TrendAnalysis } from '../TrendAnalysis';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/aiCacheService', () => ({
  aiCacheService: {
    getCached: vi.fn().mockResolvedValue(null),
    setCached: vi.fn().mockResolvedValue(undefined),
    getTrendCacheKey: vi.fn().mockResolvedValue('test-cache-key'),
    deleteCached: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {} }),
    },
  },
}));

vi.mock('@/services/cloudStorageService', () => ({
  cloudStorageService: {
    getConnectedProviderNames: vi.fn(() => []),
    downloadFromPrimary: vi.fn(() => Promise.resolve(null)),
    uploadToAll: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn(() => null),
  },
}));

vi.mock('@/utils/encryption', () => ({
  encryptData: vi.fn(() => Promise.resolve({ encrypted: new ArrayBuffer(0), iv: new ArrayBuffer(0) })),
  decryptData: vi.fn(() => Promise.resolve('{}')),
  arrayBufferToBase64: vi.fn(() => ''),
  base64ToArrayBuffer: vi.fn(() => new ArrayBuffer(0)),
}));

describe('TrendAnalysis', () => {
  const mockEntries = [
    {
      id: '1',
      date: new Date(),
      title: 'Entry 1',
      body: 'Content 1',
      tags: ['tag1'],
      mood: 'good' as const,
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      date: new Date(),
      title: 'Entry 2',
      body: 'Content 2',
      tags: ['tag2'],
      mood: 'okay' as const,
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      date: new Date(),
      title: 'Entry 3',
      body: 'Content 3',
      tags: ['tag3'],
      mood: 'great' as const,
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(
      <TrendAnalysis entries={mockEntries} isPro={true} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render analyze button', () => {
    const { container } = render(
      <TrendAnalysis entries={mockEntries} isPro={true} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render with empty entries', () => {
    const { container } = render(
      <TrendAnalysis entries={[]} isPro={true} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render for non-pro users', () => {
    const { container } = render(
      <TrendAnalysis entries={mockEntries} isPro={false} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle many entries', () => {
    const manyEntries = Array.from({ length: 50 }, (_, i) => ({
      ...mockEntries[0],
      id: `entry-${i}`,
    }));
    const { container } = render(
      <TrendAnalysis entries={manyEntries} isPro={true} />
    );
    expect(container).toBeInTheDocument();
  });
});
