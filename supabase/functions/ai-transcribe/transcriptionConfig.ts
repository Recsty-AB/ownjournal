// Limits for voice entry. Keep in sync with TRANSCRIPTION_LIMITS in
// src/services/transcriptionService.ts (the client uses them for UX hints;
// this function is the enforcer).
export const MONTHLY_LIMIT_SECONDS = 200 * 60;
export const MAX_CLIP_SECONDS = 5 * 60;

// A 5-minute clip is ~1.2 MB at the 32 kbps the client requests. Safari may
// ignore the bitrate hint and record AAC at up to ~128 kbps (~4.8 MB), so
// 10 MB leaves headroom without letting oversized uploads through.
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// The client reports the clip duration. To stop an under-reported duration
// from stretching the quota, bill at least the duration implied by the file
// size at a generous upper-bound bitrate (128 kbps = 16 000 bytes/s).
export const MAX_PLAUSIBLE_BYTES_PER_SECOND = 16_000;

// MIME types accepted by gemini-3.5-transcribe, keyed by what browsers'
// MediaRecorder reports. Safari/WKWebView record AAC in an MP4 container,
// which is the M4A format Gemini lists; Gemini does not list audio/mp4.
const MIME_TYPE_MAP: Record<string, string> = {
  "audio/webm": "audio/webm",
  "audio/ogg": "audio/ogg",
  "audio/opus": "audio/opus",
  "audio/mp4": "audio/m4a",
  "audio/m4a": "audio/m4a",
  "audio/x-m4a": "audio/m4a",
  "audio/aac": "audio/aac",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mp3",
  "audio/wav": "audio/wav",
};

/** Maps a recorder MIME type (e.g. "audio/webm;codecs=opus") to a Gemini MIME type, or null if unsupported. */
export function toGeminiMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return MIME_TYPE_MAP[base] ?? null;
}

/** Seconds to bill for a clip, clamped to [1, MAX_CLIP_SECONDS]. */
export function billableSeconds(reportedSeconds: number, byteLength: number): number {
  const reported = Number.isFinite(reportedSeconds) ? reportedSeconds : 0;
  const sizeFloor = byteLength / MAX_PLAUSIBLE_BYTES_PER_SECOND;
  return Math.min(MAX_CLIP_SECONDS, Math.max(1, Math.ceil(Math.max(reported, sizeFloor))));
}
