/**
 * Calls gemini-3.5-transcribe through the Gemini Interactions API.
 *
 * - `mode: "smart"` removes filler words and self-corrections and adds
 *   punctuation, casing and paragraphs ("light cleanup").
 * - `language_codes` is intentionally omitted: the model then auto-detects
 *   the spoken language, including mid-sentence code-switching. Passing the
 *   UI locale would risk constraining it to that language.
 * - `store: false` is REQUIRED. The Interactions API otherwise keeps every
 *   interaction (including the audio) server-side for 55 days.
 */

import { AI_MODELS } from "../_shared/modelConfig.ts";

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const REQUEST_TIMEOUT_MS = 120_000;

export class TranscriptionProviderError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message);
    this.name = "TranscriptionProviderError";
  }
}

/** Base64-encodes bytes without blowing the call stack on multi-MB inputs. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

interface InteractionContent {
  type?: string;
  text?: string;
}

interface InteractionResponse {
  status?: string;
  output_text?: string;
  outputs?: InteractionContent[];
  steps?: Array<{ type?: string; content?: InteractionContent[] }>;
  error?: { message?: string };
}

/**
 * Extracts the transcript. `output_text` is the documented convenience field;
 * the step/output walk is a fallback in case the REST payload only carries
 * the structured form.
 */
export function extractTranscript(response: InteractionResponse): string {
  if (typeof response.output_text === "string") return response.output_text.trim();

  const parts: string[] = [];
  for (const step of response.steps ?? []) {
    if (step.type && step.type !== "model_output") continue;
    for (const item of step.content ?? []) {
      if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
    }
  }
  if (parts.length === 0) {
    for (const item of response.outputs ?? []) {
      if (item.type === "text" && typeof item.text === "string") parts.push(item.text);
    }
  }
  return parts.join("").trim();
}

export async function transcribeWithGemini(
  audio: Uint8Array,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${AI_MODELS.transcription}`,
        input: [{ type: "audio", data: bytesToBase64(audio), mime_type: mimeType }],
        generation_config: {
          transcription_config: { mode: "smart" },
        },
        store: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TranscriptionProviderError(`Transcription request failed: ${message}`, 503, true);
  }

  if (!response.ok) {
    let providerMessage = "";
    try {
      providerMessage = ((await response.json()) as InteractionResponse)?.error?.message ?? "";
    } catch {
      // ignore unparseable error bodies
    }
    const retryable = response.status === 429 || response.status >= 500;
    throw new TranscriptionProviderError(
      `Gemini transcription error ${response.status}${providerMessage ? `: ${providerMessage}` : ""}`,
      response.status,
      retryable,
    );
  }

  const data = (await response.json()) as InteractionResponse;
  if (data.status && data.status !== "completed") {
    throw new TranscriptionProviderError(`Transcription did not complete (status: ${data.status})`, 502, true);
  }
  return extractTranscript(data);
}
