/**
 * AI Mode Storage
 * Manages user preference for AI mode (local vs cloud)
 */

export type AIMode = 'local' | 'cloud';
export type ModelType = 'lightweight' | 'multilingual';

const AI_MODE_KEY = 'ai-mode-preference';
const CLOUD_CONSENT_KEY = 'ai-cloud-consent';
const PRELOAD_ENABLED_KEY = 'ai-preload-enabled';
const MODEL_TYPE_KEY = 'ai-model-type';

export const aiModeStorage = {
  getMode(): AIMode {
    // Always return 'cloud' mode - local mode removed
    return 'cloud';
  },

  setMode(mode: AIMode): void {
    // Keep for compatibility but force cloud mode
    localStorage.setItem(AI_MODE_KEY, 'cloud');
  },

  hasCloudConsent(): boolean {
    return localStorage.getItem(CLOUD_CONSENT_KEY) === 'true';
  },

  setCloudConsent(consented: boolean): void {
    localStorage.setItem(CLOUD_CONSENT_KEY, consented ? 'true' : 'false');
  },

  clearConsent(): void {
    localStorage.removeItem(CLOUD_CONSENT_KEY);
    this.setMode('local');
  },

  isPreloadEnabled(): boolean {
    const stored = localStorage.getItem(PRELOAD_ENABLED_KEY);
    // Default to true if not set
    return stored === null ? true : stored === 'true';
  },

  setPreloadEnabled(enabled: boolean): void {
    localStorage.setItem(PRELOAD_ENABLED_KEY, enabled ? 'true' : 'false');
  },

  getModelType(): ModelType {
    return (localStorage.getItem(MODEL_TYPE_KEY) as ModelType) || 'multilingual';
  },

  setModelType(type: ModelType): void {
    localStorage.setItem(MODEL_TYPE_KEY, type);
  }
};
