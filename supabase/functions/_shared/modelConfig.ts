// Keep Gemini models and their supported thinking levels together.
// Model availability reviewed against provider documentation on 2026-10-13.
// entryAnalysis moved from gemini-3.8-flash to gemini-4-hydrogen on
// 2026-11-22 (owner decision), keeping each request's thinking level.
// deepAnalysis is now only the fallback model of the ENABLE_AI_RETRY retries.
// The transcription model was added on 2026-11-16. It is a dedicated
// speech-to-text model served by the Interactions API (not generateContent)
// and takes no thinking level.
export const AI_MODELS = {
  suggestions: "gemini-3.5-flash-lite",
  entryAnalysis: "gemini-4-hydrogen",
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
    // Gemini 4 Hydrogen rejects MINIMAL; LOW suits short metadata extraction.
    thinkingLevel: "LOW",
  },
  [AI_MODELS.deepAnalysis]: {
    thinkingLevel: "HIGH",
  },
};

// Request types that reason across many entries or dreams think harder than
// their model's default. They run rarely (Trend Analysis once a week, Dream
// patterns twice a month), so the extra thinking tokens cost little (owner
// decision, 2026-11-21).
const THINKING_BY_TYPE: Readonly<Record<string, GoogleThinkingLevel>> = {
  analyzeTrends: "HIGH",
  analyzeDreamPatterns: "HIGH",
};

/** The thinking level a request type overrides its model's default with, if any. */
export function getThinkingLevelForType(type: string): GoogleThinkingLevel | undefined {
  return THINKING_BY_TYPE[type];
}

export function getModelForType(type: string): string {
  switch (type) {
    case "title":
    case "tags":
      return `google/${AI_MODELS.suggestions}`;
    // Trend Analysis moved from the deep-analysis model to entryAnalysis (owner
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
