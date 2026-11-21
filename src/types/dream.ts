/**
 * Dream entries and dream reflection.
 *
 * A dream is a journal entry with `type: 'dream'`. The details and the saved
 * reflection travel inside the entry's encrypted payload (never in plaintext
 * cloud metadata), next to title/body/images.
 */

/** Fixed feeling keys. Translated in the UI, sent to the model as these keys. */
export const DREAM_FEELINGS = [
  'joy',
  'calm',
  'awe',
  'curiosity',
  'love',
  'fear',
  'anxiety',
  'sadness',
  'anger',
  'confusion',
  'shame',
  'loneliness',
] as const;

export type DreamFeeling = (typeof DREAM_FEELINGS)[number];

export interface DreamDetails {
  feelings: DreamFeeling[];
  recurring?: boolean;
  nightmare?: boolean;
  lucid?: boolean;
  /**
   * What the dreamer wrote under a reflection: their own associations and
   * answers to its questions. Sent with "Reflect again".
   */
  thoughts?: string;
}

/** Short labels used to compare dreams in the Dream patterns report. */
export interface DreamCodedRecord {
  characters: string[];
  settings: string[];
  emotions: string[];
  themes: string[];
}

export interface DreamReflection {
  version: 1;
  /** ISO timestamp, set by the client when the reflection is saved. */
  createdAt: string;
  /** hashDreamInput of the text, feelings, flags and thoughts reflected on; detects edits. */
  contentHash: string;
  /**
   * Made with the dreamer's thoughts ("Reflect again"): what the thoughts
   * changed in this reflection, said to the dreamer. Absent otherwise.
   */
  fromThoughts?: string;
  summary: string;
  themes: { title: string; note: string }[];
  images: { image: string; possibilities: string }[];
  wakingLinks: string[];
  questions: string[];
  coded: DreamCodedRecord;
  /** 'distress' makes the client show fixed supportive text. */
  care: 'none' | 'distress';
}

/** Server limits, mirrored in supabase/functions/ai-analyze (keep in sync). */
export const DREAM_LIMITS = {
  reflectionsPerMonth: 30,
  patternReportsPerMonth: 2,
  /** Dreams in the chosen period needed for a Dream patterns report. */
  dreamsForPatterns: 5,
  /** Below this many reflected dreams the report is labelled "early themes". */
  dreamsForFullPatterns: 15,
  maxDreamsForPatterns: 40,
  maxWakingContext: 7,
  maxWords: 1500,
  /** Also caps languages written without spaces (zh, ja, th), where words can't be counted. */
  maxCharacters: 8000,
  minCharacters: 50,
  /** Cap on the dreamer's own thoughts saved with a dream. */
  maxThoughtsCharacters: 2000,
  /** Reflected dreams in the period a Trend Analysis needs before it includes them. */
  dreamsForTrends: 3,
  maxDreamsForTrends: 40,
} as const;

/** True when a dream is over the word or character cap for a reflection. */
export function isDreamTooLong(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return words > DREAM_LIMITS.maxWords || trimmed.length > DREAM_LIMITS.maxCharacters;
}

/**
 * Fingerprint (cyrb53) of what a reflection is made from: the trimmed dream
 * text, the feelings, the recurring/nightmare/lucid flags and the dreamer's
 * own thoughts. Used only to notice an edit since the reflection. Synchronous,
 * so it can run during render.
 */
export function hashDreamInput(text: string, details?: DreamDetails): string {
  const clean = sanitizeDreamDetails(details) ?? { feelings: [] };
  const input = [
    text.trim(),
    [...clean.feelings].sort().join(','),
    clean.recurring ? 'r' : '',
    clean.nightmare ? 'n' : '',
    clean.lucid ? 'l' : '',
    // Only when there are any, so a dream without thoughts hashes as before.
    ...(clean.thoughts ? [clean.thoughts] : []),
  ].join('\u0000');
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type DreamPatternKind = 'character' | 'setting' | 'emotion' | 'theme';

/** IndexedDB settings key of the saved report; "Delete all entries" removes it. */
export const DREAM_PATTERNS_REPORT_KEY = 'dream-patterns-report';
/** Window event fired when the saved report was removed. */
export const DREAM_PATTERNS_REPORT_CLEARED = 'dream-patterns-report-cleared';

/** Latest Dream patterns report; kept on the device (see dreamPatternsReportStore). */
export interface DreamPatternsReport {
  version: 1;
  createdAt: string;
  dreamCount: number;
  /** Calendar days (YYYY-MM-DD) of the period the report covers. */
  periodStart?: string;
  periodEnd?: string;
  overview: string;
  recurring: { kind: DreamPatternKind; label: string; count: number; note: string }[];
  changes: string[];
  questions: string[];
}

/**
 * Entries for mood and trend views: dreams stay out (a nightmare is not a bad
 * day). Trend Analysis sends dreams separately, only when "Include your
 * dreams" is on.
 */
export function withoutDreams<T extends { type?: string }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.type !== 'dream');
}

export function isDreamFeeling(value: unknown): value is DreamFeeling {
  return typeof value === 'string' && (DREAM_FEELINGS as readonly string[]).includes(value);
}

/** Keep only well-formed details; tolerates data written by other app versions. */
export function sanitizeDreamDetails(value: unknown): DreamDetails | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const feelings = Array.isArray(raw.feelings)
    ? Array.from(new Set(raw.feelings.filter(isDreamFeeling)))
    : [];
  const thoughts = typeof raw.thoughts === 'string'
    ? raw.thoughts.trim().slice(0, DREAM_LIMITS.maxThoughtsCharacters)
    : '';
  return {
    feelings,
    ...(raw.recurring === true ? { recurring: true } : {}),
    ...(raw.nightmare === true ? { nightmare: true } : {}),
    ...(raw.lucid === true ? { lucid: true } : {}),
    ...(thoughts ? { thoughts } : {}),
  };
}

/**
 * Dream fields of an entry from outside the app's own storage (an imported
 * backup), cleaned the way decryptEntry cleans stored ones: well-formed for a
 * dream, absent for any other entry.
 */
export function sanitizeDreamFields<T extends { type?: string; dream?: unknown; dreamReflection?: unknown }>(entry: T): T {
  const { dream, dreamReflection, ...rest } = entry;
  if (entry.type !== 'dream') return rest as T;
  const reflection = sanitizeDreamReflection(dreamReflection);
  return {
    ...rest,
    dream: sanitizeDreamDetails(dream) ?? { feelings: [] },
    ...(reflection ? { dreamReflection: reflection } : {}),
  } as T;
}

/** Accept a stored reflection only if it has the fields the UI renders. */
export function sanitizeDreamReflection(value: unknown): DreamReflection | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<DreamReflection>;
  if (raw.version !== 1 || typeof raw.summary !== 'string' || typeof raw.createdAt !== 'string') {
    return undefined;
  }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
  const coded = (raw.coded ?? {}) as Partial<DreamCodedRecord>;
  return {
    version: 1,
    createdAt: raw.createdAt,
    contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : '',
    ...(typeof raw.fromThoughts === 'string' && raw.fromThoughts.trim()
      ? { fromThoughts: raw.fromThoughts.trim() }
      : {}),
    summary: raw.summary,
    themes: Array.isArray(raw.themes)
      ? raw.themes.filter((t) => t && typeof t.title === 'string' && typeof t.note === 'string')
      : [],
    images: Array.isArray(raw.images)
      ? raw.images
          .filter((i) => i && typeof i.image === 'string' && typeof i.possibilities === 'string')
          .map((i) => ({ image: i.image, possibilities: i.possibilities }))
      : [],
    wakingLinks: strings(raw.wakingLinks),
    questions: strings(raw.questions),
    coded: {
      characters: strings(coded.characters),
      settings: strings(coded.settings),
      emotions: strings(coded.emotions),
      themes: strings(coded.themes),
    },
    care: raw.care === 'distress' ? 'distress' : 'none',
  };
}

const PATTERN_KINDS: readonly DreamPatternKind[] = ['character', 'setting', 'emotion', 'theme'];

const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function sanitizeDreamPatternsReport(value: unknown): DreamPatternsReport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<DreamPatternsReport>;
  if (typeof raw.overview !== 'string' || typeof raw.createdAt !== 'string') return undefined;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
  return {
    version: 1,
    createdAt: raw.createdAt,
    dreamCount: typeof raw.dreamCount === 'number' ? raw.dreamCount : 0,
    ...(isDay(raw.periodStart) && isDay(raw.periodEnd) ? { periodStart: raw.periodStart, periodEnd: raw.periodEnd } : {}),
    overview: raw.overview,
    recurring: Array.isArray(raw.recurring)
      ? raw.recurring
          .filter((r) => r && typeof r.label === 'string' && typeof r.note === 'string')
          .map((r) => ({
            kind: PATTERN_KINDS.includes(r.kind) ? r.kind : 'theme',
            label: r.label,
            count: typeof r.count === 'number' ? r.count : 2,
            note: r.note,
          }))
      : [],
    changes: strings(raw.changes),
    questions: strings(raw.questions),
  };
}
