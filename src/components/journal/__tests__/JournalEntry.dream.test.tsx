import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JournalEntry, type JournalEntryData } from '../JournalEntry';
import type { DreamReflection } from '@/types/dream';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
const titleProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));
vi.mock('../TitleSuggestion', () => ({
  TitleSuggestion: (props: Record<string, unknown>) => {
    titleProps.last = props;
    return null;
  },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test' } } }) } },
}));

const reflection: DreamReflection = {
  version: 1,
  createdAt: '2026-11-19T07:00:00.000Z',
  contentHash: 'h',
  summary: 'A summary.',
  themes: [],
  images: [],
  wakingLinks: [],
  questions: ['A question?'],
  coded: { characters: [], settings: [], emotions: [], themes: [] },
  care: 'none',
};

const dreamEntry = (overrides: Partial<JournalEntryData> = {}): JournalEntryData => ({
  id: 'd1',
  date: new Date('2026-11-19T06:30:00Z'),
  title: 'Sea house',
  body: 'I was in a house by the sea.',
  tags: [],
  mood: 'okay',
  createdAt: new Date('2026-11-19T06:30:00Z'),
  updatedAt: new Date('2026-11-19T06:30:00Z'),
  type: 'dream',
  dream: { feelings: ['awe'], recurring: true },
  dreamReflection: reflection,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  titleProps.last = null;
});

describe('JournalEntry dream mode', () => {
  it('sends no mood with the title suggestion for a dream', () => {
    render(<JournalEntry entry={dreamEntry({ body: 'I was in a house by the sea, looking for a door.' })} onSave={vi.fn()} isEditing isPro />);

    expect(titleProps.last).not.toBeNull();
    expect(titleProps.last!.mood).toBeUndefined();
  });

  it('swaps mood and activities for dream details and shows the guide the first time', () => {
    render(<JournalEntry onSave={vi.fn()} isEditing />);
    expect(screen.getByRole('button', { name: 'journalEntry.moods.great' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dream.toggle/ }));

    expect(screen.getByText('dream.guide.title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'dream.guide.done' }));

    expect(screen.queryByRole('button', { name: 'journalEntry.moods.great' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dream.feelings.fear' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('dream.editor.placeholder')).toBeInTheDocument();
  });

  it('does not show the guide again after the first time', () => {
    const { unmount } = render(<JournalEntry onSave={vi.fn()} isEditing />);
    fireEvent.click(screen.getByRole('button', { name: /dream.toggle/ }));
    unmount();

    render(<JournalEntry onSave={vi.fn()} isEditing />);
    fireEvent.click(screen.getByRole('button', { name: /dream.toggle/ }));

    expect(screen.queryByText('dream.guide.title')).not.toBeInTheDocument();
  });

  it('saves a new dream with its type, feelings and flags, and no mood or activities', () => {
    const onSave = vi.fn();
    render(<JournalEntry onSave={onSave} isEditing />);
    fireEvent.click(screen.getByRole('button', { name: /dream.toggle/ }));
    fireEvent.click(screen.getByRole('button', { name: 'dream.guide.done' }));
    fireEvent.click(screen.getByRole('button', { name: 'dream.feelings.fear' }));
    fireEvent.click(screen.getByRole('button', { name: 'dream.flags.nightmare' }));
    fireEvent.change(screen.getByPlaceholderText('dream.editor.placeholder'), { target: { value: 'I was being chased.' } });

    fireEvent.click(screen.getByRole('button', { name: /journalEntry.saveEntry/ }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dream',
      dream: { feelings: ['fear'], nightmare: true },
      mood: 'okay',
      activities: [],
    }));
  });

  it('keeps the saved reflection when a dream is edited', () => {
    const onSave = vi.fn();
    render(<JournalEntry entry={dreamEntry()} onSave={onSave} isEditing />);

    fireEvent.click(screen.getByRole('button', { name: /journalEntry.saveEntry/ }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'dream',
      dream: { feelings: ['awe'], recurring: true },
      dreamReflection: reflection,
    }));
  });

  it('drops the dream details when Dream is switched off', () => {
    const onSave = vi.fn();
    render(<JournalEntry entry={dreamEntry()} onSave={onSave} isEditing />);

    fireEvent.click(screen.getByRole('button', { name: /dream.toggle/ }));
    fireEvent.click(screen.getByRole('button', { name: /journalEntry.saveEntry/ }));

    const saved = onSave.mock.calls[0][0];
    expect(saved).not.toHaveProperty('type');
    expect(saved).not.toHaveProperty('dream');
    expect(saved).not.toHaveProperty('dreamReflection');
  });

  it('shows a dream badge and its feelings instead of a mood in view mode', () => {
    render(<JournalEntry entry={dreamEntry()} onSave={vi.fn()} isPro />);

    expect(screen.getByText('dream.badge')).toBeInTheDocument();
    expect(screen.getByText('dream.feelings.awe')).toBeInTheDocument();
    expect(screen.getByText('dream.flags.recurring')).toBeInTheDocument();
    expect(screen.queryByText('journalEntry.moods.okay')).not.toBeInTheDocument();
    // The dream reflection replaces the general AI analysis.
    expect(screen.getByText('A summary.')).toBeInTheDocument();
    expect(screen.queryByText('ai.analysis')).not.toBeInTheDocument();
  });
});
