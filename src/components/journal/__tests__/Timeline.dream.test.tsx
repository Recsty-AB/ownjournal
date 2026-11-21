import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Timeline } from '../Timeline';
import type { JournalEntryData } from '../JournalEntry';
import { TooltipProvider } from '@/components/ui/tooltip';
import { withoutDreams } from '@/types/dream';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const day = new Date();
const entry = (id: string, overrides: Partial<JournalEntryData> = {}): JournalEntryData => ({
  id,
  date: day,
  title: `Entry ${id}`,
  body: 'Body',
  tags: [],
  mood: 'great',
  createdAt: day,
  updatedAt: day,
  ...overrides,
});

const entries = [
  entry('day', { title: 'A good day', activities: ['exercise'] }),
  // A dream keeps a placeholder mood; it must never match a mood filter.
  entry('dream', { title: 'Flying dream', type: 'dream', mood: 'great', dream: { feelings: ['joy'] } }),
];

const renderTimeline = (list = entries) => {
  render(
    <TooltipProvider>
      <Timeline entries={list} onSaveEntry={vi.fn()} onDeleteEntry={vi.fn()} />
    </TooltipProvider>,
  );
  // Filters are folded away until asked for.
  fireEvent.click(screen.getByRole('button', { name: 'timeline.filters' }));
};

describe('Timeline with dreams', () => {
  it('lists dreams alongside other entries', () => {
    renderTimeline();
    expect(screen.getByText('A good day')).toBeInTheDocument();
    expect(screen.getByText('Flying dream')).toBeInTheDocument();
  });

  it('filters to dreams only', () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: 'dream.filter' }));

    expect(screen.queryByText('A good day')).not.toBeInTheDocument();
    expect(screen.getByText('Flying dream')).toBeInTheDocument();
  });

  it('never matches dreams with a mood filter', () => {
    renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: /journalEntry.moods.great/ }));

    expect(screen.getByText('A good day')).toBeInTheDocument();
    expect(screen.queryByText('Flying dream')).not.toBeInTheDocument();
  });

  it('offers the Dreams filter only when a dream exists', () => {
    renderTimeline([entries[0]]);
    expect(screen.queryByRole('button', { name: 'dream.filter' })).not.toBeInTheDocument();
  });
});

describe('withoutDreams', () => {
  it('keeps dreams out of mood and trend views', () => {
    expect(withoutDreams(entries).map((e) => e.id)).toEqual(['day']);
  });
});
