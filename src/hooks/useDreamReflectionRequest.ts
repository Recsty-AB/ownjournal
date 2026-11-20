import { useSyncExternalStore } from "react";
import type { DreamReflection } from "@/types/dream";

/**
 * A dream's reflection request, kept outside the card that started it. The
 * card unmounts when the entry is edited, the view changes or a filter hides
 * it; the request carries on, and a remounted card must still show that it is
 * running (or a second tap would bill a second reflection) and must still
 * offer Retry for a reflection whose save failed.
 */
export interface DreamReflectionRequest {
  /** Waiting for the AI. */
  loading: boolean;
  /** Came back but is not in the saved entry yet (saving, or the save failed). */
  reflection: DreamReflection | null;
  saving: boolean;
  /** The save failed; the card offers Retry. */
  unsaved: boolean;
}

const IDLE: DreamReflectionRequest = { loading: false, reflection: null, saving: false, unsaved: false };
const requests = new Map<string, DreamReflectionRequest>();
const listeners = new Set<() => void>();

export function getDreamReflectionRequest(entryId: string): DreamReflectionRequest {
  return requests.get(entryId) ?? IDLE;
}

export function updateDreamReflectionRequest(entryId: string, patch: Partial<DreamReflectionRequest>): void {
  const next = { ...getDreamReflectionRequest(entryId), ...patch };
  if (!next.loading && !next.reflection && !next.saving && !next.unsaved) requests.delete(entryId);
  else requests.set(entryId, next);
  listeners.forEach((listener) => listener());
}

/** Forget every request, e.g. when another user signs in. */
export function resetDreamReflectionRequests(): void {
  requests.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDreamReflectionRequest(entryId: string): DreamReflectionRequest {
  return useSyncExternalStore(subscribe, () => getDreamReflectionRequest(entryId));
}
