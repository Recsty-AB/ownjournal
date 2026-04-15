/**
 * useAIMode — per-feature AI mode resolver.
 *
 * Single source of truth for which AI path a given feature should
 * use. Feature components call this hook with their feature id and
 * branch on the returned value instead of hardcoding platform or
 * feature-flag checks.
 *
 * This hook is **reactive**: it subscribes to both the preferences
 * store and the generative service state, so when a user flips mode
 * or the model finishes loading, every consumer re-renders in the
 * same tick.
 *
 * Resolution order:
 *
 *   1. If LOCAL_AI_ENABLED is off → always 'cloud'
 *   2. If user is not Plus → always 'cloud' (Plus-gated feature)
 *   3. If user mode preference is 'cloud' → 'cloud'
 *   4. If user mode preference is 'local':
 *      a. If the local model is loaded and supports this feature → 'local'
 *      b. Else if localOnly is true → 'unavailable'
 *      c. Else → 'cloud' (transparent fallback)
 */

import { FEATURES } from '@/config/features';
import { LOCAL_AI_MODELS, LocalAIFeature } from '@/config/localAIModels';
import { useLocalAISettings } from '@/hooks/useLocalAISettings';
import { useLocalAIGenerativeState } from '@/hooks/useLocalAIGenerativeState';

export type ResolvedAIMode = 'cloud' | 'local' | 'unavailable';

export interface UseAIModeOptions {
  /** The current user's Plus status. Non-Plus users always get cloud. */
  isPro: boolean;
}

export function useAIMode(
  feature: LocalAIFeature,
  { isPro }: UseAIModeOptions,
): ResolvedAIMode {
  const prefs = useLocalAISettings();
  const generative = useLocalAIGenerativeState();

  if (!FEATURES.LOCAL_AI_ENABLED) return 'cloud';
  if (!isPro) return 'cloud';
  if (prefs.mode !== 'local') return 'cloud';

  // User wants local. Check whether the loaded model can serve this
  // feature right now.
  const featureSupported =
    generative.isReady &&
    generative.loadedModel !== null &&
    LOCAL_AI_MODELS[generative.loadedModel].supportedFeatures.includes(feature);

  if (featureSupported) return 'local';
  if (prefs.localOnly) return 'unavailable';
  return 'cloud';
}
