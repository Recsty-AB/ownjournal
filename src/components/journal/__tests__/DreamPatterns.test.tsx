import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JournalEntryData } from '../JournalEntry';
import { DREAM_PATTERNS_REPORT_CLEARED, type DreamPatternsReport, type DreamReflection } from '@/types/dream';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  requestDreamPatterns: vi.fn(),
  requestDreamReflection: vi.fn(),
  loadPatternsReport: vi.fn(),
  savePatternsReport: vi.fn(),
  isJournalLocked: vi.fn(() => false),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, from: vi.fn() },
}));
vi.mock('@/services/dreamService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/dreamService')>();
  return {
    ...actual,
    requestDreamPatterns: mocks.requestDreamPatterns,
    requestDreamReflection: mocks.requestDreamReflection,
    loadPatternsReport: mocks.loadPatternsReport,
    savePatternsReport: mocks.savePatternsReport,
    isJournalLocked: mocks.isJournalLocked,
    onJournalLockChange: () => () => {},
  };
});

import { DreamPatterns } from '../DreamPatterns';
import { resetDreamPatternsRequest } from '@/hooks/useDreamPatternsRequest';
import { setCurrentUserId } from '@/utils/userScope';
import { aiUsageLimits } from '@/services/aiUsageLimits';
import { setDreamConsent } from '@/services/dreamService';

const reflection: DreamReflection = {
  version: 1,
  createdAt: '2026-11-19T07:00:00.000Z',
  contentHash: 'h',
  summary: 'S',
  themes: [],
  images: [],
  wakingLinks: [],
  questions: [],
  coded: { characters: ['sister'], settings: ['school'], emotions: ['fear'], themes: ['searching'] },
  care: 'none',
};

const DAY = 24 * 60 * 60 * 1000;
const BODY = 'I was back at my old school and every corridor led to the sea.';

/** Dreams from the last days (inside the default 30-day period), newest last; `daysAgo` moves them all. */
const dreams = (reflected: number, unreflected = 0, daysAgo = 0): JournalEntryData[] =>
  Array.from({ length: reflected + unreflected }, (_, i) => {
    const date = new Date(Date.now() - (daysAgo + reflected + unreflected - i) * DAY);
    return {
      id: `d${i}`,
      date,
      title: `Dream ${i}`,
      body: BODY,
      tags: [],
      mood: 'okay' as const,
      createdAt: date,
      updatedAt: date,
      type: 'dream' as const,
      dream: { feelings: [] },
      ...(i < reflected ? { dreamReflection: reflection } : {}),
    };
  });

const REPORT: DreamPatternsReport = {
  version: 1,
  createdAt: '2026-11-19T08:00:00.000Z',
  dreamCount: 5,
  overview: 'Searching runs through your dreams.',
  recurring: [{ kind: 'setting', label: 'school', count: 5, note: 'Often where things happen.' }],
  changes: [],
  questions: ['What are you looking for?'],
};

const renderCard = (entries: JournalEntryData[], props: Partial<React.ComponentProps<typeof DreamPatterns>> = {}) =>
  render(
    <DreamPatterns
      entries={entries}
      isPro
      onSaveAsNote={vi.fn().mockResolvedValue(undefined)}
      onSaveReflection={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );

const openCard = () => fireEvent.click(screen.getByRole('button', { name: /dream.patterns.title/ }));

beforeEach(() => {
  localStorage.clear();
  setCurrentUserId(null);
  resetDreamPatternsRequest();
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.loadPatternsReport.mockResolvedValue(null);
  mocks.savePatternsReport.mockResolvedValue(undefined);
  mocks.isJournalLocked.mockReturnValue(false);
});

describe('DreamPatterns', () => {
  it('shows nothing about the dreams and loads no report while an encrypted journal is locked', () => {
    mocks.isJournalLocked.mockReturnValue(true);
    mocks.loadPatternsReport.mockResolvedValue(REPORT);

    const { container } = renderCard(dreams(6));

    expect(container).toBeEmptyDOMElement();
    expect(mocks.loadPatternsReport).not.toHaveBeenCalled();
  });

  it('stays hidden until the journal holds a dream', () => {
    const { container } = renderCard([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts the dreams in the period and needs five; older dreams and ones too short to reflect on do not count', () => {
    const tooShort = { ...dreams(0, 1)[0], id: 'short', body: 'Falling.' };
    renderCard([...dreams(2, 2), ...dreams(3, 0, 40), tooShort]);
    openCard();

    expect(screen.getByText(/dream.patterns.dreamsInPeriod/)).toBeInTheDocument();
    expect(screen.getByText(/dream.patterns.needMore/)).toBeInTheDocument();
    // The short dream is not silently missing from the count.
    expect(screen.getByText('dream.patterns.tooShort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dream.patterns.create/ })).toBeDisabled();
  });

  it('reflects on the dreams of the period that have none, saves each, then makes the report from all of them', async () => {
    setDreamConsent();
    const fresh = { ...reflection, coded: { ...reflection.coded, settings: ['sea'] } };
    mocks.requestDreamReflection.mockResolvedValue({ reflection: fresh, used: 3 });
    mocks.requestDreamPatterns.mockResolvedValue({ report: REPORT, used: 1 });
    const onSaveReflection = vi.fn().mockResolvedValue(undefined);
    renderCard(dreams(3, 2), { onSaveReflection });
    openCard();

    // Says what will happen before anything is spent.
    expect(screen.getByText('dream.patterns.reflectFirst')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dream.patterns.create/ }));

    expect(await screen.findByText('Searching runs through your dreams.')).toBeInTheDocument();
    expect(mocks.requestDreamReflection).toHaveBeenCalledTimes(2);
    expect(mocks.requestDreamReflection.mock.calls.map((c) => c[0].id)).toEqual(['d3', 'd4']);
    expect(onSaveReflection.mock.calls.map((c) => [c[0].id, c[1]])).toEqual([['d3', fresh], ['d4', fresh]]);
    const [sent, , , range] = mocks.requestDreamPatterns.mock.calls[0];
    expect(sent.map((d: JournalEntryData) => d.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
    expect(sent.every((d: JournalEntryData) => d.dreamReflection)).toBe(true);
    // The default period: the last 30 days (an hour more or less across a daylight-saving change).
    expect(Math.abs(range.end.getTime() - range.start.getTime() - 30 * DAY)).toBeLessThanOrEqual(3600_000);
    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(3);
  });

  it('shows which dream it is reflecting on while it runs', async () => {
    setDreamConsent();
    mocks.requestDreamReflection.mockReturnValue(new Promise(() => {}));
    renderCard(dreams(4, 2));
    openCard();

    fireEvent.click(screen.getByRole('button', { name: /dream.patterns.create/ }));

    expect(await screen.findByRole('button', { name: /dream.patterns.reflecting/ })).toBeDisabled();
    expect(mocks.requestDreamPatterns).not.toHaveBeenCalled();
  });

  it('leaves out a dream the AI could not reflect on, and stops when the monthly reflections run out', async () => {
    setDreamConsent();
    const { DreamRequestError } = await import('@/services/dreamService');
    mocks.requestDreamReflection
      .mockRejectedValueOnce(new DreamRequestError('blocked'))
      .mockResolvedValueOnce({ reflection, used: 1 });
    mocks.requestDreamPatterns.mockResolvedValue({ report: REPORT, used: 1 });
    const first = renderCard(dreams(5, 2));
    openCard();
    fireEvent.click(screen.getByRole('button', { name: /dream.patterns.create/ }));

    await screen.findByText('Searching runs through your dreams.');
    const sent = mocks.requestDreamPatterns.mock.calls[0][0] as JournalEntryData[];
    expect(sent.filter((d) => d.dreamReflection).map((d) => d.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd6']);
    first.unmount();
    resetDreamPatternsRequest();
    mocks.requestDreamPatterns.mockClear();

    mocks.requestDreamReflection.mockRejectedValue(new DreamRequestError('limitReached'));
    renderCard(dreams(5, 2));
    await act(async () => {});
    if (!screen.queryByRole('button', { name: /dream.patterns.create/ })) openCard();
    fireEvent.click(screen.getByRole('button', { name: /dream.patterns.create/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'dream.reflection.errors.limitReached' })),
    );
    expect(mocks.requestDreamPatterns).not.toHaveBeenCalled();
  });

  it('asks for a shorter period when more dreams need a reflection than are left this month', async () => {
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 29);
    const first = renderCard(dreams(4, 2));
    openCard();

    expect(screen.getByText('dream.patterns.notEnoughReflections')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dream.patterns.create/ })).toBeDisabled();
    first.unmount();

    // None left at all: said as such, not as "more than 0".
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 30);
    renderCard(dreams(4, 2));
    openCard();
    expect(screen.getByText('dream.patterns.noReflectionsLeft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dream.patterns.create/ })).toBeDisabled();
  });

  it('shows the period a report covers', async () => {
    mocks.loadPatternsReport.mockResolvedValue({ ...REPORT, periodStart: '2026-10-21', periodEnd: '2026-11-20' });
    renderCard(dreams(6));
    openCard();

    expect(await screen.findByText(/2026.*–.*2026/)).toBeInTheDocument();
  });

  it('opens with a one-time ready prompt at five reflected dreams, without calling the AI', async () => {
    renderCard(dreams(5));

    expect(await screen.findByText('dream.patterns.ready')).toBeInTheDocument();
    expect(mocks.requestDreamPatterns).not.toHaveBeenCalled();
  });

  it('shows the ready prompt only once', async () => {
    const { unmount } = renderCard(dreams(5));
    await screen.findByText('dream.patterns.ready');
    unmount();

    renderCard(dreams(5));
    await waitFor(() => expect(mocks.loadPatternsReport).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('dream.patterns.ready')).not.toBeInTheDocument();
  });

  it('asks for consent, then creates and keeps the report', async () => {
    mocks.requestDreamPatterns.mockResolvedValue({ report: REPORT, used: 1 });
    renderCard(dreams(5));

    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'dream.reflection.consent.accept' }));

    expect(await screen.findByText('Searching runs through your dreams.')).toBeInTheDocument();
    expect(screen.getByText('school')).toBeInTheDocument();
    expect(screen.getByText('dream.patterns.earlyThemes')).toBeInTheDocument();
    expect(mocks.savePatternsReport).toHaveBeenCalledWith(REPORT);
  });

  it('keeps a running request when the card is removed and shown again, and shows its report', async () => {
    setDreamConsent();
    let answer!: (value: { report: DreamPatternsReport; used: number }) => void;
    mocks.requestDreamPatterns.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const first = renderCard(dreams(6));
    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));

    // Switching to Notes or hiding the insights removes the card.
    first.unmount();
    renderCard(dreams(6));
    openCard();

    const button = await screen.findByRole('button', { name: /dream.patterns.creating/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.requestDreamPatterns).toHaveBeenCalledTimes(1);

    await act(async () => answer({ report: REPORT, used: 1 }));

    expect(await screen.findByText('Searching runs through your dreams.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dream.patterns.createNew/ })).toBeEnabled();
    expect(mocks.savePatternsReport).toHaveBeenCalledWith(REPORT);
  });

  it('forgets a report made in this session when all entries are deleted or the user signs out', async () => {
    setDreamConsent();
    mocks.requestDreamPatterns.mockResolvedValue({ report: REPORT, used: 1 });
    const first = renderCard(dreams(6));
    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));
    await screen.findByText('Searching runs through your dreams.');
    first.unmount();

    // Deleted while no card is on screen.
    act(() => { window.dispatchEvent(new CustomEvent(DREAM_PATTERNS_REPORT_CLEARED)); });
    const second = renderCard(dreams(6));
    await waitFor(() => expect(mocks.loadPatternsReport).toHaveBeenCalledTimes(2));
    openCard();
    expect(screen.queryByText('Searching runs through your dreams.')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));
    await screen.findByText('Searching runs through your dreams.');
    second.unmount();

    resetDreamPatternsRequest();
    renderCard(dreams(6));
    await waitFor(() => expect(mocks.loadPatternsReport).toHaveBeenCalledTimes(3));
    openCard();
    expect(screen.queryByText('Searching runs through your dreams.')).not.toBeInTheDocument();
  });

  it.each([
    ['nobody is signed in', null],
    ['another account has signed in', 'user-b'],
  ])('drops a report that arrives when %s', async (_name, nextUser) => {
    setCurrentUserId('user-a');
    setDreamConsent();
    let answer!: (value: { report: DreamPatternsReport; used: number }) => void;
    mocks.requestDreamPatterns.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const first = renderCard(dreams(6));
    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));

    // Sign-out: the card goes, the user changes, the request is still running.
    first.unmount();
    setCurrentUserId(nextUser);
    resetDreamPatternsRequest();
    await act(async () => answer({ report: REPORT, used: 2 }));

    // Not written to whichever storage is current now (unencrypted when signed out).
    expect(mocks.savePatternsReport).not.toHaveBeenCalled();
    expect(aiUsageLimits.getUsageStats().dreamPatterns.current).toBe(0);
    expect(mocks.toast).not.toHaveBeenCalled();

    // Nor shown to the account that is on screen now, or to the first one later.
    for (const user of [nextUser, 'user-a']) {
      setCurrentUserId(user);
      const card = renderCard(dreams(6));
      await act(async () => {});
      if (!screen.queryByRole('button', { name: /dream.patterns.create/ })) openCard();
      expect(await screen.findByRole('button', { name: /dream.patterns.create$/ })).toBeEnabled();
      expect(screen.queryByText('Searching runs through your dreams.')).not.toBeInTheDocument();
      card.unmount();
    }
  });

  it('never shows one account the report another one made in this session', async () => {
    setCurrentUserId('user-a');
    setDreamConsent();
    mocks.requestDreamPatterns.mockResolvedValue({ report: REPORT, used: 1 });
    const first = renderCard(dreams(6));
    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));
    await screen.findByText('Searching runs through your dreams.');
    first.unmount();

    // The account changes without the sign-out handler having run.
    setCurrentUserId('user-b');
    renderCard(dreams(6));
    await act(async () => {});
    if (!screen.queryByRole('button', { name: /dream.patterns.create/ })) openCard();

    expect(screen.queryByText('Searching runs through your dreams.')).not.toBeInTheDocument();
  });

  it('shows how the dreams compare with the journal, leaving out empty lists, and keeps it in the note', async () => {
    const withWaking: DreamPatternsReport = {
      ...REPORT,
      waking: {
        entryCount: 9,
        shared: [{ label: 'work', note: 'It shows up at night and in your entries.' }],
        dreamsOnly: [{ label: 'your sister', note: 'She is in five dreams and not among your journal topics.' }],
        wakingOnly: [],
      },
    };
    mocks.loadPatternsReport.mockResolvedValue(withWaking);
    const onSaveAsNote = vi.fn().mockResolvedValue(undefined);
    renderCard(dreams(6), { onSaveAsNote });
    openCard();

    expect(await screen.findByText('dream.patterns.waking.title')).toBeInTheDocument();
    expect(screen.getByText('dream.patterns.waking.basedOn')).toBeInTheDocument();
    expect(screen.getByText('dream.patterns.waking.shared')).toBeInTheDocument();
    expect(screen.getByText('your sister')).toBeInTheDocument();
    expect(screen.getByText('She is in five dreams and not among your journal topics.')).toBeInTheDocument();
    expect(screen.queryByText('dream.patterns.waking.wakingOnly')).not.toBeInTheDocument();
    expect(screen.queryByText('dream.patterns.waking.none')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dream.patterns.saveAsNote/ }));
    await waitFor(() => expect(onSaveAsNote).toHaveBeenCalledOnce());
    const body = onSaveAsNote.mock.calls[0][1];
    expect(body).toContain('## dream.patterns.waking.title');
    expect(body).toContain('### dream.patterns.waking.dreamsOnly');
    expect(body).toContain('- **your sister**');
    expect(body).not.toContain('dream.patterns.waking.wakingOnly');
  });

  it('says why there is no comparison when too few journal entries were analysed', async () => {
    mocks.loadPatternsReport.mockResolvedValue(REPORT);
    renderCard(dreams(6));
    openCard();

    expect(await screen.findByText('dream.patterns.waking.none')).toBeInTheDocument();
    expect(screen.queryByText('dream.patterns.waking.title')).not.toBeInTheDocument();
  });

  it('shows neither a comparison nor a reason when one was made and nothing stood out', async () => {
    mocks.loadPatternsReport.mockResolvedValue({ ...REPORT, waking: { entryCount: 9, shared: [], dreamsOnly: [], wakingOnly: [] } });
    renderCard(dreams(6));
    openCard();

    await screen.findByText('Searching runs through your dreams.');
    expect(screen.queryByText('dream.patterns.waking.title')).not.toBeInTheDocument();
    expect(screen.queryByText('dream.patterns.waking.none')).not.toBeInTheDocument();
  });

  it('says requests are paused for the month when the failed-request cap is reached', async () => {
    setDreamConsent();
    const { DreamRequestError } = await import('@/services/dreamService');
    mocks.requestDreamPatterns.mockRejectedValue(new DreamRequestError('failedLimitReached'));
    renderCard(dreams(6));

    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'dream.patterns.errors.failedLimitReached' }),
      ),
    );
  });

  it('drops the saved report from the screen when all entries are deleted', async () => {
    mocks.loadPatternsReport.mockResolvedValue(REPORT);
    renderCard(dreams(6));
    openCard();
    expect(await screen.findByText('Searching runs through your dreams.')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(DREAM_PATTERNS_REPORT_CLEARED));
    });

    expect(screen.queryByText('Searching runs through your dreams.')).not.toBeInTheDocument();
  });

  it('explains the monthly limit', async () => {
    setDreamConsent();
    const { DreamRequestError } = await import('@/services/dreamService');
    mocks.requestDreamPatterns.mockRejectedValue(new DreamRequestError('limitReached'));
    renderCard(dreams(6));

    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.create/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'dream.patterns.errors.limitReached' })),
    );
  });

  it('saves the report as a note', async () => {
    mocks.loadPatternsReport.mockResolvedValue(REPORT);
    const onSaveAsNote = vi.fn().mockResolvedValue(undefined);
    renderCard(dreams(6), { onSaveAsNote });
    openCard();

    fireEvent.click(await screen.findByRole('button', { name: /dream.patterns.saveAsNote/ }));

    await waitFor(() => expect(onSaveAsNote).toHaveBeenCalledOnce());
    const [title, body] = onSaveAsNote.mock.calls[0];
    expect(title).toBe('dream.patterns.noteTitle');
    expect(body).toContain('Searching runs through your dreams.');
    expect(body).toContain('**school**');
  });

  it('lets free users see a locked create button but not use it', async () => {
    renderCard(dreams(5), { isPro: false });
    openCard();

    expect(await screen.findByRole('button', { name: /dream.patterns.create/ })).toBeDisabled();
    expect(screen.getByText('dream.patterns.plusOnly')).toBeInTheDocument();
  });
});
