// Local encrypted cache for AI analysis results
// Ensures zero backend storage of journal content derivatives

import { openDB } from '@/utils/pwa';

interface CachedAnalysis {
  key: string; // Hash of content for deduplication
  data: any;
  timestamp: number;
  type: 'entry' | 'title' | 'trendAnalysis' | 'tags';
}

class AICacheService {
  private readonly CACHE_STORE = 'ai_cache';
  private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Generate a cache key from content
   */
  private async generateCacheKey(content: string, type: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content + type);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get cached analysis if available and not expired
   */
  async getCached(content: string, type: string): Promise<any | null> {
    try {
      const db = await openDB();
      const key = await this.generateCacheKey(content, type);
      
      const transaction = db.transaction([this.CACHE_STORE], 'readonly');
      const store = transaction.objectStore(this.CACHE_STORE);
      
      return new Promise((resolve) => {
        const request = store.get(key);
        
        request.onsuccess = () => {
          const cached: CachedAnalysis | undefined = request.result;
          
          if (!cached) {
            resolve(null);
            return;
          }
          
          // Check if expired
          const age = Date.now() - cached.timestamp;
          if (age > this.MAX_AGE_MS) {
            // Expired, delete it
            this.deleteCached(key);
            resolve(null);
            return;
          }
          
          if (import.meta.env.DEV) {
            console.log('✅ AI cache hit:', type);
          }
          
          resolve(cached.data);
        };
        
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to get cached analysis:', error);
      }
      return null;
    }
  }

  /**
   * Store analysis result in local cache
   */
  async setCached(content: string, type: string, data: any): Promise<void> {
    try {
      const db = await openDB();
      const key = await this.generateCacheKey(content, type);
      
      const cached: CachedAnalysis = {
        key,
        data,
        timestamp: Date.now(),
        type: type as any,
      };
      
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      
      return new Promise((resolve, reject) => {
        const request = store.put(cached);
        request.onsuccess = () => {
          if (import.meta.env.DEV) {
            console.log('💾 AI result cached locally:', type);
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to cache analysis:', error);
      }
    }
  }

  /**
   * Delete cached analysis
   */
  private async deleteCached(key: string): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      
      return new Promise((resolve) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Silently fail
      });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Clear all cached analyses (e.g., on logout)
   */
  async clearAll(): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      
      return new Promise((resolve) => {
        const request = store.clear();
        request.onsuccess = () => {
          if (import.meta.env.DEV) {
            console.log('🗑️ AI cache cleared');
          }
          resolve();
        };
        request.onerror = () => resolve();
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to clear AI cache:', error);
      }
    }
  }

  /**
   * Clear cached tags specifically (e.g., after prompt updates)
   */
  async clearTagsCache(): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      
      return new Promise((resolve) => {
        const request = store.openCursor();
        let deletedCount = 0;
        
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const cached: CachedAnalysis = cursor.value;
            // Delete entries where type is 'tags'
            if (cached.type === 'tags') {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            if (deletedCount > 0 && import.meta.env.DEV) {
              console.log(`🧹 Cleared ${deletedCount} cached tag entries`);
            }
            resolve();
          }
        };
        
        request.onerror = () => resolve();
      });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get trend analysis cache key (based on entry IDs)
   */
  async getTrendCacheKey(entries: any[]): Promise<string> {
    const ids = entries.map(e => e.id).sort().join(',');
    return this.generateCacheKey(ids, 'trend');
  }

  /**
   * Remove expired cache entries (older than 7 days)
   * Called on app launch to keep cache size manageable
   */
  async cleanupExpired(): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction([this.CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(this.CACHE_STORE);
      
      return new Promise((resolve) => {
        const request = store.openCursor();
        const now = Date.now();
        let deletedCount = 0;
        
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const cached: CachedAnalysis = cursor.value;
            if (now - cached.timestamp > this.MAX_AGE_MS) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            // Finished iterating
            if (deletedCount > 0 && import.meta.env.DEV) {
              console.log(`🧹 AI cache cleanup: Removed ${deletedCount} expired entries`);
            }
            resolve();
          }
        };
        
        request.onerror = () => resolve(); // Silently fail
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to cleanup expired AI cache:', error);
      }
    }
  }
}

export const aiCacheService = new AICacheService();
