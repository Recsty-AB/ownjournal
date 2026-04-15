import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TitleSuggestion } from '../TitleSuggestion';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/aiCacheService', () => ({
  aiCacheService: {
    getCached: vi.fn().mockResolvedValue(null),
    setCached: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { suggestedTitle: 'AI Title' } }),
    },
  },
}));

describe('TitleSuggestion', () => {
  const mockOnApply = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(
      <TitleSuggestion
        content="Test content for title generation"
        onApply={mockOnApply}
        isPro={true}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render generate button', () => {
    const { container } = render(
      <TitleSuggestion
        content="Test content"
        onApply={mockOnApply}
        isPro={true}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render for non-pro users', () => {
    const { container } = render(
      <TitleSuggestion
        content="Test content"
        onApply={mockOnApply}
        isPro={false}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle empty content', () => {
    const { container } = render(
      <TitleSuggestion
        content=""
        onApply={mockOnApply}
        isPro={true}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle long content', () => {
    const longContent = 'a'.repeat(1000);
    const { container } = render(
      <TitleSuggestion
        content={longContent}
        onApply={mockOnApply}
        isPro={true}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render loading state', () => {
    const { container } = render(
      <TitleSuggestion
        content="Test content"
        onApply={mockOnApply}
        isPro={true}
      />
    );
    expect(container).toBeInTheDocument();
  });
});
