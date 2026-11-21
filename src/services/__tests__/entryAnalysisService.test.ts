import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntryData } from '@/components/journal/JournalEntry';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getMetadata: vi.fn(),
  setMetadata: vi.fn(),
  deleteMetadata: vi.fn(),
  getEntry: vi.fn(),
  saveEntry: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/services/aiMetadataService', () => ({
  aiMetadataService: { getMetadata: mocks.getMetadata, setMetadata: mocks.setMetadata, deleteMetadata: mocks.deleteMetadata },
}));
vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: { getEntry: mocks.getEntry, saveEntry: mocks.saveEntry },
}));

import {
  analyzeMissingEntries,
  isFailedEntryAnalysis,
  loadEntryAnalyses,
  needsEntryAnalysis,
} from '../entryAnalysisService';

const entry = (id: string): JournalEntryData => ({
  id,
  date: new Date('2026-11-10T09:00:00'),
  title: id,
  body: `Text of ${id}`,
  tags: ['work'],
  mood: 'good',
  createdAt: new Date('2026-11-10T09:00:00'),
  updatedAt: new Date('2026-11-10T09:00:00'),
});

const analysis = { shortSummary: 'A long enough summary of the day.', sentimentScore: 0.4, dominantEmotion: 'calm', topics: ['work'] };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getEntry.mockImplementation(async (id: string) => entry(id));
});

describe('entry analysis', () => {
  it('treats missing and failed analyses as needing one', async () => {
    mocks.getMetadata.mockImplementation(async (id: string) =>
      id === 'a' ? analysis : id === 'b' ? { shortSummary: 'Analysis failed', sentimentScore: 0, dominantEmotion: 'neutral' } : null);

    const items = await loadEntryAnalyses([entry('a'), entry('b'), entry('c')]);

    expect(items.map(needsEntryAnalysis)).toEqual([false, true, true]);
    expect(isFailedEntryAnalysis(items[1].metadata)).toBe(true);
  });

  it('analyses only the entries that need it, stores the result and syncs them', async () => {
    mocks.invoke.mockResolvedValue({ data: analysis, error: null });
    const items = [{ entry: entry('a'), metadata: analysis }, { entry: entry('b'), metadata: null }];
    const progress = vi.fn();

    const done = await analyzeMissingEntries(items as never, { language: 'ja-JP', accessToken: 't', onProgress: progress });

    expect(done).toBe(1);
    expect(mocks.invoke).toHaveBeenCalledOnce();
    expect(mocks.invoke.mock.calls[0][1].body).toMatchObject({ type: 'analyzeEntry', entryId: 'b', language: 'ja', content: 'Text of b' });
    expect(mocks.setMetadata).toHaveBeenCalledWith('b', expect.objectContaining({ topics: ['work'], analyzedContentLength: 9 }));
    expect(items[1].metadata).toMatchObject({ topics: ['work'] });
    expect(progress).toHaveBeenCalledWith({ done: 1, total: 1, retrying: false });
    expect(mocks.saveEntry).toHaveBeenCalled();
  });

  it('tries a failed entry once more and leaves it without analysis if that fails too', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('busy') });
    const items = [{ entry: entry('b'), metadata: null }];

    const done = await analyzeMissingEntries(items as never, { language: 'en', accessToken: 't' });

    expect(done).toBe(0);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.invoke.mock.calls[1][1].body.forceReanalyze).toBe(true);
    expect(mocks.setMetadata).not.toHaveBeenCalled();
    expect(items[0].metadata).toBeNull();
    expect(mocks.saveEntry).not.toHaveBeenCalled();
  });
});
