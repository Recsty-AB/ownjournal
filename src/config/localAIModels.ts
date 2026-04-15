/**
 * Local AI model registry.
 *
 * Single source of truth for every on-device model OwnJournal ships.
 * UI, capability detection, download service, and inference service
 * all read from this file, so adding / updating a model is a one-file
 * change.
 *
 * Current baseline: Qwen3.5 (Alibaba, March 2026), a hybrid Gated
 * Delta Networks + sparse MoE architecture engineered specifically
 * for on-device inference. Strong multilingual coverage including
 * all 21 UI locales, with CJK languages (Japanese, Chinese, Korean)
 * as first-class citizens rather than an afterthought.
 *
 * See docs/LOCAL_AI.md for rationale, tier decisions, and device
 * requirements.
 */

export type LocalAIModelId = 'qwen3.5-4b' | 'qwen3.5-9b';

export type LocalAIPlatform = 'mobile' | 'desktop';

export interface LocalAIModelSpec {
  /** Opaque id used everywhere else in the app */
  id: LocalAIModelId;
  /** HuggingFace repository path used by transformers.js */
  hfRepo: string;
  /** Human-readable display name for the Settings UI */
  displayName: string;
  /** Marketing-facing tier label ("Normal" / "Advanced") */
  tierLabel: string;
  /** Approximate download size in bytes (Q4 quantized ONNX) */
  downloadSizeBytes: number;
  /** Approximate disk footprint after download (same as download for ONNX) */
  diskSizeBytes: number;
  /** Peak RAM during inference (weights + KV cache + activations) */
  inferenceRamBytes: number;
  /** Minimum total system RAM to safely run this model */
  requiredSystemRamBytes: number;
  /** WebGPU is mandatory — WASM fallback is too slow at these sizes */
  requiresWebGPU: true;
  /** Platforms this model is offered on */
  supportedPlatforms: LocalAIPlatform[];
  /** Rough inference speed per platform (tokens per second, q4 WebGPU) */
  tokensPerSecondEstimate: Partial<Record<LocalAIPlatform, number>>;
  /** Rough quality vs cloud baseline (0.0 - 1.0). For informational use. */
  qualityEstimate: number;
  /** Which features this model supports locally */
  supportedFeatures: LocalAIFeature[];
}

export type LocalAIFeature =
  | 'sentiment'
  | 'keywords'
  | 'activities'
  | 'titleSuggestion'
  | 'tagSuggestion'
  | 'entryAnalysis'
  | 'trendAnalysis';

export const LOCAL_AI_MODELS: Record<LocalAIModelId, LocalAIModelSpec> = {
  'qwen3.5-4b': {
    id: 'qwen3.5-4b',
    hfRepo: 'onnx-community/Qwen3.5-4B-ONNX',
    displayName: 'Qwen 3.5 — 4B',
    tierLabel: 'Normal',
    downloadSizeBytes: 2_500_000_000, // ~2.5 GB
    diskSizeBytes: 2_500_000_000,
    inferenceRamBytes: 4_000_000_000, // ~4 GB peak
    requiredSystemRamBytes: 6_000_000_000, // 6 GB minimum
    requiresWebGPU: true,
    supportedPlatforms: ['mobile', 'desktop'],
    tokensPerSecondEstimate: { mobile: 20, desktop: 35 },
    qualityEstimate: 0.85,
    supportedFeatures: [
      'sentiment',
      'keywords',
      'activities',
      'titleSuggestion',
      'tagSuggestion',
      'entryAnalysis',
      'trendAnalysis',
    ],
  },
  'qwen3.5-9b': {
    id: 'qwen3.5-9b',
    hfRepo: 'onnx-community/Qwen3.5-9B-Onnx',
    displayName: 'Qwen 3.5 — 9B',
    tierLabel: 'Advanced',
    downloadSizeBytes: 5_500_000_000, // ~5.5 GB
    diskSizeBytes: 5_500_000_000,
    inferenceRamBytes: 8_000_000_000, // ~8 GB peak
    requiredSystemRamBytes: 16_000_000_000, // 16 GB minimum
    requiresWebGPU: true,
    supportedPlatforms: ['desktop'], // desktop only
    tokensPerSecondEstimate: { desktop: 50 },
    qualityEstimate: 0.95,
    supportedFeatures: [
      'sentiment',
      'keywords',
      'activities',
      'titleSuggestion',
      'tagSuggestion',
      'entryAnalysis',
      'trendAnalysis',
    ],
  },
};

/**
 * Default model for a platform. 4B is the minimum baseline on both
 * platforms — we do not offer a smaller fallback tier. Devices that
 * cannot run 4B are routed to the cloud path instead.
 */
export function getDefaultModelForPlatform(platform: LocalAIPlatform): LocalAIModelId {
  return 'qwen3.5-4b';
}

/**
 * Models available on this platform, in offered order (simplest first).
 */
export function getModelsForPlatform(platform: LocalAIPlatform): LocalAIModelSpec[] {
  return Object.values(LOCAL_AI_MODELS).filter((m) =>
    m.supportedPlatforms.includes(platform),
  );
}

/**
 * Format bytes as a human-readable size string in GB with one decimal.
 * Used throughout the Settings UI.
 */
export function formatModelSize(bytes: number): string {
  const gb = bytes / 1_000_000_000;
  return `${gb.toFixed(1)} GB`;
}
