import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  // Answer of the usage summary call; an empty summary when unset.
  result: null as { data: unknown; error: unknown } | null,
  calls: [] as Array<{ fn: string; args: Record<string, string> }>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    rpc: vi.fn(async (fn: string, args: Record<string, string>) => {
      db.calls.push({ fn, args });
      return db.result ?? { data: [], error: null };
    }),
  },
}));

import { aiUsageLimits } from '../aiUsageLimits';

const summary = (counts: Record<string, unknown> = {}) => ({
  data: [{
    is_pro: true,
    monthly_title_count: 0,
    monthly_tags_count: 0,
    monthly_entry_count: 0,
    weekly_trend_count: 0,
    yearly_entry_count: 0,
    yearly_trend_count: 0,
    monthly_transcription_seconds: 0,
    monthly_dream_reflection_count: 0,
    monthly_dream_patterns_count: 0,
    monthly_dream_failed_count: 0,
    ...counts,
  }],
  error: null,
});

beforeEach(() => {
  localStorage.clear();
  db.result = null;
  db.calls = [];
  vi.useRealTimers();
});

describe('aiUsageLimits dream features', () => {
  it('allows 30 reflections and 2 pattern reports a month', () => {
    expect(aiUsageLimits.getUsageStats().dreamReflection).toEqual({ current: 0, limit: 30 });
    expect(aiUsageLimits.getUsageStats().dreamPatterns).toEqual({ current: 0, limit: 2 });

    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 29);
    expect(aiUsageLimits.canUseFeature('dreamReflection').allowed).toBe(true);
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 30);
    expect(aiUsageLimits.canUseFeature('dreamReflection')).toMatchObject({ allowed: false, current: 30, limit: 30 });

    aiUsageLimits.markLimitReached('dreamPatterns');
    expect(aiUsageLimits.canUseFeature('dreamPatterns')).toMatchObject({ allowed: false, limit: 2 });
  });

  it('loads usage saved by an older app version without dream counters', () => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('ai_usage_limits', JSON.stringify({
      month, week: 'x', titleCount: 1, tagsCount: 0, entryAnalysisCount: 0, trendAnalysisCount: 0, analyzedEntries: [],
    }));

    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(0);
    expect(aiUsageLimits.canUseFeature('dreamReflection').allowed).toBe(true);
  });

  it('takes the counts from the server, which counts the usage rows itself', async () => {
    db.result = summary({
      monthly_dream_reflection_count: 2,
      monthly_dream_patterns_count: 1,
      monthly_dream_failed_count: 1,
      monthly_title_count: 1,
      weekly_trend_count: 1,
    });

    await aiUsageLimits.syncFromBackend();

    const stats = aiUsageLimits.getUsageStats();
    expect(stats.dreamReflection.current).toBe(2);
    expect(stats.dreamPatterns.current).toBe(1);
    expect(stats.title.current).toBe(1);
    expect(stats.trendAnalysis.current).toBe(1);
  });

  it('shows the full usage of a heavy month, beyond what one read of the rows returns', async () => {
    db.result = summary({ monthly_entry_count: 1500, monthly_title_count: 200, monthly_dream_reflection_count: 30 });

    await aiUsageLimits.syncFromBackend();

    const stats = aiUsageLimits.getUsageStats();
    expect(stats.entryAnalysis.current).toBe(1500);
    expect(stats.title.current).toBe(200);
    expect(aiUsageLimits.canUseFeature('dreamReflection').allowed).toBe(false);
  });

  it('shows nothing used for an account without a subscription record', async () => {
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 5);
    db.result = { data: [], error: null };

    await aiUsageLimits.syncFromBackend();

    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(0);
  });

  it('reads counts sent as text and ignores values that are not counts', async () => {
    db.result = summary({ monthly_dream_reflection_count: '7', monthly_dream_patterns_count: -1, monthly_title_count: null });

    await aiUsageLimits.syncFromBackend();

    const stats = aiUsageLimits.getUsageStats();
    expect(stats.dreamReflection.current).toBe(7);
    expect(stats.dreamPatterns.current).toBe(0);
    expect(stats.title.current).toBe(0);
  });

  it.each([
    ['the read fails', { data: null, error: { message: 'network' } }],
    ['the read returns nothing', { data: null, error: null }],
  ])('keeps the counts it has when %s', async (_name, result) => {
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 30);
    aiUsageLimits.setMonthlyDreamCount('dreamPatterns', 2);
    const notified = vi.fn();
    const unsubscribe = aiUsageLimits.subscribe(notified);
    db.result = result;

    await aiUsageLimits.syncFromBackend();
    unsubscribe();

    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(30);
    expect(aiUsageLimits.getUsageStats().dreamPatterns.current).toBe(2);
    expect(aiUsageLimits.canUseFeature('dreamReflection').allowed).toBe(false);
    expect(notified).not.toHaveBeenCalled();
  });

  it('asks for the signed-in user\'s counts over the server\'s UTC month and week, whatever the local time zone', async () => {
    // Wednesday 2 December 2026, 03:30 UTC.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-02T03:30:00.000Z'));

    await aiUsageLimits.syncFromBackend();

    expect(db.calls).toEqual([{
      fn: 'get_ai_usage_summary',
      args: {
        p_user_id: 'u1',
        p_start_of_month: '2026-12-01T00:00:00.000Z',
        p_start_of_week: '2026-11-29T00:00:00.000Z',
        p_start_of_year: '2026-01-01T00:00:00.000Z',
      },
    }]);
  });

  it('starts a new month when the server does, at midnight UTC', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-30T23:59:00.000Z'));
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', 30);
    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(30);

    vi.setSystemTime(new Date('2026-12-01T00:01:00.000Z'));

    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(0);
  });

  it('ignores invalid server counts', () => {
    aiUsageLimits.setMonthlyDreamCount('dreamReflection', Number.NaN);
    expect(aiUsageLimits.getUsageStats().dreamReflection.current).toBe(0);
  });
});
