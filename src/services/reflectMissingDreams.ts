/**
 * Reflecting, before a Dream patterns report or a Trend Analysis with
 * "Include your dreams" on, on the dreams of the period that have none yet.
 * Kept apart from dreamService so it goes through its exported
 * requestDreamReflection.
 */

import type { JournalEntryData } from '@/components/journal/JournalEntry';
import type { DreamReflection } from '@/types/dream';
import { aiUsageLimits } from '@/services/aiUsageLimits';
import { DreamRequestError, requestDreamReflection, type DreamRequestErrorCode } from '@/services/dreamService';

/** Reflection errors that stop reflecting on more dreams. */
const STOP_REFLECTING: DreamRequestErrorCode[] = ['limitReached', 'offline', 'failedLimitReached'];

export interface ReflectMissingResult {
  /** The same dreams, with the reflections made now filled in. */
  dreams: JournalEntryData[];
  /** Set when reflecting stopped early (no reflections left, offline, too many failures). */
  stoppedBy?: DreamRequestErrorCode;
}

/**
 * Reflects, one at a time, on the dreams in `dreams` that have none yet (at
 * most `max` of them), as "Reflect on this dream" does; each counts towards
 * the monthly reflections. A dream the AI could not reflect on stays without
 * one. `entries` is the whole journal, for each reflection's waking context.
 * Resolves to null when the account changed meanwhile (`isCurrent`): nothing
 * more is saved then.
 */
export async function reflectMissingDreams(
  dreams: JournalEntryData[],
  entries: JournalEntryData[],
  options: {
    language: string;
    max?: number;
    onProgress?: (current: number, total: number) => void;
    /** Saves a new reflection inside its dream. A failed save does not stop the run. */
    onSaved: (dream: JournalEntryData, reflection: DreamReflection) => Promise<void>;
    isCurrent: () => boolean;
  },
): Promise<ReflectMissingResult | null> {
  const todo = dreams.filter((d) => !d.dreamReflection).slice(0, options.max ?? Infinity);
  const made = new Map<string, DreamReflection>();
  let stoppedBy: DreamRequestErrorCode | undefined;
  for (let i = 0; i < todo.length; i++) {
    options.onProgress?.(i + 1, todo.length);
    try {
      const result = await requestDreamReflection(todo[i], entries, options.language);
      if (!options.isCurrent()) return null;
      aiUsageLimits.setMonthlyDreamCount('dreamReflection', result.used);
      made.set(todo[i].id, result.reflection);
      try {
        await options.onSaved(todo[i], result.reflection);
      } catch {
        // Not saved with the dream; this run still uses it.
      }
    } catch (error) {
      if (!options.isCurrent()) return null;
      const code = error instanceof DreamRequestError ? error.code : 'failed';
      if (STOP_REFLECTING.includes(code)) {
        if (code === 'limitReached') aiUsageLimits.markLimitReached('dreamReflection');
        stoppedBy = code;
        break;
      }
    }
  }
  return {
    dreams: dreams.map((d) => (made.has(d.id) ? { ...d, dreamReflection: made.get(d.id) } : d)),
    ...(stoppedBy ? { stoppedBy } : {}),
  };
}

