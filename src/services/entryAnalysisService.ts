/**
 * Per-entry AI analysis (ai-analyze `analyzeEntry`) for entries that have
 * none yet, shared by Trend Analysis and Dream patterns. Results go to
 * aiMetadataService, where both read them. Each call counts towards the
 * monthly entry-analysis allowance, as it always has for Trend Analysis.
 */

import { supabase } from '@/integrations/supabase/client';
import { aiMetadataService } from '@/services/aiMetadataService';
import { storageServiceV2 } from '@/services/storageServiceV2';
import type { EntryAIMetadata } from '@/types/aiMetadata';
import type { JournalEntryData } from '@/components/journal/JournalEntry';

/** Metadata left by an analysis that did not work; it is analysed again. */
export function isFailedEntryAnalysis(metadata: EntryAIMetadata | null): boolean {
  if (!metadata) return false;
  const summary = metadata.shortSummary?.toLowerCase().trim() || '';
  const failureIndicators = [
    'could not analyze',
    'analysis failed',
    'error analyzing',
    'failed to analyze',
    'unable to analyze',
    'cannot analyze',
    '分析できませんでした',
    '分析に失敗',
    '分析エラー',
  ];
  if (failureIndicators.some((indicator) => summary.includes(indicator))) return true;
  // Neutral defaults written by an old fallback when extraction failed.
  return metadata.sentimentScore === 0 && metadata.dominantEmotion === 'neutral' && (summary === '' || summary.length < 10);
}

export interface EntryWithAnalysis {
  entry: JournalEntryData;
  metadata: EntryAIMetadata | null;
}

/** The entries with their saved analysis, if any. */
export async function loadEntryAnalyses(entries: JournalEntryData[]): Promise<EntryWithAnalysis[]> {
  const result: EntryWithAnalysis[] = [];
  for (const entry of entries) {
    result.push({ entry, metadata: await aiMetadataService.getMetadata(entry.id) });
  }
  return result;
}

/** Entries that still need an analysis: none saved, or a failed one. */
export function needsEntryAnalysis(item: EntryWithAnalysis): boolean {
  return !item.metadata || isFailedEntryAnalysis(item.metadata);
}

export interface EntryAnalysisProgress {
  /** Entries done so far (successful or not). */
  done: number;
  total: number;
  /** A failed entry is being tried again. */
  retrying: boolean;
}

/**
 * Analyses the items that need it, four at a time, with one retry for each
 * failure. Updates `items` in place with the new metadata and returns how
 * many were analysed. Entries that still fail keep no metadata, so the next
 * run picks them up. Analysed entries are saved again so other devices see
 * the new analysis.
 */
export async function analyzeMissingEntries(
  items: EntryWithAnalysis[],
  options: { language: string; accessToken: string; onProgress?: (progress: EntryAnalysisProgress) => void },
): Promise<number> {
  const missing = items.filter(needsEntryAnalysis);
  if (missing.length === 0) return 0;
  const BATCH_SIZE = 4;
  let processed = 0;
  let done = 0;

  const request = (entry: JournalEntryData, forceReanalyze: boolean, isRetry = false) =>
    supabase.functions.invoke('ai-analyze', {
      body: {
        type: 'analyzeEntry',
        language: options.language.split('-')[0],
        entryId: entry.id,
        content: entry.body,
        createdAt: entry.createdAt.toISOString(),
        tags: entry.tags,
        mood: entry.mood,
        forceReanalyze,
        batchContext: { isTrendBatch: true, entryCount: missing.length, ...(isRetry ? { isRetry: true } : {}) },
      },
      headers: { Authorization: `Bearer ${options.accessToken}` },
    });

  const store = async (item: EntryWithAnalysis, data: unknown) => {
    const metadata = { ...(data as EntryAIMetadata), analyzedContentLength: item.entry.body?.trim().length || 0 };
    await aiMetadataService.setMetadata(item.entry.id, metadata);
    item.metadata = metadata;
    processed++;
  };

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    options.onProgress?.({ done: Math.min(i + BATCH_SIZE, missing.length), total: missing.length, retrying: false });

    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const failedBefore = isFailedEntryAnalysis(item.metadata);
        if (failedBefore) await aiMetadataService.deleteMetadata(item.entry.id);
        const { data, error } = await request(item.entry, failedBefore);
        if (error) throw error;
        return data;
      }),
    );

    const failed: EntryWithAnalysis[] = [];
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        await store(batch[j], result.value);
      } else {
        // Picked up again by the next run if the retry fails too.
        await aiMetadataService.deleteMetadata(batch[j].entry.id);
        batch[j].metadata = null;
        failed.push(batch[j]);
      }
    }
    done += batch.length - failed.length;

    for (const item of failed) {
      try {
        // A short pause before the retry, against rate limiting.
        await new Promise((resolve) => setTimeout(resolve, 800));
        options.onProgress?.({ done, total: missing.length, retrying: true });
        const { data, error } = await request(item.entry, true, true);
        if (!error && data) await store(item, data);
      } catch {
        await aiMetadataService.deleteMetadata(item.entry.id);
      }
      done++;
    }
  }

  // Save the analysed entries again with a new time, so other devices notice
  // the new analysis when they sync.
  if (processed > 0) {
    for (const item of items) {
      if (!item.metadata || isFailedEntryAnalysis(item.metadata)) continue;
      try {
        const full = await storageServiceV2.getEntry(item.entry.id);
        if (full) {
          full.updatedAt = new Date();
          await storageServiceV2.saveEntry(full);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn(`[entryAnalysis] Failed to sync entry ${item.entry.id}:`, error);
      }
    }
  }
  return processed;
}
