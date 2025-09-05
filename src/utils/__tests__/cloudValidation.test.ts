import { describe, it, expect, beforeEach } from 'vitest';
import { 
  nextcloudServerUrlSchema,
  nextcloudUsernameSchema,
  nextcloudAppPasswordSchema,
  nextcloudConfigSchema,
  ConnectionRateLimiter,
  normalizeServerUrl
} from '../cloudValidation';

describe('cloudValidation', () => {
  describe('normalizeServerUrl', () => {
    it('should add https:// to URLs without protocol', () => {
      expect(normalizeServerUrl('cloud.example.com')).toBe('https://cloud.example.com');
      expect(normalizeServerUrl('www.recsty.se/nextcloud')).toBe('https://www.recsty.se/nextcloud');
    });

    it('should convert http:// to https://', () => {
      expect(normalizeServerUrl('http://cloud.example.com')).toBe('https://cloud.example.com');
    });

    it('should preserve existing https://', () => {
      expect(normalizeServerUrl('https://cloud.example.com')).toBe('https://cloud.example.com');
    });

    it('should handle empty strings', () => {
      expect(normalizeServerUrl('')).toBe('');
      expect(normalizeServerUrl('  ')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeServerUrl('  cloud.example.com  ')).toBe('https://cloud.example.com');
    });
  });

  describe('nextcloudServerUrlSchema', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = nextcloudServerUrlSchema.safeParse('https://cloud.example.com');
      expect(result.success).toBe(true);
    });

    it('should auto-add https:// to URLs without protocol', () => {
      const result = nextcloudServerUrlSchema.safeParse('cloud.example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('https://cloud.example.com');
      }
    });

    it('should auto-add https:// to www URLs', () => {
      const result = nextcloudServerUrlSchema.safeParse('www.recsty.se/nextcloud');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('https://www.recsty.se/nextcloud');
      }
    });

    it('should convert http:// to https://', () => {
      const result = nextcloudServerUrlSchema.safeParse('http://cloud.example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('https://cloud.example.com');
      }
    });

    it('should reject empty URLs', () => {
      const result = nextcloudServerUrlSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject IP addresses', () => {
      const result = nextcloudServerUrlSchema.safeParse('https://192.168.1.1');
      expect(result.success).toBe(false);
    });

    it('should reject URLs over 255 characters', () => {
      const longUrl = 'https://' + 'a'.repeat(250) + '.com';
      const result = nextcloudServerUrlSchema.safeParse(longUrl);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace', () => {
      const result = nextcloudServerUrlSchema.safeParse('  https://cloud.example.com  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('https://cloud.example.com');
      }
    });
  });

  describe('nextcloudUsernameSchema', () => {
    it('should accept valid usernames', () => {
      const result = nextcloudUsernameSchema.safeParse('user123');
      expect(result.success).toBe(true);
    });

    it('should accept usernames with allowed special characters', () => {
      const result = nextcloudUsernameSchema.safeParse('user.name-123_@test');
      expect(result.success).toBe(true);
    });

    it('should reject empty usernames', () => {
      const result = nextcloudUsernameSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject usernames with invalid characters', () => {
      const result = nextcloudUsernameSchema.safeParse('user name!');
      expect(result.success).toBe(false);
    });

    it('should reject usernames over 200 characters', () => {
      const longUsername = 'a'.repeat(201);
      const result = nextcloudUsernameSchema.safeParse(longUsername);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace', () => {
      const result = nextcloudUsernameSchema.safeParse('  username  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('username');
      }
    });
  });

  describe('nextcloudAppPasswordSchema', () => {
    it('should accept valid app passwords', () => {
      const result = nextcloudAppPasswordSchema.safeParse('abc123-def456-ghi789');
      expect(result.success).toBe(true);
    });

    it('should reject empty passwords', () => {
      const result = nextcloudAppPasswordSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject passwords over 500 characters', () => {
      const longPassword = 'a'.repeat(501);
      const result = nextcloudAppPasswordSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace', () => {
      const result = nextcloudAppPasswordSchema.safeParse('  password123  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('password123');
      }
    });
  });

  describe('nextcloudConfigSchema', () => {
    it('should accept valid configuration', () => {
      const result = nextcloudConfigSchema.safeParse({
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'test-password-123',
      });
      expect(result.success).toBe(true);
    });

    it('should accept configuration with URL missing protocol (auto-adds https)', () => {
      const result = nextcloudConfigSchema.safeParse({
        serverUrl: 'cloud.example.com',
        username: 'testuser',
        appPassword: 'test-password-123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.serverUrl).toBe('https://cloud.example.com');
      }
    });

    it('should reject configuration with missing fields', () => {
      const result = nextcloudConfigSchema.safeParse({
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ConnectionRateLimiter', () => {
    let limiter: ConnectionRateLimiter;

    beforeEach(() => {
      limiter = new ConnectionRateLimiter();
    });

    it('should allow first attempt', () => {
      const canAttempt = limiter.canAttempt('nextcloud');
      expect(canAttempt).toBe(true);
    });

    it('should allow multiple attempts under limit', () => {
      expect(limiter.canAttempt('nextcloud')).toBe(true);
      expect(limiter.canAttempt('nextcloud')).toBe(true);
      expect(limiter.canAttempt('nextcloud')).toBe(true);
    });

    it('should block attempts after exceeding limit', () => {
      // Use up all 5 attempts
      for (let i = 0; i < 5; i++) {
        expect(limiter.canAttempt('nextcloud')).toBe(true);
      }
      
      // 6th attempt should be blocked
      expect(limiter.canAttempt('nextcloud')).toBe(false);
    });

    it('should track different providers separately', () => {
      // Use up nextcloud attempts
      for (let i = 0; i < 5; i++) {
        limiter.canAttempt('nextcloud');
      }
      
      // Google Drive should still be allowed
      expect(limiter.canAttempt('google-drive')).toBe(true);
    });

    it('should return remaining time when blocked', () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        limiter.canAttempt('nextcloud');
      }
      
      const remainingTime = limiter.getRemainingTime('nextcloud');
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(60000); // Max 1 minute
    });

    it('should return 0 remaining time for new provider', () => {
      const remainingTime = limiter.getRemainingTime('new-provider');
      expect(remainingTime).toBe(0);
    });

    it('should reset provider attempts', () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        limiter.canAttempt('nextcloud');
      }
      
      // Should be blocked
      expect(limiter.canAttempt('nextcloud')).toBe(false);
      
      // Reset
      limiter.reset('nextcloud');
      
      // Should be allowed again
      expect(limiter.canAttempt('nextcloud')).toBe(true);
    });

    it('should reset only specified provider', () => {
      // Block both providers
      for (let i = 0; i < 5; i++) {
        limiter.canAttempt('nextcloud');
        limiter.canAttempt('google-drive');
      }
      
      // Reset only nextcloud
      limiter.reset('nextcloud');
      
      expect(limiter.canAttempt('nextcloud')).toBe(true);
      expect(limiter.canAttempt('google-drive')).toBe(false);
    });
  });
});
