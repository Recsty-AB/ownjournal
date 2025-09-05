import { describe, it, expect, beforeEach } from 'vitest';
import { aiModeStorage, type AIMode } from '../aiModeStorage';

describe('aiModeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getMode', () => {
    it('should return default "local" mode when not set', () => {
      const mode = aiModeStorage.getMode();
      expect(mode).toBe('local');
    });

    it('should return stored mode', () => {
      localStorage.setItem('ai-mode-preference', 'cloud');
      const mode = aiModeStorage.getMode();
      expect(mode).toBe('cloud');
    });

    it('should handle invalid stored values gracefully', () => {
      localStorage.setItem('ai-mode-preference', 'invalid');
      const mode = aiModeStorage.getMode();
      expect(['local', 'cloud']).toContain(mode);
    });
  });

  describe('setMode', () => {
    it('should store local mode', () => {
      aiModeStorage.setMode('local');
      expect(localStorage.getItem('ai-mode-preference')).toBe('local');
    });

    it('should store cloud mode', () => {
      aiModeStorage.setMode('cloud');
      expect(localStorage.getItem('ai-mode-preference')).toBe('cloud');
    });

    it('should overwrite existing mode', () => {
      aiModeStorage.setMode('local');
      expect(localStorage.getItem('ai-mode-preference')).toBe('local');
      
      aiModeStorage.setMode('cloud');
      expect(localStorage.getItem('ai-mode-preference')).toBe('cloud');
    });
  });

  describe('hasCloudConsent', () => {
    it('should return false when consent not set', () => {
      const hasConsent = aiModeStorage.hasCloudConsent();
      expect(hasConsent).toBe(false);
    });

    it('should return true when consent is given', () => {
      localStorage.setItem('ai-cloud-consent', 'true');
      const hasConsent = aiModeStorage.hasCloudConsent();
      expect(hasConsent).toBe(true);
    });

    it('should return false when consent is explicitly denied', () => {
      localStorage.setItem('ai-cloud-consent', 'false');
      const hasConsent = aiModeStorage.hasCloudConsent();
      expect(hasConsent).toBe(false);
    });
  });

  describe('setCloudConsent', () => {
    it('should store consent as true', () => {
      aiModeStorage.setCloudConsent(true);
      expect(localStorage.getItem('ai-cloud-consent')).toBe('true');
    });

    it('should store consent as false', () => {
      aiModeStorage.setCloudConsent(false);
      expect(localStorage.getItem('ai-cloud-consent')).toBe('false');
    });

    it('should overwrite existing consent', () => {
      aiModeStorage.setCloudConsent(true);
      expect(localStorage.getItem('ai-cloud-consent')).toBe('true');
      
      aiModeStorage.setCloudConsent(false);
      expect(localStorage.getItem('ai-cloud-consent')).toBe('false');
    });
  });

  describe('clearConsent', () => {
    it('should remove consent and reset to local mode', () => {
      aiModeStorage.setCloudConsent(true);
      aiModeStorage.setMode('cloud');
      
      aiModeStorage.clearConsent();
      
      expect(localStorage.getItem('ai-cloud-consent')).toBeNull();
      expect(aiModeStorage.getMode()).toBe('local');
    });

    it('should be idempotent', () => {
      aiModeStorage.clearConsent();
      expect(() => aiModeStorage.clearConsent()).not.toThrow();
    });
  });

  describe('isPreloadEnabled', () => {
    it('should return true by default when not set', () => {
      const isEnabled = aiModeStorage.isPreloadEnabled();
      expect(isEnabled).toBe(true);
    });

    it('should return stored value when set', () => {
      localStorage.setItem('ai-preload-enabled', 'false');
      const isEnabled = aiModeStorage.isPreloadEnabled();
      expect(isEnabled).toBe(false);
    });

    it('should handle true value', () => {
      localStorage.setItem('ai-preload-enabled', 'true');
      const isEnabled = aiModeStorage.isPreloadEnabled();
      expect(isEnabled).toBe(true);
    });
  });

  describe('setPreloadEnabled', () => {
    it('should store preload enabled as true', () => {
      aiModeStorage.setPreloadEnabled(true);
      expect(localStorage.getItem('ai-preload-enabled')).toBe('true');
    });

    it('should store preload enabled as false', () => {
      aiModeStorage.setPreloadEnabled(false);
      expect(localStorage.getItem('ai-preload-enabled')).toBe('false');
    });

    it('should overwrite existing value', () => {
      aiModeStorage.setPreloadEnabled(true);
      expect(localStorage.getItem('ai-preload-enabled')).toBe('true');
      
      aiModeStorage.setPreloadEnabled(false);
      expect(localStorage.getItem('ai-preload-enabled')).toBe('false');
    });
  });

  describe('integration', () => {
    it('should maintain separate settings for mode, consent, and preload', () => {
      aiModeStorage.setMode('cloud');
      aiModeStorage.setCloudConsent(true);
      aiModeStorage.setPreloadEnabled(false);

      expect(aiModeStorage.getMode()).toBe('cloud');
      expect(aiModeStorage.hasCloudConsent()).toBe(true);
      expect(aiModeStorage.isPreloadEnabled()).toBe(false);
    });

    it('should handle clearConsent correctly', () => {
      aiModeStorage.setMode('cloud');
      aiModeStorage.setCloudConsent(true);
      aiModeStorage.setPreloadEnabled(false);

      aiModeStorage.clearConsent();

      expect(aiModeStorage.getMode()).toBe('local');
      expect(aiModeStorage.hasCloudConsent()).toBe(false);
      expect(aiModeStorage.isPreloadEnabled()).toBe(false); // Preload should not be affected
    });
  });
});
