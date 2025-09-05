import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { JournalEntry } from '../JournalEntry';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } } }),
    },
  },
}));

describe('JournalEntry', () => {
  const mockOnSave = vi.fn();

  it('should render in edit mode', () => {
    const { container } = render(
      <JournalEntry
        onSave={mockOnSave}
        isEditing={true}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should render existing entry', () => {
    const mockEntry = {
      id: '1',
      date: new Date(),
      title: 'Test',
      body: 'Content',
      tags: [],
      mood: 'good' as const,
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { container } = render(
      <JournalEntry
        entry={mockEntry}
        onSave={mockOnSave}
      />
    );
    
    expect(container).toBeInTheDocument();
  });
});
