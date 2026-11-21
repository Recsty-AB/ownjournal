// Keep Gemini models and their supported thinking levels together.
// Model availability reviewed against provider documentation on 2026-10-13.
// deepAnalysis is now only the fallback model of the ENABLE_AI_RETRY retries.
// The transcription model was added on 2026-11-16. It is a dedicated
// speech-to-text model served by the Interactions API (not generateContent)
// and takes no thinking level.
export const AI_MODELS = {
  suggestions: "gemini-3.5-flash-lite",
  entryAnalysis: "gemini-3.8-flash",
  deepAnalysis: "gemini-3.1-pro-preview",
  transcription: "gemini-3.5-transcribe",
} as const;

export type GoogleThinkingLevel = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

export const AI_MODEL_SETTINGS: Readonly<Record<string, {
  thinkingLevel: GoogleThinkingLevel;
}>> = {
  [AI_MODELS.suggestions]: {
    thinkingLevel: "MINIMAL",
  },
  [AI_MODELS.entryAnalysis]: {
    // Gemini 3.8 does not support MINIMAL; LOW suits short metadata extraction.
    thinkingLevel: "LOW",
  },
  [AI_MODELS.deepAnalysis]: {
    thinkingLevel: "HIGH",
  },
};

export function getModelForType(type: string): string {
  switch (type) {
    case "title":
    case "tags":
      return `google/${AI_MODELS.suggestions}`;
    // Trend Analysis moved from the deep-analysis model to Flash (owner
    // decision, 2026-11-21), along with dreams joining it.
    case "analyzeTrends":
    // Dream reflection starts on the entry-analysis model (owner decision,
    // 2026-11-19); move it here only after comparing quality and cost.
    case "analyzeDream":
    case "analyzeDreamPatterns":
      return `google/${AI_MODELS.entryAnalysis}`;
    default:
      return `google/${AI_MODELS.entryAnalysis}`;
  }
}
