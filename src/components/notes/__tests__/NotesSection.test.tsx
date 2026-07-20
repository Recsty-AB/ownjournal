import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotesSection } from '../NotesSection';
import type { JournalEntryData } from '@/components/journal/JournalEntry';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const makeNote = (overrides: Partial<JournalEntryData> = {}): JournalEntryData => ({
  id: '1',
  date: new Date('2026-01-01'),
  title: 'Wifi password',
  body: 'hunter2 #home',
  tags: ['home'],
  mood: 'okay',
  images: [],
  activities: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  type: 'note',
  ...overrides,
});

describe('NotesSection', () => {
  it('renders the empty state when there are no notes', () => {
    render(
      <NotesSection notes={[]} allTags={[]} onSaveNote={vi.fn()} onDeleteNote={vi.fn()} />
    );
    expect(screen.getByText('notes.emptyTitle')).toBeInTheDocument();
  });

  it('renders existing notes with title, body, and tags', () => {
    render(
      <NotesSection notes={[makeNote()]} allTags={['home']} onSaveNote={vi.fn()} onDeleteNote={vi.fn()} />
    );
    expect(screen.getByText('Wifi password')).toBeInTheDocument();
    expect(screen.getByText(/hunter2/)).toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('filters notes by search text', () => {
    const notes = [
      makeNote(),
      makeNote({ id: '2', title: 'Books to read', body: 'Dune', tags: [] }),
    ];
    render(
      <NotesSection notes={notes} allTags={[]} onSaveNote={vi.fn()} onDeleteNote={vi.fn()} />
    );
    fireEvent.change(screen.getByPlaceholderText('notes.searchPlaceholder'), {
      target: { value: 'books' },
    });
    expect(screen.getByText('Books to read')).toBeInTheDocument();
    expect(screen.queryByText('Wifi password')).not.toBeInTheDocument();
  });

  it('saves a new note with inline #tags merged in', () => {
    const onSaveNote = vi.fn();
    render(
      <NotesSection notes={[]} allTags={[]} onSaveNote={onSaveNote} onDeleteNote={vi.fn()} />
    );

    // Empty state exposes the New Note button
    fireEvent.click(screen.getAllByText('notes.newNote')[0]);
    fireEvent.change(screen.getByPlaceholderText('notes.titlePlaceholder'), {
      target: { value: 'Gift ideas' },
    });
    fireEvent.change(screen.getByPlaceholderText('notes.startWriting'), {
      target: { value: 'Lego set #family' },
    });
    fireEvent.click(screen.getByText('notes.saveNote'));

    expect(onSaveNote).toHaveBeenCalledWith({
      title: 'Gift ideas',
      body: 'Lego set #family',
      tags: ['family'],
    });
  });
});
