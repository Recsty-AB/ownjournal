/**
 * AI Usage Limits Service
 * Manages rate limiting and usage tracking for AI features
 */

import { supabase } from '@/integrations/supabase/client';
import { scopedKey } from '@/utils/userScope';
import { DREAM_LIMITS } from '@/types/dream';

const STORAGE_KEY = 'ai_usage_limits';

export type AIFeature = 'title' | 'tags' | 'entryAnalysis' | 'trendAnalysis' | 'dreamReflection' | 'dreamPatterns';

interface UsageData {
  month: string; // YYYY-MM format
  week: string; // YYYY-MM-DD of the week's Sunday (UTC)
  titleCount: number;
  tagsCount: number;
  entryAnalysisCount: number;
  trendAnalysisCount: number;
  // Optional so data saved by older app versions still loads.
  dreamReflectionCount?: number; // monthly
  dreamPatternsCount?: number; // weekly
  analyzedEntries: string[]; // Entry IDs that have been analyzed
}

const LIMITS = {
  title: 200,
  tags: 200,
  entryAnalysis: 150, // Base limit
  entryAnalysisBoost: 2000, // One-time yearly boost after first trend analysis
  trendAnalysis: 1, // Per week
  dreamReflection: DREAM_LIMITS.reflectionsPerMonth,
  dreamPatterns: DREAM_LIMITS.patternReportsPerWeek, // Per week
  maxWordsPerRequest: 3000,
};

class AIUsageLimitsService {
  private lastSyncTime: number = 0;
  private syncPromise: Promise<void> | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private listeners = new Set<() => void>();

  /** Called after the stored counts change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  // The server (ai-analyze) counts usage per UTC month and per UTC week
  // starting on Sunday. These windows match it, so the counts shown here agree
  // with the limits it enforces, also in the hours around a month's first day.
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private getCurrentWeek(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()))
      .toISOString()
      .slice(0, 10);
  }

  private getData(): UsageData {
    const stored = localStorage.getItem(scopedKey(STORAGE_KEY));
    if (!stored) {
      return this.createEmptyData();
    }

    const data: UsageData = JSON.parse(stored);
    const currentMonth = this.getCurrentMonth();
    const currentWeek = this.getCurrentWeek();

    // Reset if month changed
    if (data.month !== currentMonth) {
      // Preserve trend analysis count for yearly tracking
      const oldTrendCount = data.trendAnalysisCount;
      const newData = this.createEmptyData();
      newData.trendAnalysisCount = oldTrendCount;
      // A week can start in the old month: its Dream patterns report still counts.
      if (data.week === currentWeek) {
        newData.dreamPatternsCount = data.dreamPatternsCount ?? 0;
        this.saveData(newData);
      }
      return newData;
    }

    // Reset trend analysis if week changed (but keep total count for yearly limit).
    // Dream patterns counts per week.
    if (data.week !== currentWeek) {
      data.week = currentWeek;
      data.dreamPatternsCount = 0;
      this.saveData(data);
    }

    return data;
  }

  private createEmptyData(): UsageData {
    const data: UsageData = {
      month: this.getCurrentMonth(),
      week: this.getCurrentWeek(),
      titleCount: 0,
      tagsCount: 0,
      entryAnalysisCount: 0,
      trendAnalysisCount: 0,
      dreamReflectionCount: 0,
      dreamPatternsCount: 0,
      analyzedEntries: [],
    };
    this.saveData(data);
    return data;
  }

  private saveData(data: UsageData): void {
    localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(data));
  }

  /**
   * Check if content exceeds word limit
   */
  checkWordLimit(content: string): { allowed: boolean; wordCount: number; limit: number } {
    const wordCount = content.trim().split(/\s+/).length;
    return {
      allowed: wordCount <= LIMITS.maxWordsPerRequest,
      wordCount,
      limit: LIMITS.maxWordsPerRequest,
    };
  }

  /**
   * Check if feature usage is allowed
   */
  canUseFeature(feature: AIFeature, entryId?: string): { allowed: boolean; reason?: string; current?: number; limit?: number } {
    // Trigger background sync if data is stale (non-blocking)
    this.syncIfStale();
    
    const data = this.getData();

    switch (feature) {
      case 'title':
        if (data.titleCount >= LIMITS.title) {
          return {
            allowed: false,
            reason: `You've reached the monthly limit of ${LIMITS.title} title generations. Limit resets next month.`,
            current: data.titleCount,
            limit: LIMITS.title,
          };
        }
        break;

      case 'tags':
        if (data.tagsCount >= LIMITS.tags) {
          return {
            allowed: false,
            reason: `You've reached the monthly limit of ${LIMITS.tags} tag generations. Limit resets next month.`,
            current: data.tagsCount,
            limit: LIMITS.tags,
          };
        }
        break;

      case 'entryAnalysis':
        // Note: Backend is the ultimate enforcer of limits
        // This is a client-side hint for better UX
        // Check if this specific entry was already analyzed
        if (entryId && data.analyzedEntries.includes(entryId)) {
          return {
            allowed: false,
            reason: 'This entry has already been analyzed. Edit the entry to analyze it again.',
          };
        }

        // Check monthly limit with yearly boost logic
        // User gets 2000 analyses once per year after first trend analysis
        // After that, back to 150/month for the rest of the year
        let limit = LIMITS.entryAnalysis;
        const yearStart = new Date().getFullYear();
        const storedYear = data.month.split('-')[0];
        
        // Check if this is the same year and trend was run
        if (storedYear === yearStart.toString() && data.trendAnalysisCount > 0) {
          // Check total yearly usage
          const totalYearlyUsage = parseInt(localStorage.getItem(scopedKey(`ai_yearly_entry_${yearStart}`)) || '0');
          
          if (totalYearlyUsage < LIMITS.entryAnalysisBoost) {
            limit = LIMITS.entryAnalysisBoost;
          }
        }

        if (data.entryAnalysisCount >= limit) {
          return {
            allowed: false,
            reason: `You've reached the monthly limit of ${limit} entry analyses. ${
              data.trendAnalysisCount === 0 
                ? 'Run a trend analysis to unlock 2000 analyses for the year.' 
                : limit === LIMITS.entryAnalysis 
                  ? 'Your yearly boost of 2000 has been used. Limit resets next month.'
                  : 'Limit resets next month.'
            }`,
            current: data.entryAnalysisCount,
            limit,
          };
        }
        break;

      case 'trendAnalysis':
        if (data.trendAnalysisCount >= LIMITS.trendAnalysis) {
          return {
            allowed: false,
            reason: `You can only run trend analysis once per week. Try again next week.`,
            current: data.trendAnalysisCount,
            limit: LIMITS.trendAnalysis,
          };
        }
        break;

      // Dream callers build their own translated messages from current/limit.
      case 'dreamReflection':
      case 'dreamPatterns': {
        const current = this.getDreamCount(data, feature);
        if (current >= LIMITS[feature]) {
          return { allowed: false, current, limit: LIMITS[feature] };
        }
        break;
      }
    }

    return { allowed: true };
  }

  /**
   * Record usage of a feature
   * Note: Backend is the source of truth, this is for client-side caching/hints.
   * Dream features take the server's count instead (setDreamCount).
   */
  recordUsage(feature: Exclude<AIFeature, 'dreamReflection' | 'dreamPatterns'>, entryId?: string): void {
    const data = this.getData();
    const year = new Date().getFullYear();

    switch (feature) {
      case 'title':
        data.titleCount++;
        break;
      case 'tags':
        data.tagsCount++;
        break;
      case 'entryAnalysis':
        data.entryAnalysisCount++;
        if (entryId && !data.analyzedEntries.includes(entryId)) {
          data.analyzedEntries.push(entryId);
        }
        // Track yearly usage for boost calculation
        const yearlyKey = `ai_yearly_entry_${year}`;
        const yearlyCount = parseInt(localStorage.getItem(scopedKey(yearlyKey)) || '0');
        localStorage.setItem(scopedKey(yearlyKey), (yearlyCount + 1).toString());
        break;
      case 'trendAnalysis':
        data.trendAnalysisCount++;
        break;
    }

    this.saveData(data);
    this.notify();
  }

  /**
   * Store the server's count after a dream request; the server is the source
   * of truth and returns `used` with every successful dream response.
   */
  setDreamCount(feature: 'dreamReflection' | 'dreamPatterns', used: number): void {
    if (!Number.isFinite(used) || used < 0) return;
    const data = this.getData();
    if (feature === 'dreamReflection') data.dreamReflectionCount = used;
    else data.dreamPatternsCount = used;
    this.saveData(data);
    this.notify();
  }

  private getDreamCount(data: UsageData, feature: 'dreamReflection' | 'dreamPatterns'): number {
    return (feature === 'dreamReflection' ? data.dreamReflectionCount : data.dreamPatternsCount) ?? 0;
  }

  /**
   * Remove entry from analyzed list (when entry is edited)
   */
  markEntryAsModified(entryId: string): void {
    const data = this.getData();
    data.analyzedEntries = data.analyzedEntries.filter(id => id !== entryId);
    this.saveData(data);
  }

  /**
   * Sync usage data from backend (proactive sync via direct client query)
   */
  async syncFromBackend(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // The same windows as the server (see getCurrentMonth).
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const startOfWeek = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()),
      ).toISOString();
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();

      // The database counts the rows, with the function the server enforces
      // the limits with. Reading the rows and counting them here would stop at
      // the API's row limit and show too little usage in a heavy month.
      const { data: summary, error } = await supabase.rpc('get_ai_usage_summary', {
        p_user_id: user.id,
        p_start_of_month: startOfMonth,
        p_start_of_week: startOfWeek,
        p_start_of_year: startOfYear,
      });

      // A failed read says nothing about usage: keep the counts there are
      // instead of showing the full allowance.
      if (error || !Array.isArray(summary)) {
        if (import.meta.env.DEV) console.warn('Failed to read AI usage from backend:', error);
        return;
      }

      // No row means the account has no subscription record, so no AI usage.
      const counts = summary[0];
      const count = (value: unknown): number => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      };

      const data = this.getData();
      data.titleCount = count(counts?.monthly_title_count);
      data.tagsCount = count(counts?.monthly_tags_count);
      data.entryAnalysisCount = count(counts?.monthly_entry_count);
      data.trendAnalysisCount = count(counts?.weekly_trend_count);
      data.dreamReflectionCount = count(counts?.monthly_dream_reflection_count);
      data.dreamPatternsCount = count(counts?.weekly_dream_patterns_count);
      this.saveData(data);
      this.notify();
      
      if (import.meta.env.DEV) console.log('✅ AI usage stats synced from backend');
    } catch (error) {
      console.warn('Failed to sync AI usage from backend:', error);
    }
  }

  /**
   * Auto-sync if data is stale (non-blocking background sync). Also called
   * by screens that show a remaining count, so usage from another device
   * shows before the first tap.
   */
  syncIfStale(): void {
    const now = Date.now();
    if (now - this.lastSyncTime > this.SYNC_INTERVAL_MS && !this.syncPromise) {
      this.syncPromise = this.syncFromBackend().finally(() => {
        this.syncPromise = null;
        this.lastSyncTime = Date.now();
      });
    }
  }

  /**
   * Mark a feature as having reached its limit (reactive sync on 429)
   */
  markLimitReached(feature: AIFeature): void {
    const data = this.getData();
    
    switch (feature) {
      case 'trendAnalysis':
        data.trendAnalysisCount = LIMITS.trendAnalysis;
        break;
      case 'entryAnalysis':
        data.entryAnalysisCount = LIMITS.entryAnalysis;
        break;
      case 'title':
        data.titleCount = LIMITS.title;
        break;
      case 'tags':
        data.tagsCount = LIMITS.tags;
        break;
      case 'dreamReflection':
        data.dreamReflectionCount = LIMITS.dreamReflection;
        break;
      case 'dreamPatterns':
        data.dreamPatternsCount = LIMITS.dreamPatterns;
        break;
    }
    
    this.saveData(data);
    this.notify();
  }

  /**
   * Get current usage stats
   * Note: These are estimates based on local storage. Backend is source of truth.
   */
  getUsageStats() {
    const data = this.getData();
    const year = new Date().getFullYear();
    const yearlyUsage = parseInt(localStorage.getItem(scopedKey(`ai_yearly_entry_${year}`)) || '0');
    
    // Determine entry limit based on yearly boost status
    let entryLimit = LIMITS.entryAnalysis;
    if (data.trendAnalysisCount > 0 && yearlyUsage < LIMITS.entryAnalysisBoost) {
      entryLimit = LIMITS.entryAnalysisBoost;
    }

    return {
      title: { current: data.titleCount, limit: LIMITS.title },
      tags: { current: data.tagsCount, limit: LIMITS.tags },
      entryAnalysis: { 
        current: data.entryAnalysisCount, 
        limit: entryLimit,
        yearlyUsed: yearlyUsage,
        yearlyLimit: LIMITS.entryAnalysisBoost,
      },
      trendAnalysis: { current: data.trendAnalysisCount, limit: LIMITS.trendAnalysis },
      dreamReflection: { current: data.dreamReflectionCount ?? 0, limit: LIMITS.dreamReflection },
      dreamPatterns: { current: data.dreamPatternsCount ?? 0, limit: LIMITS.dreamPatterns },
    };
  }
}

export const aiUsageLimits = new AIUsageLimitsService();
