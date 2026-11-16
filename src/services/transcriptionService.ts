/**
 * Voice entry: sends a recorded clip to the ai-transcribe edge function
 * (gemini-3.5-transcribe) and returns the cleaned-up transcript.
 *
 * The audio only ever lives in memory on the client and is never written to
 * IndexedDB, localStorage or the user's cloud storage. The returned text is
 * inserted into the entry and saved through the normal (encrypted) path.
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeWithRetry } from '@/utils/edgeFunctionRetry';
import { scopedKey } from '@/utils/userScope';

// Keep in sync with supabase/functions/ai-transcribe/transcriptionConfig.ts.
// The server enforces these; the client uses them to auto-stop recordings
// and show how many minutes are left.
export const TRANSCRIPTION_LIMITS = {
  monthlySeconds: 200 * 60,
  maxClipSeconds: 5 * 60,
} as const;

export type TranscriptionErrorCode =
  | 'offline'
  | 'authRequired'
  | 'plusRequired'
  | 'limitReached'
  | 'tooLarge'
  | 'unsupportedFormat'
  | 'failed';

export class TranscriptionError extends Error {
  constructor(readonly code: TranscriptionErrorCode) {
    super(code);
    this.name = 'TranscriptionError';
  }
}

export interface TranscriptionResult {
  text: string;
  monthlySecondsUsed: number;
}

export interface TranscribeParams {
  blob: Blob;
  durationSeconds: number;
  language: string;
}

const CONSENT_KEY = 'voice-transcription-consent';

export function hasVoiceConsent(): boolean {
  try {
    return localStorage.getItem(scopedKey(CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export function setVoiceConsent(): void {
  try {
    localStorage.setItem(scopedKey(CONSENT_KEY), 'true');
  } catch {
    // Consent is asked again next time if storage is unavailable.
  }
}

function statusToCode(status: number | undefined): TranscriptionErrorCode {
  switch (status) {
    case 401:
      return 'authRequired';
    case 403:
      return 'plusRequired';
    case 413:
      return 'tooLarge';
    case 415:
      return 'unsupportedFormat';
    case 429:
      return 'limitReached';
    default:
      return 'failed';
  }
}

export async function transcribeAudio({ blob, durationSeconds, language }: TranscribeParams): Promise<TranscriptionResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new TranscriptionError('offline');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new TranscriptionError('authRequired');
  }

  const form = new FormData();
  form.append('audio', blob, 'recording');
  form.append('mimeType', blob.type);
  form.append('durationSeconds', String(Math.round(durationSeconds)));
  form.append('language', language);

  const { data, error } = await invokeWithRetry<{ text?: string; monthlySecondsUsed?: number }>(
    supabase,
    'ai-transcribe',
    {
      body: form,
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );

  if (error) {
    const status = (error as { context?: { status?: number } })?.context?.status;
    if (import.meta.env.DEV) {
      console.error('[transcription] ai-transcribe failed with status', status);
    }
    throw new TranscriptionError(statusToCode(status));
  }

  if (!data || typeof data.text !== 'string') {
    throw new TranscriptionError('failed');
  }

  return {
    text: data.text,
    monthlySecondsUsed: Number(data.monthlySecondsUsed ?? 0),
  };
}

/**
 * Seconds of voice entry used this calendar month (UTC, matching the edge
 * function). Returns null when it can't be determined (offline, signed out);
 * callers then fall back to the per-clip cap and let the server decide.
 */
export async function getMonthlySecondsUsed(): Promise<number | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data, error } = await supabase
      .from('ai_usage_stats')
      .select('audio_seconds')
      .eq('user_id', user.id)
      .eq('analysis_type', 'transcription')
      .gte('created_at', startOfMonth);

    if (error || !data) return null;
    return data.reduce((sum, row) => sum + (row.audio_seconds ?? 0), 0);
  } catch {
    return null;
  }
}

/**
 * Inserts dictated text at the given selection, adding a space on either side
 * when the neighbouring text would otherwise run into it.
 */
export function insertTranscript(
  value: string,
  transcript: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; caret: number } {
  const text = transcript.trim();
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  if (!text) return { value, caret: end };

  const before = value.slice(0, start);
  const after = value.slice(end);
  const leading = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const trailing = after.length > 0 && !/^\s/.test(after) ? ' ' : '';
  const inserted = `${leading}${text}${trailing}`;
  return {
    value: `${before}${inserted}${after}`,
    caret: before.length + leading.length + text.length,
  };
}
