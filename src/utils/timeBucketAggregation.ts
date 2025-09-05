/**
 * Time Bucket Aggregation for Scalable Trend Analysis
 * 
 * Implements adaptive data strategy for long periods:
 * - ≤90 days: Individual entries (up to 90)
 * - 91-365 days: Weekly buckets (~52 max)
 * - >365 days: Monthly buckets (~60 max)
 */

import { startOfWeek, startOfMonth, format, getWeek, getMonth, getYear } from "date-fns";
import type { EntryAIMetadata } from "@/types/aiMetadata";
import type { JournalEntryData } from "@/components/journal/JournalEntry";

export interface TimeBucket {
  periodLabel: string;
  startDate: string;
  endDate: string;
  entryCount: number;
  avgSentiment: number;
  sentimentRange: { min: number; max: number };
  dominantEmotions: string[];
  dominantTopics: string[];
  sentimentTrend: "improving" | "declining" | "stable";
  medianEntry: { sentiment: number; emotion: string; topics: string[] };
  extremeEntry: { sentiment: number; emotion: string; topics: string[] };
}

export interface EntryWithDateAndMetadata {
  entry: JournalEntryData;
  metadata: EntryAIMetadata;
}

type BucketSize = "week" | "month";

/**
 * Determines the appropriate bucket size based on period length
 */
export function determineBucketSize(periodDays: number): BucketSize {
  return periodDays > 365 ? "month" : "week";
}

/**
 * Generates a unique bucket key for an entry based on its date
 */
function getBucketKey(date: Date, bucketSize: BucketSize): string {
  if (bucketSize === "week") {
    const weekNum = getWeek(date, { weekStartsOn: 1 }); // Monday start
    const year = getYear(date);
    return `${year}-W${String(weekNum).padStart(2, "0")}`;
  } else {
    const month = getMonth(date);
    const year = getYear(date);
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }
}

/**
 * Generates a human-readable label for a bucket
 */
function getBucketLabel(date: Date, bucketSize: BucketSize): string {
  if (bucketSize === "week") {
    const weekNum = getWeek(date, { weekStartsOn: 1 });
    return `Week ${weekNum}, ${format(date, "MMM yyyy")}`;
  } else {
    return format(date, "MMMM yyyy");
  }
}

/**
 * Counts frequency of items and returns top N
 */
function getTopItems(items: string[], limit: number = 3): string[] {
  const counts: Record<string, number> = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

/**
 * Selects representative entries from a bucket:
 * - Median: Entry closest to average sentiment (typical state)
 * - Extreme: Entry furthest from average sentiment (peak/valley)
 */
function selectRepresentativeEntries(
  entries: EntryWithDateAndMetadata[]
): { median: { sentiment: number; emotion: string; topics: string[] }; extreme: { sentiment: number; emotion: string; topics: string[] } } {
  if (entries.length === 0) {
    return {
      median: { sentiment: 0, emotion: "neutral", topics: [] },
      extreme: { sentiment: 0, emotion: "neutral", topics: [] }
    };
  }
  
  if (entries.length === 1) {
    const m = entries[0].metadata;
    const rep = { sentiment: m.sentimentScore, emotion: m.dominantEmotion, topics: m.topics.slice(0, 3) };
    return { median: rep, extreme: rep };
  }
  
  const avgSentiment = entries.reduce((sum, e) => sum + e.metadata.sentimentScore, 0) / entries.length;
  
  // Find entry closest to average (median representative)
  let medianEntry = entries[0];
  let minDeviation = Math.abs(entries[0].metadata.sentimentScore - avgSentiment);
  
  // Find entry furthest from average (extreme representative)
  let extremeEntry = entries[0];
  let maxDeviation = Math.abs(entries[0].metadata.sentimentScore - avgSentiment);
  
  for (const entry of entries) {
    const deviation = Math.abs(entry.metadata.sentimentScore - avgSentiment);
    
    if (deviation < minDeviation) {
      minDeviation = deviation;
      medianEntry = entry;
    }
    
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      extremeEntry = entry;
    }
  }
  
  return {
    median: {
      sentiment: medianEntry.metadata.sentimentScore,
      emotion: medianEntry.metadata.dominantEmotion,
      topics: medianEntry.metadata.topics.slice(0, 3)
    },
    extreme: {
      sentiment: extremeEntry.metadata.sentimentScore,
      emotion: extremeEntry.metadata.dominantEmotion,
      topics: extremeEntry.metadata.topics.slice(0, 3)
    }
  };
}

/**
 * Computes time buckets from entries with metadata
 * Groups entries into weekly or monthly buckets with aggregated statistics
 */
export function computeTimeBuckets(
  entries: EntryWithDateAndMetadata[],
  startDate: Date,
  endDate: Date,
  periodDays: number
): TimeBucket[] {
  const bucketSize = determineBucketSize(periodDays);
  
  // Group entries by bucket
  const bucketMap = new Map<string, {
    entries: EntryWithDateAndMetadata[];
    bucketDate: Date;
    label: string;
  }>();
  
  for (const entry of entries) {
    const entryDate = entry.entry.date;
    const key = getBucketKey(entryDate, bucketSize);
    
    if (!bucketMap.has(key)) {
      const bucketStart = bucketSize === "week" 
        ? startOfWeek(entryDate, { weekStartsOn: 1 })
        : startOfMonth(entryDate);
      
      bucketMap.set(key, {
        entries: [],
        bucketDate: bucketStart,
        label: getBucketLabel(entryDate, bucketSize)
      });
    }
    
    bucketMap.get(key)!.entries.push(entry);
  }
  
  // Sort buckets chronologically
  const sortedBuckets = Array.from(bucketMap.entries())
    .sort((a, b) => a[1].bucketDate.getTime() - b[1].bucketDate.getTime());
  
  // Compute statistics for each bucket
  const timeBuckets: TimeBucket[] = [];
  let previousAvgSentiment: number | null = null;
  
  for (const [key, bucket] of sortedBuckets) {
    const { entries: bucketEntries, bucketDate, label } = bucket;
    
    if (bucketEntries.length === 0) continue;
    
    // Calculate sentiment statistics
    const sentiments = bucketEntries.map(e => e.metadata.sentimentScore);
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const minSentiment = Math.min(...sentiments);
    const maxSentiment = Math.max(...sentiments);
    
    // Collect all emotions and topics
    const allEmotions: string[] = [];
    const allTopics: string[] = [];
    
    for (const entry of bucketEntries) {
      allEmotions.push(...entry.metadata.emotions);
      allTopics.push(...entry.metadata.topics);
    }
    
    // Determine sentiment trend vs previous bucket
    let sentimentTrend: "improving" | "declining" | "stable" = "stable";
    if (previousAvgSentiment !== null) {
      const diff = avgSentiment - previousAvgSentiment;
      if (diff > 0.1) sentimentTrend = "improving";
      else if (diff < -0.1) sentimentTrend = "declining";
    }
    previousAvgSentiment = avgSentiment;
    
    // Select representative entries
    const representatives = selectRepresentativeEntries(bucketEntries);
    
    // Calculate bucket end date
    const nextBucketStart = bucketSize === "week"
      ? new Date(bucketDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(bucketDate.getFullYear(), bucketDate.getMonth() + 1, 1);
    const bucketEnd = new Date(Math.min(nextBucketStart.getTime() - 1, endDate.getTime()));
    
    timeBuckets.push({
      periodLabel: label,
      startDate: bucketDate.toISOString(),
      endDate: bucketEnd.toISOString(),
      entryCount: bucketEntries.length,
      avgSentiment: Number(avgSentiment.toFixed(3)),
      sentimentRange: {
        min: Number(minSentiment.toFixed(3)),
        max: Number(maxSentiment.toFixed(3))
      },
      dominantEmotions: getTopItems(allEmotions, 3),
      dominantTopics: getTopItems(allTopics, 3),
      sentimentTrend,
      medianEntry: representatives.median,
      extremeEntry: representatives.extreme
    });
  }
  
  return timeBuckets;
}

/**
 * Determines if time buckets should be used based on period length
 */
export function shouldUseTimeBuckets(periodDays: number): boolean {
  return periodDays > 90;
}
