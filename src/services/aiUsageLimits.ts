/**
 * AI Usage Limits Service
 * Manages rate limiting and usage tracking for AI features
 */

import { supabase } from '@/integrations/supabase/client';
import { scopedKey } from '@/utils/userScope';

const STORAGE_KEY = 'ai_usage_limits';

export type AIFeature = 'title' | 'tags' | 'entryAnalysis' | 'trendAnalysis';

interface UsageData {
  month: string; // YYYY-MM format
  week: string; // YYYY-Ww format
  titleCount: number;
  tagsCount: number;
  entryAnalysisCount: number;
  trendAnalysisCount: number;
  analyzedEntries: string[]; // Entry IDs that have been analyzed
}

const LIMITS = {
  title: 200,
  tags: 200,
  entryAnalysis: 150, // Base limit
  entryAnalysisBoost: 2000, // One-time yearly boost after first trend analysis
  trendAnalysis: 1, // Per week
  maxWordsPerRequest: 3000,
};

class AIUsageLimitsService {
  private lastSyncTime: number = 0;
  private syncPromise: Promise<void> | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getCurrentWeek(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.floor(diff / oneWeek);
    return `${now.getFullYear()}-W${week}`;
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
      return newData;
    }

    // Reset trend analysis if week changed (but keep total count for yearly limit)
    if (data.week !== currentWeek) {
      data.week = currentWeek;
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
    this.maybeSyncFromBackend();
    
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
    }

    return { allowed: true };
  }

  /**
   * Record usage of a feature
   * Note: Backend is the source of truth, this is for client-side caching/hints
   */
  recordUsage(feature: AIFeature, entryId?: string): void {
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

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Direct query - no edge function cost!
      const { data: monthlyStats } = await supabase
        .from('ai_usage_stats')
        .select('analysis_type')
        .gte('created_at', startOfMonth);

      const { data: weeklyStats } = await supabase
        .from('ai_usage_stats')
        .select('analysis_type')
        .gte('created_at', startOfWeek.toISOString());

      // Update localStorage with real counts
      const data = this.getData();
      data.titleCount = monthlyStats?.filter(s => s.analysis_type === 'title').length || 0;
      data.tagsCount = monthlyStats?.filter(s => s.analysis_type === 'tags').length || 0;
      data.entryAnalysisCount = monthlyStats?.filter(s => s.analysis_type === 'entryAnalysis').length || 0;
      data.trendAnalysisCount = weeklyStats?.filter(s => s.analysis_type === 'trendAnalysis').length || 0;
      this.saveData(data);
      
      if (import.meta.env.DEV) console.log('✅ AI usage stats synced from backend');
    } catch (error) {
      console.warn('Failed to sync AI usage from backend:', error);
    }
  }

  /**
   * Auto-sync if data is stale (non-blocking background sync)
   */
  private maybeSyncFromBackend(): void {
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
    }
    
    this.saveData(data);
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
    };
  }
}

export const aiUsageLimits = new AIUsageLimitsService();
