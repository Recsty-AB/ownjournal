/**
 * AI Metadata Storage Service
 * Manages per-entry AI metadata in IndexedDB
 */

import type { EntryAIMetadata } from "@/types/aiMetadata";
import { userScopedDBName } from "@/utils/userScope";

const BASE_DB_NAME = "ownjournal_ai_metadata";
const STORE_NAME = "entry_metadata";
const DB_VERSION = 1;

class AIMetadataService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private dbNameForPromise: string | null = null;

  private async getDB(): Promise<IDBDatabase> {
    const dbName = userScopedDBName(BASE_DB_NAME);
    // Recreate the promise if the user-scoped DB name changed (user switch)
    if (!this.dbPromise || this.dbNameForPromise !== dbName) {
      this.dbNameForPromise = dbName;
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
      });
    }
    return this.dbPromise;
  }

  /**
   * Get metadata for an entry
   */
  async getMetadata(entryId: string): Promise<EntryAIMetadata | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(entryId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get metadata:", error);
      return null;
    }
  }

  /**
   * Save metadata for an entry
   */
  async setMetadata(entryId: string, metadata: EntryAIMetadata): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(metadata, entryId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to set metadata:", error);
      throw error;
    }
  }

  /**
   * Check if metadata exists for an entry
   */
  async hasMetadata(entryId: string): Promise<boolean> {
    const metadata = await this.getMetadata(entryId);
    return metadata !== null;
  }

  /**
   * Delete metadata for an entry
   */
  async deleteMetadata(entryId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(entryId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to delete metadata:", error);
      throw error;
    }
  }

  /**
   * Get all metadata (for debugging/export)
   */
  async getAllMetadata(): Promise<Record<string, EntryAIMetadata>> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        const keysRequest = store.getAllKeys();

        Promise.all([
          new Promise((res, rej) => {
            request.onsuccess = () => res(request.result);
            request.onerror = () => rej(request.error);
          }),
          new Promise((res, rej) => {
            keysRequest.onsuccess = () => res(keysRequest.result);
            keysRequest.onerror = () => rej(keysRequest.error);
          }),
        ]).then(([values, keys]) => {
          const result: Record<string, EntryAIMetadata> = {};
          (keys as string[]).forEach((key, index) => {
            result[key] = (values as EntryAIMetadata[])[index];
          });
          resolve(result);
        }).catch(reject);
      });
    } catch (error) {
      console.error("Failed to get all metadata:", error);
      return {};
    }
  }

  /**
   * Clear all metadata (for testing/reset)
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to clear metadata:", error);
      throw error;
    }
  }
}

export const aiMetadataService = new AIMetadataService();
