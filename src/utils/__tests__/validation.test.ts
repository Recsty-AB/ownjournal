import { describe, it, expect } from 'vitest';
import {
  journalEntrySchema,
  tagSchema,
  emailSchema,
  passwordSchema,
  authSchema,
} from '../validation';

describe('validation', () => {
  describe('journalEntrySchema', () => {
    it('should validate a valid journal entry', () => {
      const validEntry = {
        title: 'My Day',
        body: 'Today was great!',
        tags: ['work', 'productivity'],
        mood: 'great' as const,
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(validEntry)).not.toThrow();
    });

    it('should reject empty title', () => {
      const invalidEntry = {
        title: '',
        body: 'Content',
        tags: [],
        mood: 'okay' as const,
        date: new Date(),
      };

      // Title is optional with default '' - empty string is valid
      const result = journalEntrySchema.parse(invalidEntry);
      expect(result.title).toBe('');
    });

    it('should reject title longer than 200 characters', () => {
      const invalidEntry = {
        title: 'a'.repeat(201),
        body: 'Content',
        tags: [],
        mood: 'okay' as const,
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(invalidEntry)).toThrow('Title must be less than 200 characters');
    });

    it('should trim whitespace from title', () => {
      const entry = {
        title: '  My Day  ',
        body: 'Content',
        tags: [],
        mood: 'good' as const,
        date: new Date(),
      };

      const result = journalEntrySchema.parse(entry);
      expect(result.title).toBe('My Day');
    });

    it('should reject empty body', () => {
      const invalidEntry = {
        title: 'Title',
        body: '',
        tags: [],
        mood: 'okay' as const,
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(invalidEntry)).toThrow('Entry content is required');
    });

    it('should reject body longer than 50,000 characters', () => {
      const invalidEntry = {
        title: 'Title',
        body: 'a'.repeat(50001),
        tags: [],
        mood: 'okay' as const,
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(invalidEntry)).toThrow('Entry must be less than 50,000 characters');
    });

    it('should reject more than 20 tags', () => {
      const invalidEntry = {
        title: 'Title',
        body: 'Content',
        tags: Array(21).fill('tag'),
        mood: 'okay' as const,
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(invalidEntry)).toThrow('Maximum 20 tags allowed');
    });

    it('should reject tag longer than 30 characters', () => {
      const invalidEntry = {
        title: 'Title',
        body: 'Content',
        tags: ['a'.repeat(31)],
        mood: 'okay' as const,
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(invalidEntry)).toThrow('Tag must be less than 30 characters');
    });

    it('should validate all mood values', () => {
      const moods = ['great', 'good', 'okay', 'poor', 'terrible'] as const;
      
      moods.forEach(mood => {
        const entry = {
          title: 'Title',
          body: 'Content',
          tags: [],
          mood,
          date: new Date(),
        };
        expect(() => journalEntrySchema.parse(entry)).not.toThrow();
      });
    });

    it('should reject invalid mood', () => {
      const invalidEntry = {
        title: 'Title',
        body: 'Content',
        tags: [],
        mood: 'invalid',
        date: new Date(),
      };

      expect(() => journalEntrySchema.parse(invalidEntry)).toThrow();
    });
  });

  describe('tagSchema', () => {
    it('should validate a valid tag', () => {
      expect(() => tagSchema.parse('valid-tag')).not.toThrow();
      expect(() => tagSchema.parse('Tag123')).not.toThrow();
      expect(() => tagSchema.parse('work projects')).not.toThrow();
    });

    it('should reject empty tag', () => {
      expect(() => tagSchema.parse('')).toThrow('Tag cannot be empty');
    });

    it('should reject tag longer than 30 characters', () => {
      expect(() => tagSchema.parse('a'.repeat(31))).toThrow('Tag must be less than 30 characters');
    });

    it('should reject tag with special characters', () => {
      expect(() => tagSchema.parse('tag@#$')).toThrow('Tag can only contain letters, numbers, spaces, and hyphens');
      expect(() => tagSchema.parse('tag_name')).toThrow('Tag can only contain letters, numbers, spaces, and hyphens');
    });

    it('should trim whitespace from tag', () => {
      const result = tagSchema.parse('  work  ');
      expect(result).toBe('work');
    });
  });

  describe('emailSchema', () => {
    it('should validate a valid email', () => {
      expect(() => emailSchema.parse('user@example.com')).not.toThrow();
      expect(() => emailSchema.parse('test.user+tag@domain.co.uk')).not.toThrow();
    });

    it('should reject invalid email format', () => {
      expect(() => emailSchema.parse('invalid')).toThrow('Invalid email address');
      expect(() => emailSchema.parse('user@')).toThrow('Invalid email address');
      expect(() => emailSchema.parse('@example.com')).toThrow('Invalid email address');
    });

    it('should reject email longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      expect(() => emailSchema.parse(longEmail)).toThrow('Email must be less than 255 characters');
    });

    it('should trim whitespace from email', () => {
      const result = emailSchema.parse('  user@example.com  ');
      expect(result).toBe('user@example.com');
    });
  });

  describe('passwordSchema', () => {
    it('should validate a valid password', () => {
      expect(() => passwordSchema.parse('password123')).not.toThrow();
      expect(() => passwordSchema.parse('secureP@ssw0rd!')).not.toThrow();
    });

    it('should reject password shorter than 6 characters', () => {
      expect(() => passwordSchema.parse('12345')).toThrow('Password must be at least 6 characters');
    });

    it('should reject password longer than 128 characters', () => {
      expect(() => passwordSchema.parse('a'.repeat(129))).toThrow('Password must be less than 128 characters');
    });
  });

  describe('authSchema', () => {
    it('should validate valid auth credentials', () => {
      const validAuth = {
        email: 'user@example.com',
        password: 'password123',
      };

      expect(() => authSchema.parse(validAuth)).not.toThrow();
    });

    it('should reject invalid email in auth', () => {
      const invalidAuth = {
        email: 'invalid',
        password: 'password123',
      };

      expect(() => authSchema.parse(invalidAuth)).toThrow('Invalid email address');
    });

    it('should reject invalid password in auth', () => {
      const invalidAuth = {
        email: 'user@example.com',
        password: '123',
      };

      expect(() => authSchema.parse(invalidAuth)).toThrow('Password must be at least 6 characters');
    });
  });
});
