/**
 * AI Permissions
 * Manages permissions for AI features based on subscription and user preferences
 */

import { supabase } from '@/integrations/supabase/client';
import { aiModeStorage } from './aiModeStorage';
import { getCachedSubscription } from './subscriptionCache';

export const aiPermissions = {
  /**
   * Check if user is a PRO subscriber.
   * Uses cached subscription when offline so Plus features work without network.
   */
  async isPROSubscriber(): Promise<boolean> {
    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }
      userId = user.id;

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('is_pro')
        .eq('user_id', user.id)
        .single();

      if (error) {
        const cached = getCachedSubscription(user.id);
        return cached?.is_pro ?? false;
      }

      return subscription?.is_pro === true;
    } catch {
      if (userId) {
        const cached = getCachedSubscription(userId);
        return cached?.is_pro ?? false;
      }
      return false;
    }
  },

  /**
   * Check if local AI models should be loaded
   * Requirements:
   * 1. User must be PRO subscriber
   * 2. User must have local mode enabled (not cloud)
   * 3. Preload must be enabled
   */
  async shouldLoadLocalAI(): Promise<boolean> {
    // Check if user wants to use local AI
    const mode = aiModeStorage.getMode();
    if (mode !== 'local') {
      console.log('AI preload skipped: Cloud mode is active');
      return false;
    }

    // Check if preload is enabled
    if (!aiModeStorage.isPreloadEnabled()) {
      console.log('AI preload disabled by user preference');
      return false;
    }

    // Check PRO subscription status
    const isPRO = await this.isPROSubscriber();
    if (!isPRO) {
      console.log('AI preload skipped: PRO subscription required for local AI');
      return false;
    }

    return true;
  }
};
