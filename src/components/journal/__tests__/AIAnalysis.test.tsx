import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AIAnalysis } from '../AIAnalysis';

vi.mock('@/services/aiCacheService', () => ({
  aiCacheService: {
    getCached: vi.fn(),
    setCached: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } } }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getEntry: vi.fn(),
    saveEntry: vi.fn(),
  },
}));

vi.mock('@/services/aiMetadataService', () => ({
  aiMetadataService: {
    getMetadata: vi.fn(),
    setMetadata: vi.fn(),
  },
}));

describe('AIAnalysis', () => {
  it('should render successfully', () => {
    const { container } = render(
      <AIAnalysis
        entryId="test-id"
        content="Test content"
        createdAt={new Date()}
        isPro={false}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should render in pro mode', () => {
    const { container } = render(
      <AIAnalysis
        entryId="test-id"
        content="Test content"
        createdAt={new Date()}
        isPro={true}
      />
    );
    
    expect(container).toBeInTheDocument();
  });
});
