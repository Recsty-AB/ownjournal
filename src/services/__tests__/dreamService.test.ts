import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntryData } from '@/components/journal/JournalEntry';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  getMetadata: vi.fn(),
  getAllMetadata: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock('@/utils/edgeFunctionRetry', () => ({ invokeWithRetry: mocks.invoke }));
vi.mock('@/services/aiMetadataService', () => ({ aiMetadataService: { getMetadata: mocks.getMetadata, getAllMetadata: mocks.getAllMetadata } }));
vi.mock('@/utils/pwa', () => ({ getFromIndexedDB: vi.fn(), saveToIndexedDB: vi.fn() }));

import {
  DreamRequestError,
  buildWakingContext,
  buildWakingSummary,
  dreamChangedSinceReflection,
  dreamsForPatterns,
  requestDreamPatterns,
  requestDreamReflection,
} from '../dreamService';
import { hashDreamInput, sanitizeDreamDetails, sanitizeDreamFields, sanitizeDreamPatternsReport } from '@/types/dream';

const DREAM = 'I was swimming in a library where the books turned into fish whenever I opened them.';

const entry = (id: string, date: string, overrides: Partial<JournalEntryData> = {}): JournalEntryData => ({
  id,
  date: new Date(date),
  title: id,
  body: `Private journal text of ${id}`,
  tags: [],
  mood: 'good',
  createdAt: new Date(date),
  updatedAt: new Date(date),
  ...overrides,
});

const dream = entry('dream', '2026-11-19T06:00:00', { type: 'dream', body: DREAM, dream: { feelings: ['awe'], lucid: true } });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  mocks.getMetadata.mockImplementation(async (id: string) => ({
    shortSummary: `Summary of ${id}`,
    topics: ['work', 'family'],
    dominantEmotion: 'tired',
    mainStressors: ['deadline'],
  }));
  mocks.getAllMetadata.mockResolvedValue({});
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('buildWakingContext', () => {
  it('uses summaries of the previous week, newest first, skipping dreams, notes and other days', async () => {
    const entries = [
      dream,
      entry('yesterday', '2026-11-18T20:00:00'),
      entry('sameDay', '2026-11-19T21:00:00'),
      entry('lastWeek', '2026-11-13T10:00:00'),
      entry('tooOld', '2026-11-11T10:00:00'),
      entry('future', '2026-11-20T10:00:00'),
      entry('otherDream', '2026-11-18T05:00:00', { type: 'dream' }),
      entry('note', '2026-11-18T05:00:00', { type: 'note' }),
    ];

    const context = await buildWakingContext(dream, entries);

    expect(context.map((c) => c.shortSummary)).toEqual([
      'Summary of sameDay',
      'Summary of yesterday',
      'Summary of lastWeek',
    ]);
  });

  it('caps the context at seven entries and skips entries without analysis', async () => {
    mocks.getMetadata.mockImplementation(async (id: string) => (id === 'e0' ? null : { shortSummary: id, topics: [] }));
    const entries = Array.from({ length: 10 }, (_, i) => entry(`e${i}`, `2026-11-${String(19 - (i % 6)).padStart(2, '0')}T08:00:00`));

    const context = await buildWakingContext(dream, entries);

    expect(context).toHaveLength(7);
    expect(context.some((c) => c.shortSummary === 'e0')).toBe(false);
  });
});

describe('requestDreamReflection', () => {
  it('sends the dream, its details and summaries only, never other entries’ text', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reflection: { summary: 'Books and fish.', themes: [], images: [], wakingLinks: [], questions: ['Q?'], coded: {}, care: 'none' },
        used: 4,
      },
      error: null,
    });

    const result = await requestDreamReflection(dream, [dream, entry('yesterday', '2026-11-18T20:00:00')], 'fi');

    const body = mocks.invoke.mock.calls[0][2].body;
    expect(body).toMatchObject({
      type: 'analyzeDream',
      language: 'fi',
      content: DREAM,
      dream: { feelings: ['awe'], lucid: true },
      // The dream's calendar day only, never the time of day.
      date: '2026-11-19',
    });
    // Exactly what the consent text lists for each analysed entry.
    expect(body.wakingContext[0]).toEqual({
      date: '2026-11-18',
      shortSummary: 'Summary of yesterday',
      topics: ['work', 'family'],
      dominantEmotion: 'tired',
    });
    expect(Object.keys(body).sort()).toEqual(['content', 'date', 'dream', 'language', 'type', 'wakingContext']);
    expect(JSON.stringify(body)).not.toContain('Private journal text');
    expect(result.used).toBe(4);
    expect(result.reflection).toMatchObject({ version: 1, summary: 'Books and fish.', contentHash: hashDreamInput(DREAM, { feelings: ['awe'], lucid: true }) });
  });

  it('sends the dreamer\'s own thoughts with the dream and counts them as an edit', async () => {
    mocks.invoke.mockResolvedValue({
      data: { reflection: { summary: 'Books and fish.', themes: [], images: [], wakingLinks: [], questions: ['q'], coded: {}, care: 'none' }, used: 5 },
      error: null,
    });
    const withThoughts = { ...dream, dream: { feelings: ['awe' as const], lucid: true, thoughts: 'The library is my grandfather\'s study.' } };

    const result = await requestDreamReflection(withThoughts, [withThoughts], 'en');

    expect(mocks.invoke.mock.calls[0][2].body.dream.thoughts).toBe('The library is my grandfather\'s study.');
    // The reflection remembers the thoughts it was made from...
    expect(dreamChangedSinceReflection({ ...withThoughts, dreamReflection: result.reflection })).toBe(false);
    // ...so new or changed thoughts make "Reflect again" available, and removing them too.
    expect(dreamChangedSinceReflection({ ...withThoughts, dream: { ...withThoughts.dream, thoughts: 'Or my school.' }, dreamReflection: result.reflection })).toBe(true);
    expect(dreamChangedSinceReflection({ ...dream, dreamReflection: result.reflection })).toBe(true);
  });

  it('sends the questions of the reflection on screen with the thoughts that answer them, and keeps what they changed', async () => {
    mocks.invoke.mockResolvedValue({
      data: { reflection: { summary: 'S', fromThoughts: ' Your "no" sets the sea aside. ', themes: [], images: [], wakingLinks: [], questions: ['q'], coded: {}, care: 'none' }, used: 6 },
      error: null,
    });
    const earlier = {
      version: 1 as const, createdAt: '2026-11-19T07:00:00.000Z', contentHash: 'x', summary: 'S',
      themes: [], images: [{ image: 'Sea', possibilities: 'p' }],
      wakingLinks: [], questions: ['First?', 'Second?'], coded: { characters: [], settings: [], emotions: [], themes: [] }, care: 'none' as const,
    };

    const withThoughts = { ...dream, dream: { feelings: ['awe' as const], thoughts: '1. Maybe\n2. No' }, dreamReflection: earlier };
    const result = await requestDreamReflection(withThoughts, [withThoughts], 'en');

    expect(mocks.invoke.mock.calls[0][2].body.earlierQuestions).toEqual(['First?', 'Second?']);
    expect(result.reflection.fromThoughts).toBe('Your "no" sets the sea aside.');

    // Without thoughts there is nothing the questions would explain.
    mocks.invoke.mockClear();
    await requestDreamReflection({ ...dream, dreamReflection: earlier }, [], 'en');
    expect(mocks.invoke.mock.calls[0][2].body).not.toHaveProperty('earlierQuestions');
  });

  it('keeps the fingerprint of a dream without thoughts unchanged', () => {
    expect(hashDreamInput('abc', { feelings: ['fear'] })).toBe(hashDreamInput('abc', { feelings: ['fear'], thoughts: '   ' }));
    expect(hashDreamInput('abc', { feelings: ['fear'] })).not.toBe(hashDreamInput('abc', { feelings: ['fear'], thoughts: 'x' }));
  });

  it('trims and caps stored thoughts', () => {
    expect(sanitizeDreamDetails({ feelings: [], thoughts: '  mine  ' })).toEqual({ feelings: [], thoughts: 'mine' });
    expect(sanitizeDreamDetails({ feelings: [], thoughts: '   ' })).toEqual({ feelings: [] });
    expect(sanitizeDreamDetails({ feelings: [], thoughts: 42 })).toEqual({ feelings: [] });
    expect(sanitizeDreamDetails({ feelings: [], thoughts: 'x'.repeat(5000) })!.thoughts).toHaveLength(2000);
  });

  it('refuses too long dreams before sending', async () => {
    await expect(
      requestDreamReflection({ ...dream, body: Array(1501).fill('fish').join(' ') }, [], 'en'),
    ).rejects.toMatchObject({ code: 'tooLong' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('caps dreams written without spaces by characters', async () => {
    await expect(requestDreamReflection({ ...dream, body: '梦'.repeat(8001) }, [], 'zh')).rejects.toMatchObject({ code: 'tooLong' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('reports offline without sending', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await expect(requestDreamReflection(dream, [], 'en')).rejects.toMatchObject({ code: 'offline' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each([
    [401, {}, 'authRequired'],
    [403, {}, 'plusRequired'],
    [429, { limitReached: true }, 'limitReached'],
    [429, { failedLimitReached: true }, 'failedLimitReached'],
    [422, { blocked: true }, 'blocked'],
    [429, {}, 'failed'],
    [400, { tooLong: true }, 'tooLong'],
    [503, {}, 'failed'],
  ])('maps HTTP %s %j to %s', async (status, body, code) => {
    mocks.invoke.mockResolvedValue({ data: null, error: { context: { status, json: async () => body } } });
    const error = await requestDreamReflection(dream, [], 'en').catch((e) => e);
    expect(error).toBeInstanceOf(DreamRequestError);
    expect(error.code).toBe(code);
  });
});

describe('Dream patterns helpers', () => {
  const reflection = { version: 1 as const, createdAt: 'x', contentHash: hashDreamInput('abc', { feelings: ['fear'] }), summary: 's', themes: [], images: [], wakingLinks: [], questions: [], coded: { characters: ['cat'], settings: [], emotions: [], themes: [] }, care: 'none' as const };

  const PERIOD = { start: new Date('2026-11-01T00:00:00'), end: new Date('2026-11-30T23:59:59') };

  it('takes the dreams of the period that have a reflection or can get one, oldest first, at most 40', () => {
    const list = [
      entry('b', '2026-11-10', { type: 'dream', dreamReflection: reflection }),
      entry('a', '2026-11-02', { type: 'dream', body: DREAM, dream: { feelings: [] } }),
      entry('short', '2026-11-05', { type: 'dream', body: 'Falling.', dream: { feelings: [] } }),
      // From the startup list of a locked journal: no details, cannot be reflected on.
      entry('locked', '2026-11-06', { type: 'dream' }),
      entry('before', '2026-10-31', { type: 'dream', dreamReflection: reflection }),
      entry('journal', '2026-11-07'),
    ];
    expect(dreamsForPatterns(list, PERIOD.start, PERIOD.end).map((e) => e.id)).toEqual(['a', 'b']);

    const many = Array.from({ length: 45 }, (_, i) =>
      entry(`m${i}`, new Date(Date.UTC(2026, 10, 1, 12) + i * 3600_000).toISOString(), { type: 'dream', dreamReflection: reflection }));
    const taken = dreamsForPatterns(many, PERIOD.start, PERIOD.end);
    expect(taken).toHaveLength(40);
    expect(taken[0].id).toBe('m5');
  });

  it('sends coded labels only, not dream text', async () => {
    mocks.invoke.mockResolvedValue({ data: { report: { overview: 'o', recurring: [], changes: [], wakingLinks: [], questions: [], dreamCount: 5 }, used: 1 }, error: null });
    const list = Array.from({ length: 5 }, (_, i) => entry(`d${i}`, `2026-11-0${i + 1}`, { type: 'dream', body: `Secret dream ${i}`, dreamReflection: reflection }));

    const { report } = await requestDreamPatterns(list, list, 'en', PERIOD);

    const body = mocks.invoke.mock.calls[0][2].body;
    expect(report).toMatchObject({ periodStart: '2026-11-01', periodEnd: '2026-11-30' });
    expect(body.type).toBe('analyzeDreamPatterns');
    expect(body.dreams).toHaveLength(5);
    expect(body.dreams[0]).toEqual({ coded: reflection.coded });
    // No analysed journal entries in the period: nothing about the journal is sent.
    expect(Object.keys(body).sort()).toEqual(['dreams', 'language', 'type']);
    expect(JSON.stringify(body)).not.toContain('Secret dream');
  });

  it('adds topics and feelings of the analysed entries of the same period, never their text or the dreamer\'s thoughts', async () => {
    mocks.invoke.mockResolvedValue({ data: { report: { overview: 'o', recurring: [], changes: [], questions: [], dreamCount: 5 }, used: 1 }, error: null });
    const dreams = Array.from({ length: 5 }, (_, i) =>
      entry(`d${i}`, `2026-11-1${i}T06:00:00`, {
        type: 'dream', body: `Secret dream ${i}`, dream: { feelings: [], thoughts: 'Secret thoughts' }, dreamReflection: reflection,
      }));
    const journal = ['2026-11-04T09:00:00', '2026-11-10T09:00:00', '2026-11-14T23:00:00'].map((date, i) => entry(`j${i}`, date));
    mocks.getAllMetadata.mockResolvedValue({
      j0: { topics: ['Work', 'family'], dominantEmotion: 'Tired', shortSummary: 'Secret summary', mainStressors: ['deadline'] },
      j1: { topics: ['work', ' work '], dominantEmotion: 'tired', shortSummary: 'Secret summary' },
      j2: { topics: ['running'], dominantEmotion: 'calm', shortSummary: 'Secret summary' },
    });

    await requestDreamPatterns(dreams, [...dreams, ...journal], 'en', PERIOD);

    const body = mocks.invoke.mock.calls[0][2].body;
    expect(Object.keys(body).sort()).toEqual(['dreams', 'language', 'type', 'waking']);
    expect(body.waking).toEqual({
      entryCount: 3,
      // Counted once per entry, whatever the spelling.
      topics: [{ label: 'work', count: 2 }, { label: 'family', count: 1 }, { label: 'running', count: 1 }],
      emotions: [{ label: 'tired', count: 2 }, { label: 'calm', count: 1 }],
    });
    expect(JSON.stringify(body)).not.toMatch(/Secret|Private journal text|deadline/);
  });

  it('needs five dreams with a reflection', async () => {
    const four = Array.from({ length: 4 }, (_, i) => entry(`d${i}`, `2026-11-0${i + 1}`, { type: 'dream', dreamReflection: reflection }));
    const unreflected = entry('u', '2026-11-09', { type: 'dream', body: DREAM, dream: { feelings: [] } });
    await expect(requestDreamPatterns([...four, unreflected], [], 'en', PERIOD)).rejects.toMatchObject({ code: 'notEnoughDreams' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('detects edits since the last reflection', () => {
    const fear = { feelings: ['fear' as const] };
    expect(dreamChangedSinceReflection({ body: 'abc', dream: fear, dreamReflection: reflection })).toBe(false);
    expect(dreamChangedSinceReflection({ body: ' abc\n', dream: fear, dreamReflection: reflection })).toBe(false);
    expect(dreamChangedSinceReflection({ body: 'abcd', dream: fear, dreamReflection: reflection })).toBe(true);
    // Same length, different text: a swapped word must count as an edit.
    expect(dreamChangedSinceReflection({ body: 'abd', dream: fear, dreamReflection: reflection })).toBe(true);
    expect(dreamChangedSinceReflection({ body: 'abc', dream: fear })).toBe(true);
  });

  it('counts a change of feelings or flags as an edit, but not their order', () => {
    const two = { version: 1 as const, createdAt: 'x', contentHash: hashDreamInput('abc', { feelings: ['fear', 'awe'] }), summary: 's', themes: [], images: [], wakingLinks: [], questions: [], coded: { characters: [], settings: [], emotions: [], themes: [] }, care: 'none' as const };
    expect(dreamChangedSinceReflection({ body: 'abc', dream: { feelings: ['awe', 'fear'] }, dreamReflection: two })).toBe(false);
    expect(dreamChangedSinceReflection({ body: 'abc', dream: { feelings: ['fear'] }, dreamReflection: two })).toBe(true);
    expect(dreamChangedSinceReflection({ body: 'abc', dream: { feelings: ['fear', 'awe'], nightmare: true }, dreamReflection: two })).toBe(true);
    expect(dreamChangedSinceReflection({ body: 'abc', dream: { feelings: ['fear', 'awe'], recurring: true }, dreamReflection: two })).toBe(true);
    expect(dreamChangedSinceReflection({ body: 'abc', dream: { feelings: ['fear', 'awe'], lucid: true }, dreamReflection: two })).toBe(true);
  });
});

describe('buildWakingSummary', () => {
  const analysed = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { topics: [id], dominantEmotion: 'calm' }]));
  const dreams = [
    entry('first', '2026-11-10T06:00:00', { type: 'dream' }),
    entry('last', '2026-11-20T06:00:00', { type: 'dream' }),
  ];

  it('covers the week before the first dream up to the day of the last, ordinary analysed entries only', async () => {
    const entries = [
      ...dreams,
      entry('weekBefore', '2026-11-03T08:00:00'),
      entry('between', '2026-11-15T08:00:00'),
      entry('lastDay', '2026-11-20T23:30:00'),
      entry('tooEarly', '2026-11-02T23:00:00'),
      entry('after', '2026-11-21T00:30:00'),
      entry('notAnalysed', '2026-11-12T08:00:00'),
      entry('aNote', '2026-11-12T08:00:00', { type: 'note' }),
      entry('otherDream', '2026-11-12T08:00:00', { type: 'dream' }),
    ];
    mocks.getAllMetadata.mockResolvedValue(analysed(['weekBefore', 'between', 'lastDay', 'tooEarly', 'after', 'aNote', 'otherDream']));

    const summary = await buildWakingSummary(dreams, entries);

    expect(summary!.entryCount).toBe(3);
    expect(summary!.topics.map((t) => t.label).sort()).toEqual(['between', 'lastday', 'weekbefore']);
  });

  it('makes no comparison with fewer than three analysed entries', async () => {
    const entries = [...dreams, entry('a', '2026-11-12'), entry('b', '2026-11-13'), entry('c', '2026-11-14')];
    mocks.getAllMetadata.mockResolvedValue(analysed(['a', 'b']));

    expect(await buildWakingSummary(dreams, entries)).toBeNull();
    expect(await buildWakingSummary([], entries)).toBeNull();
  });

  it('keeps the twelve most frequent topics and six feelings', async () => {
    const entries = [...dreams, ...Array.from({ length: 20 }, (_, i) => entry(`e${i}`, '2026-11-12T08:00:00'))];
    mocks.getAllMetadata.mockResolvedValue(Object.fromEntries(
      entries.map((e, i) => [e.id, { topics: [`topic${i}`, 'common'], dominantEmotion: `feeling${i % 9}` }]),
    ));

    const summary = await buildWakingSummary(dreams, entries);

    expect(summary!.topics).toHaveLength(12);
    expect(summary!.topics[0]).toEqual({ label: 'common', count: 20 });
    expect(summary!.emotions).toHaveLength(6);
  });

  it('still lets the report be made when the analysis store cannot be read', async () => {
    mocks.getAllMetadata.mockRejectedValue(new Error('blocked'));
    const entries = [...dreams, entry('a', '2026-11-12'), entry('b', '2026-11-13'), entry('c', '2026-11-14')];

    expect(await buildWakingSummary(dreams, entries)).toBeNull();
  });
});

describe('sanitizeDreamPatternsReport', () => {
  const base = { overview: 'o', createdAt: '2026-11-19T08:00:00.000Z', dreamCount: 5, recurring: [], changes: [], questions: [] };

  it('keeps a well-formed comparison and drops malformed lines', () => {
    const report = sanitizeDreamPatternsReport({
      ...base,
      waking: { entryCount: 9, shared: [{ label: 'work', note: 'In both.' }, { label: 'x' }, null], dreamsOnly: 'no', wakingOnly: [] },
    });

    expect(report!.waking).toEqual({ entryCount: 9, shared: [{ label: 'work', note: 'In both.' }], dreamsOnly: [], wakingOnly: [] });
  });

  it('has no comparison when none was made', () => {
    expect(sanitizeDreamPatternsReport(base)).not.toHaveProperty('waking');
  });
});

describe('sanitizeDreamFields (imported backups)', () => {
  it('fills in malformed dream details and drops a malformed reflection', () => {
    const cleaned = sanitizeDreamFields({ type: 'dream', dream: {}, dreamReflection: { themes: 'oops' } } as any);
    expect(cleaned.dream).toEqual({ feelings: [] });
    expect(cleaned).not.toHaveProperty('dreamReflection');
  });

  it('keeps well-formed dream fields', () => {
    const reflection = { version: 1, createdAt: 'x', contentHash: 'h', summary: 's', themes: [], images: [], wakingLinks: [], questions: ['q'], coded: { characters: [], settings: [], emotions: [], themes: [] }, care: 'none' };
    const cleaned = sanitizeDreamFields({ type: 'dream', dream: { feelings: ['awe', 'bored'], lucid: true }, dreamReflection: reflection } as any);
    expect(cleaned.dream).toEqual({ feelings: ['awe'], lucid: true });
    expect(cleaned.dreamReflection).toEqual(reflection);
  });

  it('removes dream fields from an entry that is not a dream', () => {
    const cleaned = sanitizeDreamFields({ type: 'note', title: 't', dream: { feelings: ['awe'] } } as any);
    expect(cleaned).toEqual({ type: 'note', title: 't' });
  });
});
