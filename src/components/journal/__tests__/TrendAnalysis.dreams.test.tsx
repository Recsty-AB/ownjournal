import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { JournalEntryData } from '../JournalEntry';
import type { DreamReflection } from '@/types/dream';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  invoke: vi.fn(),
  reflectMissingDreams: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/utils/edgeFunctionRetry', () => ({ invokeWithRetry: mocks.invoke }));
vi.mock('@/services/reflectMissingDreams', () => ({ reflectMissingDreams: mocks.reflectMissingDreams }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
    },
    from: vi.fn(),
  },
}));
vi.mock('@/services/entryAnalysisService', () => ({
  loadEntryAnalyses: async (list: JournalEntryData[]) =>
    list.map((entry) => ({
      entry,
      metadata: {
        sentimentScore: 0.1, dominantEmotion: 'calm', emotions: ['calm'], topics: ['work'],
        timeOfDay: 'morning', lengthCategory: 'short',
      },
    })),
  needsEntryAnalysis: () => false,
  isFailedEntryAnalysis: () => false,
  analyzeMissingEntries: vi.fn(),
}));
vi.mock('@/services/aiCacheService', () => ({
  aiCacheService: {
    getCached: vi.fn().mockResolvedValue(null),
    setCached: vi.fn().mockResolvedValue(undefined),
    getTrendCacheKey: vi.fn().mockResolvedValue('test-cache-key'),
  },
}));
vi.mock('@/services/cloudStorageService', () => ({
  cloudStorageService: {
    getConnectedProviderNames: vi.fn(() => []),
    downloadFromPrimary: vi.fn(() => Promise.resolve(null)),
    uploadToAll: vi.fn(() => Promise.resolve()),
  },
}));

import { TrendAnalysis } from '../TrendAnalysis';
import { setDreamConsent } from '@/services/dreamService';
import { setCurrentUserId } from '@/utils/userScope';

const HOUR = 60 * 60 * 1000;
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

const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * HOUR);

const journal: JournalEntryData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `j${i}`, date: at(i + 1), title: `Day ${i}`, body: 'An ordinary day.', tags: [], mood: 'okay' as const,
  createdAt: at(i + 1), updatedAt: at(i + 1),
}));

const dreams = (reflected: number, unreflected = 0): JournalEntryData[] =>
  Array.from({ length: reflected + unreflected }, (_, i) => ({
    id: `d${i}`, date: at(i + 2), title: `Dream ${i}`,
    body: 'Secret dream: I was back at my old school and every corridor led to the sea.',
    tags: [], mood: 'okay' as const, createdAt: at(i + 2), updatedAt: at(i + 2), type: 'dream' as const,
    dream: { feelings: [], ...(i === 0 ? { nightmare: true } : {}) },
    ...(i < reflected ? { dreamReflection: reflection } : {}),
  }));

const TREND = {
  periodSummary: 'A calm month.',
  moodTrend: 'Steady.',
  insights: ['Work keeps you busy.'],
  focusAreas: ['Rest'],
  closingReflection: 'You kept going.',
};

const renderCard = (dreamList: JournalEntryData[]) =>
  render(
    <TrendAnalysis entries={journal} isPro dreams={dreamList} onSaveReflection={vi.fn().mockResolvedValue(undefined)} />,
  );

const analyze = () => fireEvent.click(screen.getByRole('button', { name: /trendAnalysis.analyzePeriod/ }));

beforeEach(() => {
  localStorage.clear();
  setCurrentUserId(null);
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.invoke.mockResolvedValue({ data: { ...TREND, dreamInsights: ['The chase dreams came in a busy week.'], dreamCount: 3 }, error: null });
  mocks.reflectMissingDreams.mockImplementation(async (list: JournalEntryData[]) => ({
    dreams: list.map((d) => ({ ...d, dreamReflection: d.dreamReflection ?? reflection })),
  }));
});

describe('TrendAnalysis with dreams', () => {
  it('shows no dream switch while the journal holds no dream', () => {
    renderCard([]);
    expect(screen.queryByRole('switch', { name: 'trendAnalysis.dreams.include' })).not.toBeInTheDocument();
  });

  it('includes the dreams of the period by default and says how many, and which get a reflection first', () => {
    renderCard(dreams(2, 1));

    expect(screen.getByRole('switch', { name: 'trendAnalysis.dreams.include' })).toBeChecked();
    expect(screen.getByText(/trendAnalysis.dreams.included/)).toBeInTheDocument();
    expect(screen.getByText(/trendAnalysis.dreams.reflectFirst/)).toBeInTheDocument();
    expect(screen.queryByText(/trendAnalysis.dreams.leftOut/)).not.toBeInTheDocument();
  });

  it('says when too few dreams can be included', () => {
    renderCard(dreams(2));
    expect(screen.getByText('trendAnalysis.dreams.tooFew')).toBeInTheDocument();
  });

  it('reflects on the dreams that need it, then sends dates and labels only, and shows what it found', async () => {
    setDreamConsent();
    renderCard(dreams(2, 1));

    analyze();

    expect(await screen.findByText('The chase dreams came in a busy week.')).toBeInTheDocument();
    expect(screen.getByText('trendAnalysis.dreams.title')).toBeInTheDocument();
    const [list, , options] = mocks.reflectMissingDreams.mock.calls[0];
    expect(list.map((d: JournalEntryData) => d.id).sort()).toEqual(['d0', 'd1', 'd2']);
    expect(options.max).toBe(30);
    const body = mocks.invoke.mock.calls[0][2].body;
    expect(body.dreams).toHaveLength(3);
    expect(body.dreams).toContainEqual({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), coded: reflection.coded, nightmare: true });
    expect(JSON.stringify(body)).not.toContain('Secret dream');
    // Each entry carries its day so the dreams can be set beside it.
    expect(body.entryMetadata[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('asks for the dream consent before sending any dream', async () => {
    renderCard(dreams(3));

    analyze();

    expect(await screen.findByText('dream.reflection.consent.title')).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.reflectMissingDreams).not.toHaveBeenCalled();
  });

  it('runs without dreams when too few could get a reflection, and says so', async () => {
    setDreamConsent();
    mocks.reflectMissingDreams.mockImplementation(async (list: JournalEntryData[]) => ({ dreams: list, stoppedBy: 'limitReached' }));
    mocks.invoke.mockResolvedValue({ data: { ...TREND, dreamInsights: ['Invented.'] }, error: null });
    renderCard(dreams(1, 2));

    analyze();

    expect(await screen.findByText('A calm month.')).toBeInTheDocument();
    expect(mocks.invoke.mock.calls[0][2].body).not.toHaveProperty('dreams');
    expect(screen.queryByText('Invented.')).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'trendAnalysis.dreams.notIncluded' }));
  });

  it('with the switch off, sends nothing about the dreams and remembers the choice', async () => {
    setDreamConsent();
    const first = renderCard(dreams(3));

    fireEvent.click(screen.getByRole('switch', { name: 'trendAnalysis.dreams.include' }));
    expect(screen.queryByText(/trendAnalysis.dreams.included/)).not.toBeInTheDocument();
    analyze();

    await screen.findByText('A calm month.');
    expect(mocks.reflectMissingDreams).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.calls[0][2].body).not.toHaveProperty('dreams');
    first.unmount();

    renderCard(dreams(3));
    await act(async () => {});
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'trendAnalysis.dreams.include' })).not.toBeChecked(),
    );
  });
});
