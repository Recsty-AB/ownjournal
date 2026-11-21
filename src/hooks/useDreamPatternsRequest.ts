import { useSyncExternalStore } from "react";
import { DREAM_PATTERNS_REPORT_CLEARED, type DreamPatternsReport } from "@/types/dream";
import { getCurrentUserId } from "@/utils/userScope";

/**
 * The Dream patterns request, kept outside the card that started it. The card
 * unmounts when the view switches to Notes or the insights are hidden; the
 * request carries on, and a remounted card must still show that it is running
 * (or a second tap would spend the second of the month's two reports) and must
 * show the report when it arrives.
 */
export interface DreamPatternsRequest {
  /** Waiting for the AI. */
  loading: boolean;
  /**
   * While dreams of the period that had no reflection get one, before the
   * report: the one being reflected on (from 1) and how many there are.
   */
  reflecting: { current: number; total: number } | null;
  /** The report made in this session; newer than the one saved on the device. */
  report: DreamPatternsReport | null;
}

const IDLE: DreamPatternsRequest = { loading: false, reflecting: null, report: null };
let state: DreamPatternsRequest = IDLE;
// The account the state belongs to: it is never shown to another one.
let owner: string | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export function getDreamPatternsRequest(): DreamPatternsRequest {
  return owner === getCurrentUserId() ? state : IDLE;
}

export function updateDreamPatternsRequest(patch: Partial<DreamPatternsRequest>): void {
  const next = { ...getDreamPatternsRequest(), ...patch };
  owner = getCurrentUserId();
  state = next.loading || next.report ? (next.loading ? next : { ...next, reflecting: null }) : IDLE;
  notify();
}

/** Forget the request and its report, e.g. when the user signs out. */
export function resetDreamPatternsRequest(): void {
  state = IDLE;
  owner = null;
  notify();
}

/**
 * Forget what `userId` left behind, for a request that ends after its user
 * signed out. Leaves the state alone when it is another account's by now.
 */
export function dropDreamPatternsRequestOf(userId: string | null): void {
  if (owner === userId) resetDreamPatternsRequest();
}

// "Delete all entries" removes the report, also while no card is on screen.
if (typeof window !== "undefined") {
  window.addEventListener(DREAM_PATTERNS_REPORT_CLEARED, () => updateDreamPatternsRequest({ report: null }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDreamPatternsRequest(): DreamPatternsRequest {
  return useSyncExternalStore(subscribe, getDreamPatternsRequest);
}
