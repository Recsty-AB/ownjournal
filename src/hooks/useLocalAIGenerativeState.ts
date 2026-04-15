/**
 * Reactive snapshot of the local AI generative service. Components
 * that need to know "is a model loaded and ready?" use this hook
 * instead of calling `localAIGenerative.isReady()` directly, so they
 * re-render when the service state transitions (load / unload /
 * cache-clear).
 */

import { useSyncExternalStore } from 'react';
import { localAIGenerative } from '@/services/localAIGenerative';
import type { LocalAIModelId } from '@/config/localAIModels';

export interface LocalAIGenerativeState {
  isReady: boolean;
  loadedModel: LocalAIModelId | null;
  device: 'webgpu' | 'wasm';
}

// A single cached snapshot, reused across renders until the service
// notifies us of a change. Required by useSyncExternalStore semantics
// (the getSnapshot function must return a stable reference between
// notifications, otherwise React assumes something changed).
let cachedSnapshot: LocalAIGenerativeState = {
  isReady: localAIGenerative.isReady(),
  loadedModel: localAIGenerative.getLoadedModel(),
  device: localAIGenerative.getDevice(),
};
let snapshotDirty = true;

function getSnapshot(): LocalAIGenerativeState {
  if (snapshotDirty) {
    cachedSnapshot = {
      isReady: localAIGenerative.isReady(),
      loadedModel: localAIGenerative.getLoadedModel(),
      device: localAIGenerative.getDevice(),
    };
    snapshotDirty = false;
  }
  return cachedSnapshot;
}

function subscribe(listener: () => void): () => void {
  const unsubscribe = localAIGenerative.subscribe(() => {
    snapshotDirty = true;
    listener();
  });
  return unsubscribe;
}

export function useLocalAIGenerativeState(): LocalAIGenerativeState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
