/**
 * Voice entry: transcribes a short audio clip with gemini-3.5-transcribe.
 *
 * Privacy: the audio and the transcript are never stored or logged here.
 * Only the billed duration is written to ai_usage_stats. The Gemini call is
 * made with store=false so Google does not retain the interaction either.
 *
 * Request: multipart/form-data with
 *   audio            - the recording (Blob)
 *   durationSeconds  - client-measured duration
 *   language         - UI language (only used to pick the Chinese script)
 * Response: { text, secondsUsed, monthlySecondsUsed, monthlyLimitSeconds }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { AI_MODELS } from "../_shared/modelConfig.ts";
import { transcribeWithGemini, TranscriptionProviderError } from "./geminiTranscribe.ts";
import { needsTraditionalChinese, toTraditionalChinese } from "./chineseScript.ts";
import {
  billableSeconds,
  MAX_AUDIO_BYTES,
  MONTHLY_LIMIT_SECONDS,
  toGeminiMimeType,
} from "./transcriptionConfig.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized - Please sign in" }, 401);
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return json({ error: "Unauthorized - Please sign in" }, 401);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Expected multipart/form-data with an audio file" }, 400);
    }

    const entry = form.get("audio");
    // Duck-typed rather than `instanceof Blob`, which breaks across realms.
    const audio = typeof entry === "object" && entry !== null && typeof (entry as Blob).arrayBuffer === "function"
      ? (entry as Blob)
      : null;
    if (!audio || audio.size === 0) {
      return json({ error: "Missing audio" }, 400);
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return json({ error: "Recording is too large", code: "tooLarge" }, 413);
    }

    const geminiMimeType = toGeminiMimeType(audio.type || String(form.get("mimeType") ?? ""));
    if (!geminiMimeType) {
      return json({ error: "Unsupported audio format", code: "unsupportedFormat" }, 415);
    }

    const language = String(form.get("language") ?? "");
    const seconds = billableSeconds(Number(form.get("durationSeconds")), audio.size);

    // Same summary RPC as ai-analyze; it applies the subscription-expiry rule.
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const { data: usageSummary, error: usageError } = await supabaseClient.rpc("get_ai_usage_summary", {
      p_user_id: user.id,
      p_start_of_month: startOfMonth.toISOString(),
      p_start_of_week: startOfWeek.toISOString(),
      p_start_of_year: startOfYear.toISOString(),
    });
    if (usageError) {
      console.error("[ai-transcribe] Usage summary failed:", usageError.message);
      return json({ error: "Failed to check usage limits" }, 500);
    }

    const summary = usageSummary?.[0];
    if (!summary?.is_pro) {
      return json({ error: "Plus subscription required for voice entry", code: "plusRequired" }, 403);
    }

    const usedSeconds = Number(summary.monthly_transcription_seconds ?? 0);
    // Reject only once the limit is reached; the clip that crosses it is
    // allowed (at most MAX_CLIP_SECONDS over), so nobody loses a recording.
    if (usedSeconds >= MONTHLY_LIMIT_SECONDS) {
      return json({
        error: "Monthly voice entry limit reached",
        code: "limitReached",
        monthlySecondsUsed: usedSeconds,
        monthlyLimitSeconds: MONTHLY_LIMIT_SECONDS,
      }, 429);
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    let text = await transcribeWithGemini(new Uint8Array(await audio.arrayBuffer()), geminiMimeType, apiKey);

    if (text && needsTraditionalChinese(language)) {
      try {
        text = await toTraditionalChinese(text);
      } catch (error) {
        console.warn("[ai-transcribe] Traditional Chinese conversion unavailable:", error instanceof Error ? error.message : error);
      }
    }

    // Bill only successful transcriptions. Awaited (unlike ai-analyze) so the
    // next request's quota check sees it.
    const { error: insertError } = await supabaseClient.from("ai_usage_stats").insert({
      user_id: user.id,
      analysis_type: "transcription",
      audio_seconds: seconds,
      model_used: AI_MODELS.transcription,
    });
    if (insertError) {
      console.error("[ai-transcribe] Recording usage failed:", insertError.message);
    }

    // Log sizes and timings only - never the transcript.
    console.log(`[ai-transcribe] ok seconds=${seconds} bytes=${audio.size} mime=${geminiMimeType} chars=${text.length} total=${Date.now() - startedAt}ms`);

    return json({
      text,
      secondsUsed: seconds,
      monthlySecondsUsed: usedSeconds + seconds,
      monthlyLimitSeconds: MONTHLY_LIMIT_SECONDS,
    });
  } catch (error) {
    if (error instanceof TranscriptionProviderError) {
      console.error(`[ai-transcribe] ${error.message}`);
      if (error.retryable) {
        return json({ error: "Transcription service temporarily unavailable", retryable: true }, 503);
      }
      return json({ error: "Transcription failed" }, 502);
    }
    console.error("[ai-transcribe] Error:", error instanceof Error ? error.message : error);
    return json({ error: "Transcription failed" }, 500);
  }
});
