import { pipeline, env } from '@huggingface/transformers';
import { aiModeStorage, ModelType } from '@/utils/aiModeStorage';

// Configure transformers.js
env.backends.onnx.wasm.proxy = false;

interface AnalysisResult {
  summary: string;
  sentiment: string;
  keywords: string[];
  suggestedTitle: string;
  suggestedTags?: string[];
}

interface TrendResult {
  emotionalTrends: Array<{ trend: string; description: string }>;
  recurringThemes: string[];
  growthIndicators: string[];
  insights: string[];
  recommendations: string[];
}

/**
 * Check if WebGPU is available in the current browser
 */
async function isWebGPUAvailable(): Promise<boolean> {
  // Type guard for WebGPU support
  if (!('gpu' in navigator)) return false;
  
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) return false;
    
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

class LocalAIService {
  private summarizer: any = null;
  private classifier: any = null;
  private _isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private device: 'webgpu' | 'wasm' = 'wasm'; // Default to wasm for compatibility
  private modelsCached: boolean = false;
  private currentModelType: ModelType | null = null;

  async initialize(onProgress?: (status: string, progress: number) => void) {
    const selectedModelType = aiModeStorage.getModelType();
    
    // If models are loaded but type changed, clear and reload
    if (this.summarizer && this.classifier && this.currentModelType === selectedModelType) {
      return;
    }
    
    if (this.currentModelType && this.currentModelType !== selectedModelType) {
      console.log(`Model type changed from ${this.currentModelType} to ${selectedModelType}, reloading...`);
      await this.clearModelCache();
    }
    
    if (this.initPromise) return this.initPromise;

    this._isInitializing = true;
    this.currentModelType = selectedModelType;
    this.initPromise = this.doInitialize(onProgress)
      .then(() => {
        this._isInitializing = false;
        this.modelsCached = true;
      })
      .catch((error) => {
        this._isInitializing = false;
        this.initPromise = null; // Allow retry
        this.currentModelType = null;
        throw error;
      });
    
    return this.initPromise;
  }

  /**
   * Check if models are already cached
   * Note: This checks the Cache API used by transformers.js
   */
  async areModelsCached(): Promise<boolean> {
    try {
      // Check if cache API is available
      if (!('caches' in window)) return false;

      const modelType = aiModeStorage.getModelType();
      const cacheNames = await caches.keys();
      
      // Transformers.js uses a cache, but the exact name depends on the library version
      // Check all caches for model files
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        if (modelType === 'multilingual') {
          // Check for multilingual models
          const hasMT5 = keys.some(req => 
            req.url.includes('mt5-small') || 
            req.url.includes('Xenova/mt5')
          );
          const hasMultilingualBert = keys.some(req => 
            req.url.includes('bert-base-multilingual-uncased-sentiment') ||
            req.url.includes('bert-base-multilingual')
          );
          
          if (hasMT5 && hasMultilingualBert) {
            console.log(`Multilingual models found in cache: ${cacheName}`);
            return true;
          }
        } else {
          // Check for lightweight English models
          const hasDistilBART = keys.some(req => 
            req.url.includes('distilbart-cnn') || 
            req.url.includes('sshleifer/distilbart')
          );
          const hasDistilBERT = keys.some(req => 
            req.url.includes('distilbert-base-uncased-finetuned-sst') ||
            req.url.includes('sentiment')
          );
          
          if (hasDistilBART && hasDistilBERT) {
            console.log(`Lightweight English models found in cache: ${cacheName}`);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check model cache:', error);
      return false;
    }
  }

  /**
   * Clear cached models to free up storage
   * Only clears Cache API storage (transformers.js doesn't use IndexedDB yet)
   */
  async clearModelCache(): Promise<void> {
    try {
      // Clear all caches that might contain model files
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        let clearedCount = 0;
        
        for (const name of cacheNames) {
          // Delete all caches (transformers.js cache name varies)
          // We could be more selective, but this ensures complete cleanup
          await caches.delete(name);
          clearedCount++;
          console.log(`Cleared cache: ${name}`);
        }
        
        console.log(`Cleared ${clearedCount} cache(s)`);
      }

      // Reset instance state
      this.summarizer = null;
      this.classifier = null;
      this.modelsCached = false;
      this.initPromise = null;
      this.currentModelType = null;
      
      console.log('Model cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear model cache:', error);
      throw new Error('Failed to clear AI model cache');
    }
  }

  /**
   * Get cache size information
   * This actually checks the persistent cache, not just memory state
   */
  async getCacheSize(): Promise<{ sizeMB: number; isCached: boolean; modelType: ModelType }> {
    const isCached = await this.areModelsCached();
    const modelType = aiModeStorage.getModelType();
    const estimatedSize = modelType === 'multilingual' ? 1900 : 550; // Multilingual: ~1.9GB, Lightweight: ~550MB
    
    return {
      sizeMB: isCached ? estimatedSize : 0,
      isCached,
      modelType
    };
  }


  private async doInitialize(onProgress?: (status: string, progress: number) => void) {
    try {
      onProgress?.('Checking device capabilities...', 5);
      
      // Check for WebGPU support
      const hasWebGPU = await isWebGPUAvailable();
      this.device = hasWebGPU ? 'webgpu' : 'wasm';
      
      // Check if models are cached
      const cached = await this.areModelsCached();
      const modelType = aiModeStorage.getModelType();
      
      console.log(`Using device: ${this.device}, Model type: ${modelType}${cached ? ' (loading from cache)' : ' (downloading models)'}`);
      
      if (modelType === 'multilingual') {
        // Multilingual models that support 100+ languages including Japanese
        onProgress?.(cached ? 'Loading multilingual models from cache...' : 'Downloading multilingual AI models (~1.9GB)...', 10);
        
        // mt5-small for summarization (~1.2GB) - supports 100+ languages
        this.summarizer = await pipeline(
          'summarization',
          'Xenova/mt5-small',
          { device: this.device }
        );
        
        onProgress?.('Multilingual summarization model loaded', 50);
        
        // bert-base-multilingual for sentiment (~700MB) - supports 100+ languages
        this.classifier = await pipeline(
          'text-classification',
          'Xenova/bert-base-multilingual-uncased-sentiment',
          { device: this.device }
        );
        
        onProgress?.('Ready', 100);
        console.log('Multilingual AI initialized successfully');
      } else {
        // Lightweight English-only models
        onProgress?.(cached ? 'Loading lightweight models from cache...' : 'Downloading lightweight AI models (~550MB)...', 10);
        
        // distilbart for summarization (~300MB) - English only, faster
        this.summarizer = await pipeline(
          'summarization',
          'Xenova/distilbart-cnn-6-6',
          { device: this.device }
        );
        
        onProgress?.('Lightweight summarization model loaded', 50);
        
        // distilbert for sentiment (~250MB) - English only, faster
        this.classifier = await pipeline(
          'text-classification',
          'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
          { device: this.device }
        );
        
        onProgress?.('Ready', 100);
        console.log('Lightweight English AI initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize local AI:', error);
      this._isInitializing = false;
      this.initPromise = null;
      this.currentModelType = null;
      throw new Error('Failed to load AI models. Please check your internet connection and try again.');
    }
  }

  async analyzeEntry(content: string): Promise<AnalysisResult> {
    if (!this.summarizer || !this.classifier) {
      throw new Error('AI models not initialized. Please wait for initialization to complete.');
    }

    // Truncate content if too long (models have token limits)
    const maxLength = 512;
    const truncated = content.slice(0, maxLength);

    try {
      // Generate summary
      const summaryResult = await this.summarizer(truncated, {
        max_length: 50,
        min_length: 20,
      });
      const summary = summaryResult[0]?.summary_text || summaryResult[0]?.generated_text || 'Unable to generate summary';

      // Analyze sentiment - handle multilingual model output
      const sentimentResult = await this.classifier(truncated);
      const label = sentimentResult[0]?.label?.toLowerCase() || 'neutral';
      let sentiment = 'neutral';
      if (label.includes('positive') || label.includes('pos')) {
        sentiment = 'positive';
      } else if (label.includes('negative') || label.includes('neg')) {
        sentiment = 'negative';
      }

      // Extract keywords (simple frequency-based approach)
      const keywords = this.extractKeywords(content);

      // Generate title from first sentence
      const firstSentence = content.split(/[.!?]/)[0].trim();
      const suggestedTitle = firstSentence.slice(0, 60) + (firstSentence.length > 60 ? '...' : '');

      // Generate tags from keywords
      const suggestedTags = keywords.slice(0, 5);

      return {
        summary,
        sentiment,
        keywords,
        suggestedTitle,
        suggestedTags
      };
    } catch (error) {
      console.error('Entry analysis error:', error);
      throw new Error('Failed to analyze entry. Please try again.');
    }
  }

  async analyzeTrends(entries: any[]): Promise<TrendResult> {
    if (!this.classifier) {
      throw new Error('AI models not initialized');
    }

    if (entries.length < 3) {
      return {
        emotionalTrends: [],
        recurringThemes: [],
        growthIndicators: [],
        insights: ['Not enough data yet. Write at least 3 entries to see trends.'],
        recommendations: ['Keep writing to unlock insights about your emotional patterns.']
      };
    }

    // Analyze sentiment trends over time
    const sentiments = await Promise.all(
      entries.slice(0, 10).map(async (entry) => {
        // Handle entries that might not have content field
        const content = entry.content || entry.body || '';
        if (!content) return 'neutral';
        
        try {
          const result = await this.classifier(content.slice(0, 512));
          // Handle multilingual model output - can be positive, negative, or neutral
          const label = result[0]?.label?.toLowerCase() || 'neutral';
          if (label.includes('positive')) return 'positive';
          if (label.includes('negative')) return 'negative';
          return 'neutral';
        } catch (error) {
          console.error('Sentiment classification error:', error);
          return 'neutral';
        }
      })
    );

    const positiveCount = sentiments.filter(s => s === 'positive').length;
    const negativeCount = sentiments.filter(s => s === 'negative').length;
    const neutralCount = sentiments.filter(s => s === 'neutral').length;
    const trend = positiveCount > sentiments.length / 2 ? 'improving' : 
                  negativeCount > sentiments.length / 2 ? 'declining' : 'stable';

    // Extract common themes
    const allKeywords = entries.flatMap(e => {
      const content = e.content || e.body || '';
      return this.extractKeywords(content);
    });
    const keywordFreq = new Map<string, number>();
    allKeywords.forEach(k => keywordFreq.set(k, (keywordFreq.get(k) || 0) + 1));
    const recurringThemes = Array.from(keywordFreq.entries())
      .filter(([_, count]) => count > 1) // Only themes that appear more than once
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      emotionalTrends: [
        { 
          trend: `Mood ${trend}`,
          description: `Your recent entries show a ${trend} emotional pattern. Positive: ${positiveCount}, Neutral: ${neutralCount}, Negative: ${negativeCount} out of ${sentiments.length} entries analyzed.`
        }
      ],
      recurringThemes: recurringThemes.length > 0 ? recurringThemes : ['Not enough recurring themes detected yet'],
      growthIndicators: [
        `You've written ${entries.length} entries, showing consistent journaling practice`,
        `Average entry length: ${Math.round(entries.reduce((sum, e) => sum + (e.content || e.body || '').length, 0) / entries.length)} characters`
      ],
      insights: [
        recurringThemes.length > 0 
          ? `Most common themes: ${recurringThemes.slice(0, 3).join(', ')}`
          : 'Keep writing to discover your recurring themes',
        `Your emotional balance: ${Math.round((positiveCount / sentiments.length) * 100)}% positive`
      ],
      recommendations: [
        trend === 'improving' 
          ? 'Keep up the positive momentum! Continue your current practices.'
          : trend === 'declining'
          ? 'Consider focusing on activities that bring you joy and peace.'
          : 'Your mood is stable. Consider exploring new experiences to enrich your journaling.'
      ]
    };
  }

  async generateTitle(content: string): Promise<string> {
    if (!this.summarizer) {
      throw new Error('AI models not initialized');
    }

    const truncated = content.slice(0, 512);
    
    try {
      const result = await this.summarizer(truncated, {
        max_length: 15,
        min_length: 5,
      });

      const generated = result[0]?.summary_text || result[0]?.generated_text;
      
      // If we got a reasonable title, return it
      if (generated && generated.length > 3 && generated.length < 100) {
        return generated;
      }
    } catch (error) {
      console.warn('Summarizer failed for title generation:', error);
    }

    // Better fallback for multilingual content
    // Split by common sentence endings (works for Japanese too: 。！？)
    const sentences = content.split(/[.!?。！？\n]/);
    const firstSentence = sentences.find(s => s.trim().length > 0)?.trim() || content.trim();
    
    // For Japanese/CJK text, 30 chars is plenty; for English, 60 chars
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(firstSentence);
    const maxLength = hasJapanese ? 30 : 60;
    
    return firstSentence.slice(0, maxLength) + (firstSentence.length > maxLength ? '...' : '');
  }

  private extractKeywords(text: string): string[] {
    // Detect if text contains Japanese/CJK characters
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
    
    if (hasJapanese) {
      // For Japanese text, extract words differently
      // Remove common Japanese particles and get longer phrases
      const japaneseCommon = /[はがをにへとでや、。！？\s]/g;
      const words = text
        .split(japaneseCommon)
        .filter(word => word.length >= 2); // Japanese words can be 2+ chars
      
      const freq = new Map<string, number>();
      words.forEach(word => freq.set(word, (freq.get(word) || 0) + 1));
      
      return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word]) => word);
    } else {
      // English keyword extraction
      const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their']);
      
      const words = text.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word));

      const freq = new Map<string, number>();
      words.forEach(word => freq.set(word, (freq.get(word) || 0) + 1));

      return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word]) => word);
    }
  }

  isReady(): boolean {
    return !!(this.summarizer && this.classifier && !this._isInitializing);
  }

  isInitializing(): boolean {
    return this._isInitializing;
  }

  /**
   * Get the device being used for inference
   */
  getDevice(): 'webgpu' | 'wasm' {
    return this.device;
  }
}

export const localAI = new LocalAIService();
