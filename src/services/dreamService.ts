/**
 * Dream reflection: client side of the ai-analyze `analyzeDream` and
 * `analyzeDreamPatterns` requests.
 *
 * What is sent for a reflection: the dream text and its date, the chosen
 * feelings and flags, the dreamer's own thoughts about the dream if any (with
 * the questions of the earlier reflection, which they answer), and
 * for each analysed journal entry of the previous week its date, short
 * summary, topics and dominant emotion (never its raw text).
 * A Dream patterns report sends the short labels saved with each reflection
 * and, to compare the dreams with waking life, the topics and dominant
 * emotions of the analysed journal entries of the same period with how many
 * entries each appears in (never text from a dream or an entry). The consent
 * dialog and the Help text list exactly these items; change them in all
 * locales before sending anything else.
 *
 * Nothing is stored server-side except a usage counter. The reflection comes
 * back here and is saved inside the entry's encrypted payload by the caller.
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeWithRetry } from '@/utils/edgeFunctionRetry';
import { scopedKey } from '@/utils/userScope';
import { aiMetadataService } from '@/services/aiMetadataService';
import { readStoredPatternsReport, writeStoredPatternsReport } from '@/services/dreamPatternsReportStore';
import { isE2EEnabled } from '@/utils/encryptionModeStorage';
import { storageServiceV2 } from '@/services/storageServiceV2';
import type { JournalEntryData } from '@/components/journal/JournalEntry';
import {
  DREAM_LIMITS,
  type DreamPatternsReport,
  type DreamReflection,
  hashDreamInput,
  isDreamTooLong,
  sanitizeDreamPatternsReport,
  sanitizeDreamReflection,
} from '@/types/dream';

export type DreamRequestErrorCode =
  | 'offline'
  | 'authRequired'
  | 'plusRequired'
  | 'limitReached'
  | 'failedLimitReached'
  | 'blocked'
  | 'tooShort'
  | 'tooLong'
  | 'notEnoughDreams'
  | 'failed';

export class DreamRequestError extends Error {
  constructor(readonly code: DreamRequestErrorCode) {
    super(code);
    this.name = 'DreamRequestError';
  }
}

const CONSENT_KEY = 'dream-reflection-consent';
const GUIDE_SEEN_KEY = 'dream-guide-seen';
const PATTERNS_PROMPT_SEEN_KEY = 'dream-patterns-ready-seen';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(scopedKey(key)) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(scopedKey(key), 'true');
  } catch {
    // Asked or shown again next time if storage is unavailable.
  }
}

export const hasDreamConsent = () => readFlag(CONSENT_KEY);
export const setDreamConsent = () => writeFlag(CONSENT_KEY);
export const hasSeenDreamGuide = () => readFlag(GUIDE_SEEN_KEY);
export const setDreamGuideSeen = () => writeFlag(GUIDE_SEEN_KEY);
export const hasSeenPatternsReadyPrompt = () => readFlag(PATTERNS_PROMPT_SEEN_KEY);
export const setPatternsReadyPromptSeen = () => writeFlag(PATTERNS_PROMPT_SEEN_KEY);

/** Chinese and Japanese put no space between sentences; other app languages do. */
export const sentenceSeparator = (language: string): string => (/^(zh|ja)/.test(language) ? '' : ' ');

/** Opens Help on "How dream reflection works". */
export const openDreamMethodHelp = () =>
  window.dispatchEvent(new CustomEvent('open-help', { detail: { tab: 'features', accordion: 'dream-method' } }));

/** True when the dream text, feelings or flags changed since the saved reflection was made. */
export function dreamChangedSinceReflection(
  entry: Pick<JournalEntryData, 'body' | 'dream' | 'dreamReflection'>,
): boolean {
  if (!entry.dreamReflection) return true;
  return hashDreamInput(entry.body, entry.dream) !== entry.dreamReflection.contentHash;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The user's calendar day as YYYY-MM-DD; dates are sent without a time of day. */
function localDay(value: Date | string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Up to seven summaries of analysed, non-dream journal entries from the
 * seven days up to and including the dream's date, newest first.
 */
export async function buildWakingContext(dream: JournalEntryData, entries: JournalEntryData[]) {
  const dreamDay = new Date(dream.date);
  dreamDay.setHours(23, 59, 59, 999);
  const earliest = dreamDay.getTime() - 7 * DAY_MS;
  const candidates = entries
    .filter((e) => e.id !== dream.id && !e.type)
    .filter((e) => {
      const time = new Date(e.date).getTime();
      return time <= dreamDay.getTime() && time > earliest;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const context: Array<{ date: string; shortSummary: string; topics: string[]; dominantEmotion: string }> = [];
  for (const entry of candidates) {
    if (context.length >= DREAM_LIMITS.maxWakingContext) break;
    const meta = await aiMetadataService.getMetadata(entry.id).catch(() => null);
    if (!meta?.shortSummary) continue;
    context.push({
      date: localDay(entry.date),
      shortSummary: meta.shortSummary,
      topics: (meta.topics ?? []).slice(0, 5),
      dominantEmotion: meta.dominantEmotion ?? '',
    });
  }
  return context;
}

async function errorCodeFrom(error: unknown): Promise<DreamRequestErrorCode> {
  const context = (error as { context?: { status?: number; json?: () => Promise<any> } })?.context;
  const status = context?.status;
  let body: Record<string, unknown> | null = null;
  try {
    body = typeof context?.json === 'function' ? await context.json() : null;
  } catch {
    body = null;
  }
  if (import.meta.env.DEV) console.error('[dream] ai-analyze failed with status', status);
  switch (status) {
    case 401:
      return 'authRequired';
    case 403:
      return 'plusRequired';
    case 429:
      if (body?.limitReached) return 'limitReached';
      if (body?.failedLimitReached) return 'failedLimitReached';
      return 'failed';
    case 422:
      return body?.blocked ? 'blocked' : 'failed';
    case 400:
      if (body?.tooLong) return 'tooLong';
      if (body?.tooShort) return 'tooShort';
      if (body?.notEnoughDreams) return 'notEnoughDreams';
      return 'failed';
    default:
      return 'failed';
  }
}

async function invokeDream<T>(body: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new DreamRequestError('offline');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new DreamRequestError('authRequired');

  const { data, error } = await invokeWithRetry<T & { error?: string }>(supabase, 'ai-analyze', {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new DreamRequestError(await errorCodeFrom(error));
  if (!data || (data as { error?: string }).error) throw new DreamRequestError('failed');
  return data;
}

export interface DreamReflectionResult {
  reflection: DreamReflection;
  used: number;
}

export async function requestDreamReflection(
  dream: JournalEntryData,
  entries: JournalEntryData[],
  language: string,
): Promise<DreamReflectionResult> {
  const content = dream.body.trim();
  if (content.length < DREAM_LIMITS.minCharacters) throw new DreamRequestError('tooShort');
  if (isDreamTooLong(content)) throw new DreamRequestError('tooLong');

  const wakingContext = await buildWakingContext(dream, entries);
  // The dreamer's thoughts answer the questions of the reflection on screen
  // ("1. Maybe" means its first question), so they go with the thoughts.
  const earlierQuestions = dream.dream?.thoughts?.trim() ? dream.dreamReflection?.questions : undefined;
  const data = await invokeDream<{ reflection?: unknown; used?: number }>({
    type: 'analyzeDream',
    language,
    content,
    date: localDay(dream.date),
    dream: dream.dream ?? { feelings: [] },
    ...(earlierQuestions?.length ? { earlierQuestions } : {}),
    ...(wakingContext.length > 0 ? { wakingContext } : {}),
  });

  const reflection = sanitizeDreamReflection({
    ...(data.reflection as object),
    version: 1,
    createdAt: new Date().toISOString(),
    contentHash: hashDreamInput(content, dream.dream),
  });
  if (!reflection) throw new DreamRequestError('failed');
  return { reflection, used: Number(data.used ?? 0) };
}

export interface WakingSummary {
  entryCount: number;
  topics: { label: string; count: number }[];
  emotions: { label: string; count: number }[];
}

function topCounts(counts: Map<string, number>, max: number): { label: string; count: number }[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([label, count]) => ({ label, count }));
}

/**
 * The journal side of a report's dreams-and-waking-life comparison: the topics
 * and dominant emotions of the already analysed, ordinary entries written from
 * a week before the oldest of the dreams to the day of the newest, each with
 * the number of entries it appears in. No entry is analysed for this, and no
 * entry text is included. Null when fewer than three such entries exist.
 */
export async function buildWakingSummary(
  dreams: JournalEntryData[],
  entries: JournalEntryData[],
): Promise<WakingSummary | null> {
  if (dreams.length === 0) return null;
  const times = dreams.map((d) => new Date(d.date).getTime());
  const from = new Date(Math.min(...times));
  from.setHours(0, 0, 0, 0);
  const to = new Date(Math.max(...times));
  to.setHours(23, 59, 59, 999);
  const earliest = from.getTime() - 7 * DAY_MS;

  const candidates = entries.filter((e) => {
    if (e.type) return false;
    const time = new Date(e.date).getTime();
    return time >= earliest && time <= to.getTime();
  });
  if (candidates.length < DREAM_LIMITS.wakingEntriesForPatterns) return null;

  // A report is still made when the analysis store cannot be read.
  let metadata: Awaited<ReturnType<typeof aiMetadataService.getAllMetadata>> = {};
  try {
    metadata = await aiMetadataService.getAllMetadata();
  } catch {
    return null;
  }
  const topics = new Map<string, number>();
  const emotions = new Map<string, number>();
  const add = (counts: Map<string, number>, label: unknown) => {
    const key = typeof label === 'string' ? label.trim().toLowerCase() : '';
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  let entryCount = 0;
  for (const entry of candidates) {
    const meta = metadata[entry.id];
    const entryTopics = Array.from(new Set((meta?.topics ?? []).map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))));
    if (!meta || entryTopics.every((t) => !t)) continue;
    entryCount++;
    entryTopics.forEach((topic) => add(topics, topic));
    add(emotions, meta.dominantEmotion);
  }
  if (entryCount < DREAM_LIMITS.wakingEntriesForPatterns) return null;
  return {
    entryCount,
    topics: topCounts(topics, DREAM_LIMITS.maxWakingTopics),
    emotions: topCounts(emotions, DREAM_LIMITS.maxWakingEmotions),
  };
}

/** True when a reflection can be made for this dream: it has its details and a text within the limits. */
export function canReflectOn(dream: JournalEntryData): boolean {
  const text = dream.body.trim();
  return !!dream.dream && text.length >= DREAM_LIMITS.minCharacters && !isDreamTooLong(text);
}

/**
 * The dreams a Dream patterns report for the period [start, end] covers:
 * dreams that already have a reflection or can get one, at most the newest
 * 40, oldest first.
 */
export function dreamsForPatterns(entries: JournalEntryData[], start: Date, end: Date): JournalEntryData[] {
  const from = start.getTime();
  const to = end.getTime();
  return entries
    .filter((e) => {
      if (e.type !== 'dream') return false;
      const time = new Date(e.date).getTime();
      return time >= from && time <= to && (!!e.dreamReflection || canReflectOn(e));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-DREAM_LIMITS.maxDreamsForPatterns);
}

/**
 * Dreams of the period [start, end] left out of a report because they are too
 * short for a reflection and have none yet. The card says so, so the count of
 * dreams does not look wrong.
 */
export function tooShortDreams(entries: JournalEntryData[], start: Date, end: Date): number {
  const from = start.getTime();
  const to = end.getTime();
  return entries.filter((e) => {
    if (e.type !== 'dream' || !e.dream || e.dreamReflection) return false;
    const time = new Date(e.date).getTime();
    return time >= from && time <= to && e.body.trim().length < DREAM_LIMITS.minCharacters;
  }).length;
}

export interface DreamPatternsResult {
  report: DreamPatternsReport;
  used: number;
}

/**
 * A report on `dreams`, which must all have a reflection by now (the card
 * reflects on the others first). `entries` is the whole journal, for the
 * comparison with waking life. The period is stored with the report.
 */
export async function requestDreamPatterns(
  dreams: JournalEntryData[],
  entries: JournalEntryData[],
  language: string,
  period: { start: Date; end: Date },
): Promise<DreamPatternsResult> {
  dreams = dreams.filter((d) => d.dreamReflection).slice(-DREAM_LIMITS.maxDreamsForPatterns);
  if (dreams.length < DREAM_LIMITS.dreamsForPatterns) throw new DreamRequestError('notEnoughDreams');

  const waking = await buildWakingSummary(dreams, entries);
  const data = await invokeDream<{ report?: unknown; used?: number }>({
    type: 'analyzeDreamPatterns',
    language,
    // From the dreams, only the labels saved with each reflection, oldest
    // first: no dates, feelings, flags or thoughts. From the journal, topics
    // and emotions with counts, never entry text (consent text).
    dreams: dreams.map((d) => ({ coded: d.dreamReflection!.coded })),
    ...(waking ? { waking } : {}),
  });

  const report = sanitizeDreamPatternsReport({
    ...(data.report as object),
    createdAt: new Date().toISOString(),
    periodStart: localDay(period.start),
    periodEnd: localDay(period.end),
  });
  if (!report) throw new DreamRequestError('failed');
  return { report, used: Number(data.used ?? 0) };
}

/** True while an encrypted journal is locked: no password entered on this device yet. */
export function isJournalLocked(): boolean {
  return isE2EEnabled() && !storageServiceV2.getMasterKey();
}

/** Calls back when the journal is unlocked or locked again. */
export function onJournalLockChange(listener: () => void): () => void {
  return storageServiceV2.onMasterKeyChanged(() => listener());
}

/** The latest Dream patterns report on this device; see dreamPatternsReportStore. */
export function loadPatternsReport(): Promise<DreamPatternsReport | null> {
  return readStoredPatternsReport(storageServiceV2.getMasterKey(), isE2EEnabled());
}

export function savePatternsReport(report: DreamPatternsReport): Promise<void> {
  return writeStoredPatternsReport(report, storageServiceV2.getMasterKey(), isE2EEnabled());
}
