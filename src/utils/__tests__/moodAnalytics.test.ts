import { describe, it, expect } from 'vitest';
import type { JournalEntryData } from '@/components/journal/JournalEntry';
import {
  computeMoodDistribution,
  computeRollingAverage,
  computeDayOfWeekAverages,
  computeStreaks,
  computeActivityCorrelations,
} from '@/utils/moodAnalytics';

type Mood = JournalEntryData['mood'];

// Minimal factory — the analytics functions only read date/mood/activities.
// Build the date from local Y/M/D components so getDay()/format() are stable
// regardless of the runner timezone (a bare "2026-01-01" string parses as UTC
// midnight and can shift a calendar day in negative-offset zones).
function entry(date: string, mood: Mood, activities?: string[]): JournalEntryData {
  const [y, m, d] = date.split('-').map(Number);
  return { date: new Date(y, m - 1, d), mood, activities } as JournalEntryData;
}

describe('computeMoodDistribution', () => {
  it('returns an empty array when there are no scored entries', () => {
    expect(computeMoodDistribution([])).toEqual([]);
    // Entries with an unknown mood are ignored entirely.
    expect(computeMoodDistribution([entry('2026-01-01', 'unknown' as Mood)])).toEqual([]);
  });

  it('counts moods and orders them best-to-worst', () => {
    const result = computeMoodDistribution([
      entry('2026-01-01', 'great'),
      entry('2026-01-02', 'terrible'),
      entry('2026-01-03', 'okay'),
    ]);
    expect(result.map((r) => r.mood)).toEqual(['great', 'okay', 'terrible']);
    expect(result.every((r) => r.count === 1)).toBe(true);
  });

  it('omits moods with zero entries', () => {
    const result = computeMoodDistribution([entry('2026-01-01', 'good'), entry('2026-01-02', 'good')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ mood: 'good', count: 2, percentage: 100 });
  });

  it('rounds percentages independently, so three equal moods sum to 99 (documented behavior)', () => {
    const result = computeMoodDistribution([
      entry('2026-01-01', 'great'),
      entry('2026-01-02', 'okay'),
      entry('2026-01-03', 'terrible'),
    ]);
    expect(result.map((r) => r.percentage)).toEqual([33, 33, 33]);
    expect(result.reduce((sum, r) => sum + r.percentage, 0)).toBe(99);
  });
});

describe('computeRollingAverage', () => {
  it('returns an empty array for no scored entries', () => {
    expect(computeRollingAverage([])).toEqual([]);
  });

  it('averages multiple entries on the same day into one point', () => {
    const result = computeRollingAverage([
      entry('2026-01-01', 'great'), // 5
      entry('2026-01-01', 'okay'), //  3
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].rawScore).toBe(4); // (5 + 3) / 2
    expect(result[0].date).toBe('2026-01-01');
  });

  it('smooths across a rolling window and maps the rounded score back to a mood', () => {
    const result = computeRollingAverage(
      [
        entry('2026-01-01', 'terrible'), // 1
        entry('2026-01-02', 'great'), //    5
      ],
      7,
    );
    // Day 2's rolling average is (1 + 5) / 2 = 3 -> rounds to mood 'okay'.
    expect(result[1].score).toBe(3);
    expect(result[1].mood).toBe('okay');
    // Day 1's rolling average is just itself.
    expect(result[0].score).toBe(1);
  });

  it('honors the window size so old days drop out of the average', () => {
    const result = computeRollingAverage(
      [
        entry('2026-01-01', 'terrible'), // 1, drops out of a 1-day window
        entry('2026-01-02', 'great'), //    5
      ],
      1,
    );
    expect(result[1].score).toBe(5); // window of 1 = the day itself only
  });
});

describe('computeDayOfWeekAverages', () => {
  it('returns only weekdays that have entries', () => {
    // 2026-01-01 is a Thursday (getDay === 4).
    const result = computeDayOfWeekAverages([entry('2026-01-01', 'good')]);
    expect(result).toHaveLength(1);
    expect(result[0].dayIndex).toBe(4);
    expect(result[0].entryCount).toBe(1);
    expect(result[0].avgScore).toBe(4);
  });

  it('averages entries that fall on the same weekday across weeks', () => {
    // Both Thursdays.
    const result = computeDayOfWeekAverages([
      entry('2026-01-01', 'great'), // 5
      entry('2026-01-08', 'okay'), //  3
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].avgScore).toBe(4); // (5 + 3) / 2
    expect(result[0].entryCount).toBe(2);
  });
});

describe('computeStreaks', () => {
  it('returns zero streaks with no entries', () => {
    expect(computeStreaks([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('counts consecutive good-or-better days', () => {
    const result = computeStreaks([
      entry('2026-01-01', 'good'),
      entry('2026-01-02', 'great'),
      entry('2026-01-03', 'good'),
    ]);
    expect(result.longestStreak).toBe(3);
    expect(result.currentStreak).toBe(3);
  });

  it('breaks the streak on a below-threshold day', () => {
    const result = computeStreaks([
      entry('2026-01-01', 'good'), //  streak 1
      entry('2026-01-02', 'poor'), //  resets to 0
      entry('2026-01-03', 'good'), //  streak 1
    ]);
    expect(result.longestStreak).toBe(1);
  });

  it('resets the running streak when there is a calendar gap between good days', () => {
    const result = computeStreaks([
      entry('2026-01-01', 'great'),
      entry('2026-01-02', 'great'), // longest run = 2
      entry('2026-01-10', 'great'), // gap -> new run of 1
    ]);
    expect(result.longestStreak).toBe(2);
    expect(result.currentStreak).toBe(1);
  });

  it('uses the best mood of a day when multiple entries exist', () => {
    const result = computeStreaks([
      entry('2026-01-01', 'poor'), // same day...
      entry('2026-01-01', 'great'), // ...best score wins -> day counts
    ]);
    expect(result.longestStreak).toBe(1);
  });
});

describe('computeActivityCorrelations', () => {
  it('returns an empty array with no scored entries', () => {
    expect(computeActivityCorrelations([])).toEqual([]);
  });

  it('ignores activities that occur fewer than three times', () => {
    const result = computeActivityCorrelations([
      entry('2026-01-01', 'great', ['running']),
      entry('2026-01-02', 'great', ['running']),
    ]);
    expect(result).toEqual([]);
  });

  it('computes average mood and a delta relative to the overall average, sorted by delta', () => {
    const entries = [
      entry('2026-01-01', 'great', ['running']), // 5
      entry('2026-01-02', 'great', ['running']), // 5
      entry('2026-01-03', 'great', ['running']), // 5
      entry('2026-01-04', 'terrible', ['doomscrolling']), // 1
      entry('2026-01-05', 'terrible', ['doomscrolling']), // 1
      entry('2026-01-06', 'terrible', ['doomscrolling']), // 1
    ];
    const result = computeActivityCorrelations(entries);
    expect(result.map((r) => r.activity)).toEqual(['running', 'doomscrolling']); // delta desc
    const running = result.find((r) => r.activity === 'running')!;
    const doom = result.find((r) => r.activity === 'doomscrolling')!;
    expect(running.avgMood).toBe(5);
    expect(doom.avgMood).toBe(1);
    // Overall average is 3, so deltas are +2 and -2.
    expect(running.delta).toBe(2);
    expect(doom.delta).toBe(-2);
    expect(running.count).toBe(3);
  });
});
