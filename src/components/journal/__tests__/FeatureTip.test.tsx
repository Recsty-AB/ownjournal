/**
 * The one-time tip about dreams and voice entry, shown in the timeline of a
 * journal that already has entries.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Timeline } from '../Timeline';
import type { JournalEntryData } from '../JournalEntry';
import { TooltipProvider } from '@/components/ui/tooltip';
import { hasSeenFeatureTip, setFeatureTipSeen } from '@/utils/featureTip';
import { setCurrentUserId } from '@/utils/userScope';

const locked = vi.hoisted(() => ({ value: false }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), getSession: vi.fn() }, from: vi.fn() },
}));
vi.mock('@/services/dreamService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/dreamService')>()),
  isJournalLocked: () => locked.value,
}));

const created = new Date('2026-06-01T08:00:00Z');

const entry = (id: string, createdAt: Date = created): JournalEntryData => ({
  id, date: createdAt, title: `Entry ${id}`, body: 'Body', tags: [], mood: 'good', createdAt, updatedAt: createdAt,
});

const renderTimeline = (entries: JournalEntryData[], props: Partial<React.ComponentProps<typeof Timeline>> = {}) =>
  render(
    <TooltipProvider>
      <Timeline entries={entries} onSaveEntry={vi.fn()} onDeleteEntry={vi.fn()} {...props} />
    </TooltipProvider>,
  );

const tip = () => screen.queryByRole('region', { name: 'featureTip.title' });

// jsdom cannot scroll; the timeline scrolls to a new entry when one opens.
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();

beforeEach(() => {
  localStorage.clear();
  setCurrentUserId('user-a');
  locked.value = false;
});

describe('feature tip for dreams and voice entry', () => {
  it('tells a journal that already has entries what is free and what is Plus', () => {
    renderTimeline([entry('old')]);

    const rows = within(tip()!).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    // Marking dreams is free; reflection (with the report) and voice entry are Plus.
    expect(within(rows[0]).getByText('featureTip.dreamJournal.name')).toBeInTheDocument();
    expect(within(rows[0]).getByText('featureTip.free')).toBeInTheDocument();
    expect(within(rows[1]).getByText('dream.reflection.title')).toBeInTheDocument();
    expect(within(rows[1]).getByText('help.sections.proBadge')).toBeInTheDocument();
    expect(within(rows[2]).getByText('voice.title')).toBeInTheDocument();
    expect(within(rows[2]).getByText('help.sections.proBadge')).toBeInTheDocument();
    // Informational only: no purchase action, also for free users.
    expect(within(tip()!).queryByRole('link')).not.toBeInTheDocument();
    expect(within(tip()!).getAllByRole('button')).toHaveLength(2);
  });

  it('is not shown in an empty journal, in the demo, or after the tour marked it as seen', () => {
    const empty = renderTimeline([]);
    expect(tip()).not.toBeInTheDocument();
    empty.unmount();

    const demo = renderTimeline([entry('old')], { isDemo: true });
    expect(tip()).not.toBeInTheDocument();
    demo.unmount();

    // Finishing the tour, which covers the dream journal, marks the tip as seen.
    setFeatureTipSeen();
    renderTimeline([entry('old')]);
    expect(tip()).not.toBeInTheDocument();
  });

  it('goes away for good once dismissed, for this account only', () => {
    const first = renderTimeline([entry('old')]);
    fireEvent.click(within(tip()!).getByRole('button', { name: 'featureTip.dismiss' }));

    expect(tip()).not.toBeInTheDocument();
    expect(hasSeenFeatureTip()).toBe(true);
    first.unmount();

    const again = renderTimeline([entry('old')]);
    expect(tip()).not.toBeInTheDocument();
    again.unmount();

    setCurrentUserId('user-b');
    renderTimeline([entry('old')]);
    expect(tip()).toBeInTheDocument();
  });

  it('opens a new entry already marked as a dream, shows the guide once, and does not come back', () => {
    const onEditingChange = vi.fn();
    renderTimeline([entry('old')], { onEditingChange });

    fireEvent.click(within(tip()!).getByRole('button', { name: /featureTip.writeDream/ }));

    expect(tip()).not.toBeInTheDocument();
    expect(hasSeenFeatureTip()).toBe(true);
    expect(onEditingChange).toHaveBeenCalledWith(true);
    // The guide dialog is open on top, so the editor behind it is hidden from the accessibility tree.
    expect(screen.getByRole('button', { name: /dream.toggle/, hidden: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('dream.guide.title')).toBeInTheDocument();
  });

  it('opens an ordinary entry from the usual New entry button', () => {
    renderTimeline([entry('old')]);
    fireEvent.click(within(tip()!).getByRole('button', { name: 'featureTip.dismiss' }));

    fireEvent.click(screen.getAllByRole('button', { name: /timeline.newEntry/ })[0]);

    expect(screen.getByRole('button', { name: /dream.toggle/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('waits while an encrypted journal is locked or an entry is being written', () => {
    locked.value = true;
    const first = renderTimeline([entry('old')]);
    expect(tip()).not.toBeInTheDocument();
    first.unmount();

    locked.value = false;
    renderTimeline([entry('old')]);
    expect(tip()).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /timeline.newEntry/ })[0]);
    expect(tip()).not.toBeInTheDocument();
    // Not dismissed: it is back after the entry form closes.
    expect(hasSeenFeatureTip()).toBe(false);
  });
});
