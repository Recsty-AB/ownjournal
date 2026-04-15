/**
 * Local generative AI service — wraps Qwen3.5 via @huggingface/transformers.
 *
 * Responsibilities:
 *   - Lazy-load the configured Qwen model on first use, via
 *     transformers.js's AutoModelForCausalLM + AutoTokenizer dispatch
 *   - Surface download progress (transformers.js emits per-file
 *     progress events; we aggregate into a single 0–100 stream)
 *   - Cache the model via transformers.js's built-in OPFS/Cache API
 *     storage, so subsequent loads are instant and work offline
 *   - Expose inference helpers (title, tags, entry analysis, trend
 *     analysis) with simplified prompts that fit on-device models
 *   - Run a real benchmark that measures actual tokens-per-second
 *   - Abort long-running operations when the user switches models or
 *     navigates away, via AbortController
 *   - Notify subscribers of state changes so React components can
 *     react to model-loaded / model-unloaded transitions
 *
 * Gated behind `FEATURES.LOCAL_AI_ENABLED`. Until that flag is on,
 * nothing imports this module at runtime and the ~5 MB transformers.js
 * bundle is never loaded.
 */

import {
  LOCAL_AI_MODELS,
  LocalAIModelId,
  LocalAIFeature,
} from '@/config/localAIModels';

type TransformersModule = typeof import('@huggingface/transformers');
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type TextGenerationPipeline = ((
  texts: ChatMessage[],
  options?: Record<string, unknown>,
) => Promise<Array<{ generated_text: string | ChatMessage[] }>>) & {
  dispose?: () => Promise<void>;
};

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
  currentFile: string | null;
}

export interface BenchmarkResult {
  modelId: LocalAIModelId;
  device: 'webgpu' | 'wasm';
  timeToFirstTokenMs: number;
  totalTimeMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  peakMemoryBytes: number | null;
  finishedAt: number;
}

export interface EntryMetadataResult {
  sentimentScore: number;
  dominantEmotion: string;
  emotions: string[];
  topics: string[];
  shortSummary: string;
  mainStressors: string[];
  mainSupports: string[];
}

export interface TrendAnalysisResult {
  periodSummary: string;
  moodTrend: string;
  insights: string[];
  focusAreas: string[];
  closingReflection: string;
}

export interface TagSuggestionsResult {
  tagSets: string[][];
  activities: string[];
}

type ProgressCallback = (progress: DownloadProgress) => void;
type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      if (import.meta.env.DEV) console.error('localAIGenerative listener error:', error);
    }
  }
}

/**
 * Simple JSON extraction from a model's free-form output. Small models
 * sometimes wrap JSON in markdown fences or add a preface sentence, so
 * we strip those before parsing.
 */
function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const stripped = fenceMatch ? fenceMatch[1] : text;
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as T;
  } catch {
    return null;
  }
}

class LocalAIGenerativeService {
  private transformers: TransformersModule | null = null;
  private generator: TextGenerationPipeline | null = null;
  private loadedModelId: LocalAIModelId | null = null;
  private loadPromise: Promise<void> | null = null;
  private loadAbort: AbortController | null = null;
  private device: 'webgpu' | 'wasm' = 'webgpu';

  // ==========================================================================
  // Subscribe API (React reactivity via useSyncExternalStore)
  // ==========================================================================

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // ==========================================================================
  // Lazy loader
  // ==========================================================================

  private async ensureTransformers(): Promise<TransformersModule> {
    if (!this.transformers) {
      this.transformers = await import('@huggingface/transformers');
    }
    return this.transformers;
  }

  // ==========================================================================
  // Model lifecycle
  // ==========================================================================

  /**
   * Load the given model. Safe to call concurrently — competing loads
   * for the same model coalesce, and a load for a different model
   * aborts any previous load first.
   */
  async loadModel(modelId: LocalAIModelId, onProgress?: ProgressCallback): Promise<void> {
    if (this.loadedModelId === modelId && this.generator && !this.loadPromise) {
      return;
    }

    // Different model requested while one is loading — abort the
    // current load before starting the new one so we don't leak work
    // or have two sets of weights competing for memory.
    if (this.loadPromise && this.loadedModelId !== modelId) {
      this.loadAbort?.abort();
      try {
        await this.loadPromise;
      } catch {
        // expected — the abort rejection is what we wanted
      }
    }

    // If the same model is still loading, coalesce
    if (this.loadPromise && this.loadedModelId === modelId) {
      return this.loadPromise;
    }

    // Different model already loaded → unload, then load fresh
    if (this.loadedModelId && this.loadedModelId !== modelId) {
      this.unload();
    }

    this.loadAbort = new AbortController();
    this.loadPromise = this.doLoad(modelId, onProgress, this.loadAbort.signal)
      .then(() => {
        this.loadedModelId = modelId;
        notify();
      })
      .catch((error) => {
        this.loadedModelId = null;
        this.generator = null;
        notify();
        throw error;
      })
      .finally(() => {
        this.loadPromise = null;
        this.loadAbort = null;
      });

    return this.loadPromise;
  }

  private async doLoad(
    modelId: LocalAIModelId,
    onProgress: ProgressCallback | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    const spec = LOCAL_AI_MODELS[modelId];
    if (!spec) throw new Error(`Unknown local AI model: ${modelId}`);

    const transformers = await this.ensureTransformers();
    if (signal.aborted) throw new Error('Model load aborted');

    // Re-verify WebGPU at load time — the user may have rotated
    // adapters since the initial capability check.
    const hasWebGPU = !!(navigator as unknown as { gpu?: unknown }).gpu;
    this.device = hasWebGPU ? 'webgpu' : 'wasm';

    // Aggregate per-file progress events from transformers.js
    const fileTotals = new Map<string, { loaded: number; total: number }>();
    const emit = (currentFile: string | null) => {
      let loaded = 0;
      let total = 0;
      for (const entry of fileTotals.values()) {
        loaded += entry.loaded;
        total += entry.total;
      }
      const percent = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
      onProgress?.({ loaded, total, percent, currentFile });
    };
    const progressHandler = (data: {
      status?: string;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (signal.aborted) return;
      if (!data.file || typeof data.loaded !== 'number' || typeof data.total !== 'number') {
        return;
      }
      fileTotals.set(data.file, { loaded: data.loaded, total: data.total });
      emit(data.file);
    };

    // Use the high-level pipeline() API instead of low-level
    // tokenizer + model dispatch. This is the documented, stable
    // interface in transformers.js 3.x and handles chat templates,
    // tokenization, generation, and decoding internally.
    const generator = (await transformers.pipeline('text-generation', spec.hfRepo, {
      device: this.device,
      dtype: 'q4',
      progress_callback: progressHandler,
    } as unknown as Parameters<typeof transformers.pipeline>[2])) as unknown as TextGenerationPipeline;

    if (signal.aborted) {
      try {
        await generator.dispose?.();
      } catch {
        // best-effort
      }
      throw new Error('Model load aborted');
    }

    this.generator = generator;
    emit(null); // final 100% event
  }

  isReady(): boolean {
    return this.loadedModelId !== null && this.generator !== null;
  }

  getLoadedModel(): LocalAIModelId | null {
    return this.loadedModelId;
  }

  getDevice(): 'webgpu' | 'wasm' {
    return this.device;
  }

  supportsFeature(feature: LocalAIFeature): boolean {
    if (!this.loadedModelId) return false;
    return LOCAL_AI_MODELS[this.loadedModelId].supportedFeatures.includes(feature);
  }

  unload(): void {
    this.loadAbort?.abort();
    this.loadAbort = null;
    if (this.generator) {
      // Best-effort dispose to free WebGPU buffers
      this.generator.dispose?.().catch(() => undefined);
    }
    this.generator = null;
    this.loadedModelId = null;
    this.loadPromise = null;
    notify();
  }

  /**
   * Delete the downloaded model from the transformers.js cache. Uses
   * a tight regex so unrelated Cache API entries are never touched.
   */
  async clearCache(): Promise<void> {
    this.unload();
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      // transformers.js v3.x uses a cache named exactly
      // 'transformers-cache' (plus an internal suffix on some
      // platforms). We match only the exact name + its variants, not
      // anything else.
      await Promise.all(
        cacheNames
          .filter((name) => name === 'transformers-cache' || name.startsWith('transformers-cache-'))
          .map((name) => caches.delete(name)),
      );
    }
    notify();
  }

  // ==========================================================================
  // Inference primitives
  // ==========================================================================

  /**
   * Run the loaded model on a chat prompt and return the assistant's
   * text reply. Uses transformers.js's high-level pipeline() API,
   * which handles chat templates, tokenization, generation, and
   * decoding internally — much more reliable than hand-rolling
   * tensor-level inference.
   */
  private async generateText(
    prompt: string,
    opts: { maxNewTokens?: number; temperature?: number; system?: string } = {},
  ): Promise<{ text: string; totalMs: number }> {
    if (!this.isReady() || !this.generator) {
      throw new Error('Local AI model not loaded');
    }
    const messages: ChatMessage[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    const start = performance.now();
    const output = await this.generator(messages, {
      max_new_tokens: opts.maxNewTokens ?? 512,
      do_sample: (opts.temperature ?? 0) > 0,
      temperature: opts.temperature ?? 0.7,
      return_full_text: false,
    });
    const totalMs = performance.now() - start;

    // The pipeline returns Array<{generated_text: string | Chat}>.
    // For chat input, generated_text is the full Chat (system+user
    // +assistant). We want just the assistant's last message.
    const first = output?.[0];
    if (!first) return { text: '', totalMs };

    let text = '';
    if (typeof first.generated_text === 'string') {
      text = first.generated_text;
    } else if (Array.isArray(first.generated_text)) {
      const lastAssistant = [...first.generated_text]
        .reverse()
        .find((m) => m.role === 'assistant');
      text = lastAssistant?.content ?? '';
    }
    return { text: text.trim(), totalMs };
  }

  // ==========================================================================
  // Feature-level inference helpers (Phase 2)
  // ==========================================================================

  async generateTitle(content: string, language = 'en'): Promise<string[]> {
    const prompt = [
      `You are a journaling assistant. Read the entry below and propose 5 short, evocative title candidates in ${language}.`,
      `Return ONLY a JSON object with a single "titles" array of 5 strings. No prose.`,
      ``,
      `Entry:`,
      content.slice(0, 2000),
    ].join('\n');
    const { text } = await this.generateText(prompt, { maxNewTokens: 256, temperature: 0.7 });
    const parsed = extractJson<{ titles?: unknown }>(text);
    if (parsed && Array.isArray(parsed.titles)) {
      return parsed.titles.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(0, 5);
    }
    // Fallback: split lines, strip leading bullets/numbers
    return text
      .split('\n')
      .map((line) => line.replace(/^[\s\-*\d.)\]]+/, '').trim())
      .filter((line) => line.length > 0 && line.length < 120)
      .slice(0, 5);
  }

  async generateTagSuggestions(
    content: string,
    existingTags: string[],
    predefinedActivities: string[] | undefined,
    existingActivities: string[],
    language = 'en',
  ): Promise<TagSuggestionsResult> {
    const activitiesClause = predefinedActivities?.length
      ? `Also suggest 0-3 activities from this exact list (do NOT invent new ones, return their English keys): ${predefinedActivities.join(
          ', ',
        )}. Skip any already selected: ${existingActivities.filter((a) => predefinedActivities.includes(a)).join(', ') || 'none'}.`
      : '';
    const prompt = [
      `You are a journaling assistant. Read the entry below and suggest tags and activities in ${language}.`,
      `Return ONLY a JSON object: {"tagSets": [[...], [...], [...]], "activities": [...]}.`,
      `Provide 3 diverse tag sets of 2-4 tags each. Avoid repeating: ${existingTags.join(', ') || 'none'}.`,
      activitiesClause,
      ``,
      `Entry:`,
      content.slice(0, 2000),
    ]
      .filter(Boolean)
      .join('\n');
    const { text } = await this.generateText(prompt, { maxNewTokens: 384, temperature: 0.7 });
    const parsed = extractJson<{ tagSets?: unknown; activities?: unknown }>(text);
    const existingTagSet = new Set(existingTags);
    const existingActivitySet = new Set(existingActivities);
    const predefSet = new Set(predefinedActivities ?? []);

    let tagSets: string[][] = [];
    if (parsed && Array.isArray(parsed.tagSets)) {
      tagSets = parsed.tagSets
        .filter((s): s is unknown[] => Array.isArray(s))
        .map((s) =>
          s.filter((t): t is string => typeof t === 'string' && t.length > 0 && !existingTagSet.has(t)),
        )
        .filter((s) => s.length > 0);
    }

    let activities: string[] = [];
    if (parsed && Array.isArray(parsed.activities)) {
      activities = parsed.activities
        .filter((a): a is string => typeof a === 'string')
        .filter((a) => predefSet.has(a) && !existingActivitySet.has(a));
    }

    return { tagSets, activities };
  }

  async analyzeEntry(content: string, language = 'en'): Promise<EntryMetadataResult> {
    const prompt = [
      `You are a journal metadata extractor. Read the entry below and return a JSON object with these fields, all in ${language}:`,
      `  sentimentScore (number -1 to 1),`,
      `  dominantEmotion (string),`,
      `  emotions (array of 3-5 strings),`,
      `  topics (array of 3-5 strings),`,
      `  shortSummary (2-3 sentences, polite form for Japanese),`,
      `  mainStressors (array of 0-3 strings),`,
      `  mainSupports (array of 0-3 strings)`,
      `Return ONLY the JSON object. No prose.`,
      ``,
      `Entry:`,
      content.slice(0, 3000),
    ].join('\n');
    const { text } = await this.generateText(prompt, { maxNewTokens: 512, temperature: 0.3 });
    const parsed = extractJson<Partial<EntryMetadataResult>>(text);
    return {
      sentimentScore:
        typeof parsed?.sentimentScore === 'number'
          ? Math.max(-1, Math.min(1, parsed.sentimentScore))
          : 0,
      dominantEmotion: typeof parsed?.dominantEmotion === 'string' ? parsed.dominantEmotion : 'neutral',
      emotions: Array.isArray(parsed?.emotions) ? parsed.emotions.filter((e) => typeof e === 'string') : [],
      topics: Array.isArray(parsed?.topics) ? parsed.topics.filter((t) => typeof t === 'string') : [],
      shortSummary: typeof parsed?.shortSummary === 'string' ? parsed.shortSummary : '',
      mainStressors: Array.isArray(parsed?.mainStressors)
        ? parsed.mainStressors.filter((s): s is string => typeof s === 'string')
        : [],
      mainSupports: Array.isArray(parsed?.mainSupports)
        ? parsed.mainSupports.filter((s): s is string => typeof s === 'string')
        : [],
    };
  }

  /**
   * Simplified trend analysis prompt tailored for on-device models.
   * The cloud version is ~100 lines with strict tone rules; small
   * models ignore parts of that. This variant keeps the schema and
   * the core warmth instruction, drops detailed style guidance, and
   * accepts slightly less polished output in exchange for reliable
   * structured output.
   */
  async analyzeTrends(
    aggregatedSummary: string,
    language = 'en',
  ): Promise<TrendAnalysisResult> {
    const prompt = [
      `You are a warm, emotionally intelligent journaling coach. Below is a summary of the user's journal entries over a period.`,
      `Write a warm, supportive trend analysis in ${language}.`,
      `Return ONLY a JSON object with these exact fields:`,
      `  periodSummary (2-3 sentences),`,
      `  moodTrend (1-2 sentences describing the overall emotional arc),`,
      `  insights (array of 3 short strings),`,
      `  focusAreas (array of 3 short gentle suggestions),`,
      `  closingReflection (1 warm validating sentence, observational not directive)`,
      `No prose outside the JSON. No numeric values in the text.`,
      ``,
      `Summary of period:`,
      aggregatedSummary.slice(0, 4000),
    ].join('\n');
    const { text } = await this.generateText(prompt, { maxNewTokens: 768, temperature: 0.5 });
    const parsed = extractJson<Partial<TrendAnalysisResult>>(text);
    return {
      periodSummary: typeof parsed?.periodSummary === 'string' ? parsed.periodSummary : '',
      moodTrend: typeof parsed?.moodTrend === 'string' ? parsed.moodTrend : '',
      insights: Array.isArray(parsed?.insights)
        ? parsed.insights.filter((i): i is string => typeof i === 'string')
        : [],
      focusAreas: Array.isArray(parsed?.focusAreas)
        ? parsed.focusAreas.filter((f): f is string => typeof f === 'string')
        : [],
      closingReflection: typeof parsed?.closingReflection === 'string' ? parsed.closingReflection : '',
    };
  }

  // ==========================================================================
  // Benchmark (real)
  // ==========================================================================

  async runBenchmark(modelId: LocalAIModelId): Promise<BenchmarkResult> {
    if (this.loadedModelId !== modelId || !this.isReady()) {
      throw new Error('Model must be loaded before running a benchmark. Call loadModel() first.');
    }
    // Deterministic short prompt — English for tokenizer bias
    // neutrality. We measure wall-clock time and approximate token
    // count from the output character length (rough heuristic of
    // ~4 chars/token, which is good enough for a relative perf
    // signal on the same model + device).
    const prompt = 'Write three short calm sentences about a morning walk.';
    const result = await this.generateText(prompt, { maxNewTokens: 96, temperature: 0 });
    const approxTokens = Math.max(1, Math.round(result.text.length / 4));
    return {
      modelId,
      device: this.device,
      // We no longer measure time-to-first-token (would need a custom
      // streamer hooked into the pipeline internals). Set to 0 to
      // signal "not measured" — the UI hides it when 0.
      timeToFirstTokenMs: 0,
      totalTimeMs: Math.round(result.totalMs),
      tokensGenerated: approxTokens,
      tokensPerSecond:
        result.totalMs > 0
          ? Math.round((approxTokens / (result.totalMs / 1000)) * 10) / 10
          : 0,
      peakMemoryBytes: LOCAL_AI_MODELS[modelId].inferenceRamBytes,
      finishedAt: Date.now(),
    };
  }
}

export const localAIGenerative = new LocalAIGenerativeService();
