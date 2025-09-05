// Utility to manage journal name in localStorage
import { scopedKey } from './userScope';

const JOURNAL_NAME_KEY = 'ownjournal_name';
const DEFAULT_JOURNAL_NAME = 'My Personal Journal';

export const journalNameStorage = {
  /**
   * Get the custom journal name or default
   */
  getJournalName(): string {
    try {
      const stored = localStorage.getItem(scopedKey(JOURNAL_NAME_KEY));
      return stored || DEFAULT_JOURNAL_NAME;
    } catch (error) {
      console.error('Failed to get journal name:', error);
      return DEFAULT_JOURNAL_NAME;
    }
  },

  /**
   * Set a custom journal name
   */
  setJournalName(name: string): void {
    try {
      const trimmedName = name.trim();
      if (trimmedName) {
        localStorage.setItem(scopedKey(JOURNAL_NAME_KEY), trimmedName);
      } else {
        // If empty, remove custom name to use default
        localStorage.removeItem(scopedKey(JOURNAL_NAME_KEY));
      }
    } catch (error) {
      console.error('Failed to set journal name:', error);
    }
  },

  /**
   * Reset to default journal name
   */
  resetJournalName(): void {
    try {
      localStorage.removeItem(scopedKey(JOURNAL_NAME_KEY));
    } catch (error) {
      console.error('Failed to reset journal name:', error);
    }
  },

  /**
   * Check if a custom journal name is set
   */
  hasCustomName(): boolean {
    try {
      return localStorage.getItem(scopedKey(JOURNAL_NAME_KEY)) !== null;
    } catch (error) {
      return false;
    }
  }
};
