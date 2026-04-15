/**
 * Reactive access to local AI preferences. Wraps the settings store
 * in `useSyncExternalStore` so every consumer re-renders when any
 * caller flips a preference.
 */

import { useSyncExternalStore } from 'react';
import {
  getLocalAIPreferences,
  subscribeLocalAIPreferences,
  type LocalAIPreferences,
} from '@/utils/localAISettings';

export function useLocalAISettings(): LocalAIPreferences {
  return useSyncExternalStore(
    subscribeLocalAIPreferences,
    getLocalAIPreferences,
    getLocalAIPreferences,
  );
}
