import { useEffect, useSyncExternalStore } from "react";
import { aiUsageLimits } from "@/services/aiUsageLimits";

type DreamFeature = "dreamReflection" | "dreamPatterns";
type Usage = { current: number; limit: number };
type Snapshot = Record<DreamFeature, Usage>;

// One snapshot shared by every card: the usage cache is read once per change,
// not once per card, and a card re-renders only when its numbers change.
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function read(): Snapshot {
  const stats = aiUsageLimits.getUsageStats();
  return { dreamReflection: stats.dreamReflection, dreamPatterns: stats.dreamPatterns };
}

const same = (a: Usage, b: Usage) => a.current === b.current && a.limit === b.limit;

function onUsageChanged() {
  const next = read();
  if (snapshot && same(snapshot.dreamReflection, next.dreamReflection) && same(snapshot.dreamPatterns, next.dreamPatterns)) {
    return;
  }
  snapshot = {
    dreamReflection: snapshot && same(snapshot.dreamReflection, next.dreamReflection) ? snapshot.dreamReflection : next.dreamReflection,
    dreamPatterns: snapshot && same(snapshot.dreamPatterns, next.dreamPatterns) ? snapshot.dreamPatterns : next.dreamPatterns,
  };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!unsubscribe) unsubscribe = aiUsageLimits.subscribe(onUsageChanged);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribe?.();
      unsubscribe = null;
      // Read afresh next time: the cache may change while nothing listens.
      snapshot = null;
    }
  };
}

function getSnapshot(): Snapshot {
  if (!snapshot) snapshot = read();
  return snapshot;
}

/**
 * This month's dream usage, kept current in every component that shows it:
 * a reflection made on one dream updates the count on all the others, and so
 * does a sync with the server, which runs when the count is first shown so
 * that usage from another device appears before the first tap.
 */
export function useDreamUsage(feature: DreamFeature): Usage {
  const usage = useSyncExternalStore(subscribe, () => getSnapshot()[feature]);
  useEffect(() => {
    aiUsageLimits.syncIfStale();
  }, []);
  return usage;
}
