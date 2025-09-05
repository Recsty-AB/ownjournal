/**
 * AI Metadata Types
 * Per-entry metadata that's generated once and reused
 */

export type EntryAIMetadata = {
  metaVersion: number;
  analyzedAt: string;

  sentimentScore: number; // -1 to 1 scale
  dominantEmotion: string;
  emotions: string[];

  topics: string[];
  keywords: string[];
  peopleMentioned: string[];

  shortSummary: string;

  mainStressors?: string[];
  mainSupports?: string[];
  selfTalkTone?: "self-critical" | "balanced" | "self-compassionate" | "unclear";

  wordCount: number;
  lengthCategory: "short" | "medium" | "long";
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  analyzedContentLength?: number; // Track content length to detect changes
};

export type AggregatedMetadata = {
  entryCount: number;
  avgSentiment: number;
  topEmotions: { emotion: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  timeOfDayDistribution: Record<string, number>;
  lengthDistribution: Record<string, number>;
};
