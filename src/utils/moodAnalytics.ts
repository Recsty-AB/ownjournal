import type { JournalEntryData } from "@/components/journal/JournalEntry";
import { format, getDay } from "date-fns";

export const MOOD_SCORE: Record<string, number> = {
  terrible: 1, poor: 2, okay: 3, good: 4, great: 5
};

export const SCORE_TO_MOOD: Record<number, string> = {
  1: 'terrible', 2: 'poor', 3: 'okay', 4: 'good', 5: 'great'
};

export interface MoodDistribution {
  mood: string;
  count: number;
  percentage: number;
}

export function computeMoodDistribution(entries: JournalEntryData[]): MoodDistribution[] {
  const counts: Record<string, number> = {};
  let total = 0;
  entries.forEach(entry => {
    if (entry.mood && MOOD_SCORE[entry.mood]) {
      counts[entry.mood] = (counts[entry.mood] || 0) + 1;
      total++;
    }
  });
  if (total === 0) return [];
  return ['great', 'good', 'okay', 'poor', 'terrible']
    .filter(mood => counts[mood])
    .map(mood => ({
      mood,
      count: counts[mood],
      percentage: Math.round((counts[mood] / total) * 100)
    }));
}

export interface RollingAveragePoint {
  date: string;
  score: number;
  mood: string;
  rawScore: number;
}

export function computeRollingAverage(entries: JournalEntryData[], windowSize: number = 7): RollingAveragePoint[] {
  // Sort entries by date ascending
  const sorted = entries
    .filter(e => e.mood && MOOD_SCORE[e.mood])
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return [];

  // Group by date, averaging same-day entries
  const dailyScores = new Map<string, number>();
  const dailyCounts = new Map<string, number>();
  sorted.forEach(entry => {
    const dateKey = format(entry.date, 'yyyy-MM-dd');
    const score = MOOD_SCORE[entry.mood];
    dailyScores.set(dateKey, (dailyScores.get(dateKey) || 0) + score);
    dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
  });

  const dateKeys = Array.from(dailyScores.keys()).sort();

  return dateKeys.map((dateKey, index) => {
    const rawScore = dailyScores.get(dateKey)! / dailyCounts.get(dateKey)!;

    // Compute rolling average
    const windowStart = Math.max(0, index - windowSize + 1);
    const windowKeys = dateKeys.slice(windowStart, index + 1);
    const avgScore = windowKeys.reduce((sum, key) =>
      sum + dailyScores.get(key)! / dailyCounts.get(key)!, 0
    ) / windowKeys.length;

    const roundedScore = Math.round(avgScore);
    return {
      date: dateKey,
      score: Math.round(avgScore * 10) / 10,
      mood: SCORE_TO_MOOD[roundedScore] || 'okay',
      rawScore: Math.round(rawScore * 10) / 10,
    };
  });
}

export interface DayOfWeekAverage {
  dayIndex: number;
  dayName: string;
  avgScore: number;
  entryCount: number;
}

export function computeDayOfWeekAverages(entries: JournalEntryData[]): DayOfWeekAverage[] {
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

  entries.forEach(entry => {
    if (entry.mood && MOOD_SCORE[entry.mood]) {
      const dayIndex = getDay(entry.date); // 0=Sun, 1=Mon, ...
      dayTotals[dayIndex] += MOOD_SCORE[entry.mood];
      dayCounts[dayIndex]++;
    }
  });

  return Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dayName: '', // Will be set by component using locale
    avgScore: dayCounts[i] > 0 ? Math.round((dayTotals[i] / dayCounts[i]) * 10) / 10 : 0,
    entryCount: dayCounts[i],
  })).filter(d => d.entryCount > 0);
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
}

export function computeStreaks(entries: JournalEntryData[], threshold: number = 4): StreakData {
  // threshold 4 = "good" or better
  const sorted = entries
    .filter(e => e.mood && MOOD_SCORE[e.mood])
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Get unique days with their best mood score
  const dailyBest = new Map<string, number>();
  sorted.forEach(entry => {
    const dateKey = format(entry.date, 'yyyy-MM-dd');
    const score = MOOD_SCORE[entry.mood];
    dailyBest.set(dateKey, Math.max(dailyBest.get(dateKey) || 0, score));
  });

  const sortedDays = Array.from(dailyBest.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let longestStreak = 0;
  let currentStreak = 0;

  sortedDays.forEach(([dateKey, score], index) => {
    // Check if this day is consecutive with the previous day
    const isConsecutive = index === 0 || (() => {
      const prevDate = new Date(sortedDays[index - 1][0]);
      const currDate = new Date(dateKey);
      const diffMs = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays === 1;
    })();

    if (score >= threshold && isConsecutive) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (score >= threshold) {
      // Good mood but gap in days — start new streak
      currentStreak = 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  return { currentStreak, longestStreak };
}

export interface ActivityCorrelation {
  activity: string;
  avgMood: number;
  delta: number;
  count: number;
}

export function computeActivityCorrelations(entries: JournalEntryData[]): ActivityCorrelation[] {
  // Compute overall average mood
  const allScores = entries
    .filter(e => e.mood && MOOD_SCORE[e.mood])
    .map(e => MOOD_SCORE[e.mood]);

  if (allScores.length === 0) return [];
  const overallAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  // For each activity, compute average mood of entries containing it
  const activityScores = new Map<string, { total: number; count: number }>();

  entries.forEach(entry => {
    if (!entry.mood || !MOOD_SCORE[entry.mood] || !entry.activities) return;
    const score = MOOD_SCORE[entry.mood];
    entry.activities.forEach(activity => {
      const existing = activityScores.get(activity) || { total: 0, count: 0 };
      activityScores.set(activity, { total: existing.total + score, count: existing.count + 1 });
    });
  });

  // Filter activities with < 3 occurrences, compute delta
  const results: ActivityCorrelation[] = [];
  activityScores.forEach((value, activity) => {
    if (value.count < 3) return;
    const avgMood = value.total / value.count;
    results.push({
      activity,
      avgMood: Math.round(avgMood * 10) / 10,
      delta: Math.round((avgMood - overallAvg) * 10) / 10,
      count: value.count,
    });
  });

  // Sort by delta descending (most positive first)
  return results.sort((a, b) => b.delta - a.delta);
}
