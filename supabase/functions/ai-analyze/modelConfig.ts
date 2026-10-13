// Keep Gemini models and their supported thinking levels together.
// Model availability reviewed against provider documentation on 2026-10-13.
export const AI_MODELS = {
  suggestions: "gemini-3.5-flash-lite",
  entryAnalysis: "gemini-3.8-flash",
  deepAnalysis: "gemini-3.1-pro-preview",
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
    case "analyzeTrends":
      return `google/${AI_MODELS.deepAnalysis}`;
    default:
      return `google/${AI_MODELS.entryAnalysis}`;
  }
}
