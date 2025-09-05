import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiPermissions } from '../aiPermissions';
import { supabase } from '@/integrations/supabase/client';
import { aiModeStorage } from '../aiModeStorage';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock aiModeStorage
vi.mock('../aiModeStorage', () => ({
  aiModeStorage: {
    getMode: vi.fn(),
    isPreloadEnabled: vi.fn(),
  },
}));

describe('aiPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  describe('isPROSubscriber', () => {
    it('should return true for PRO subscriber', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user123' } as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_pro: true },
              error: null,
            }),
          }),
        }),
      } as any);

      const isPRO = await aiPermissions.isPROSubscriber();
      expect(isPRO).toBe(true);
    });

    it('should return false for non-PRO subscriber', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user123' } as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_pro: false },
              error: null,
            }),
          }),
        }),
      } as any);

      const isPRO = await aiPermissions.isPROSubscriber();
      expect(isPRO).toBe(false);
    });

    it('should return false when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const isPRO = await aiPermissions.isPROSubscriber();
      expect(isPRO).toBe(false);
    });

    it('should return false on subscription query error', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user123' } as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      } as any);

      const isPRO = await aiPermissions.isPROSubscriber();
      expect(isPRO).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      vi.mocked(supabase.auth.getUser).mockRejectedValue(new Error('Auth error'));

      const isPRO = await aiPermissions.isPROSubscriber();
      expect(isPRO).toBe(false);
    });
  });

  describe('shouldLoadLocalAI', () => {
    it('should return true when all conditions are met', async () => {
      vi.mocked(aiModeStorage.getMode).mockReturnValue('local');
      vi.mocked(aiModeStorage.isPreloadEnabled).mockReturnValue(true);
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user123' } as any },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_pro: true },
              error: null,
            }),
          }),
        }),
      } as any);

      const shouldLoad = await aiPermissions.shouldLoadLocalAI();
      expect(shouldLoad).toBe(true);
    });

    it('should return false when cloud mode is active', async () => {
      vi.mocked(aiModeStorage.getMode).mockReturnValue('cloud');

      const shouldLoad = await aiPermissions.shouldLoadLocalAI();
      expect(shouldLoad).toBe(false);
      expect(console.log).toHaveBeenCalledWith('AI preload skipped: Cloud mode is active');
    });

    it('should return false when preload is disabled', async () => {
      vi.mocked(aiModeStorage.getMode).mockReturnValue('local');
      vi.mocked(aiModeStorage.isPreloadEnabled).mockReturnValue(false);

      const shouldLoad = await aiPermissions.shouldLoadLocalAI();
      expect(shouldLoad).toBe(false);
      expect(console.log).toHaveBeenCalledWith('AI preload disabled by user preference');
    });

    it('should return false when user is not PRO', async () => {
      vi.mocked(aiModeStorage.getMode).mockReturnValue('local');
      vi.mocked(aiModeStorage.isPreloadEnabled).mockReturnValue(true);
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user123' } as any },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_pro: false },
              error: null,
            }),
          }),
        }),
      } as any);

      const shouldLoad = await aiPermissions.shouldLoadLocalAI();
      expect(shouldLoad).toBe(false);
      expect(console.log).toHaveBeenCalledWith('AI preload skipped: PRO subscription required for local AI');
    });

    it('should check conditions in correct order', async () => {
      vi.mocked(aiModeStorage.getMode).mockReturnValue('cloud');
      vi.mocked(aiModeStorage.isPreloadEnabled).mockReturnValue(true);

      await aiPermissions.shouldLoadLocalAI();

      // Should not check PRO status if mode is cloud
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });
  });
});
