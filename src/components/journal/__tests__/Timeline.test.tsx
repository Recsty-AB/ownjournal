import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Timeline } from '../Timeline';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('Timeline', () => {
  const mockOnSaveEntry = vi.fn();
  const mockOnDeleteEntry = vi.fn();

  it('should render with empty entries', () => {
    const { container } = render(
      <Timeline
        entries={[]}
        onSaveEntry={mockOnSaveEntry}
        onDeleteEntry={mockOnDeleteEntry}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should render with entries', () => {
    const mockEntries = [
      {
        id: '1',
        date: new Date(),
        title: 'Entry 1',
        body: 'Content',
        tags: ['test'],
        mood: 'good' as const,
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const { container } = render(
      <Timeline
        entries={mockEntries}
        onSaveEntry={mockOnSaveEntry}
        onDeleteEntry={mockOnDeleteEntry}
      />
    );
    
    expect(container).toBeInTheDocument();
  });
});
