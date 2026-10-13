/**
 * App Store / Google Play in-app review prompt.
 *
 * Asks for a rating at most ONCE per user, and only after the user has
 * clearly settled in:
 * - native iOS/Android only (web and Electron have no store review sheet),
 * - at least REVIEW_MIN_ENTRIES journal entries (notes excluded),
 * - at least REVIEW_MIN_DAYS since the first journal save we saw for this user,
 * - triggered right after saving a new entry (never while writing),
 * - online and with no sync error in the current session.
 *
 * The threshold deliberately avoids the 10/30 entry milestones at which
 * DiscreetPlanBanner auto-expands, so a review prompt never lands on the
 * same save as the Plus banner.
 *
 * Uses the OS review sheet only (StoreKit / Play In-App Review). Store rules
 * forbid asking "do you like the app?" first and forwarding only happy users,
 * so there is no pre-question. The OS may decide not to show the sheet at all;
 * the request is still marked as done so we never ask again.
 *
 * State is user-scoped localStorage (see userScope.ts) and survives sign-out.
 */

import { getPlatformInfo } from "@/utils/platformDetection";
import { getCurrentUserId, scopedKey } from "@/utils/userScope";

export const REVIEW_MIN_ENTRIES = 15;
export const REVIEW_MIN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const REQUESTED_KEY = "app_review_requested";
const FIRST_SAVE_KEY = "app_review_first_save";

export interface ReviewPromptContext {
  /** Journal entry count (excluding notes) after the save. */
  entryCount: number;
  /** Whether a sync error occurred earlier in this session. */
  hadSyncError: boolean;
}

function isStoreBuild(): boolean {
  const { platform } = getPlatformInfo();
  return platform === "capacitor-ios" || platform === "capacitor-android";
}

/**
 * Returns the time of the first journal save seen for the current user,
 * recording `now` if none is stored yet.
 */
function getFirstSaveTime(now: number): number {
  const key = scopedKey(FIRST_SAVE_KEY);
  const stored = Number(localStorage.getItem(key));
  if (stored > 0) return stored;
  localStorage.setItem(key, String(now));
  return now;
}

/**
 * Call after a new journal entry was saved successfully. Requests the OS
 * review sheet when every condition above holds; resolves to true when a
 * request was made.
 */
export async function maybeRequestAppReview(
  { entryCount, hadSyncError }: ReviewPromptContext,
  now: number = Date.now(),
): Promise<boolean> {
  if (!isStoreBuild() || !getCurrentUserId()) return false;

  try {
    if (localStorage.getItem(scopedKey(REQUESTED_KEY))) return false;

    const firstSave = getFirstSaveTime(now);
    if (now - firstSave < REVIEW_MIN_DAYS * DAY_MS) return false;
    if (entryCount < REVIEW_MIN_ENTRIES) return false;
    if (hadSyncError || !navigator.onLine) return false;

    // Mark first: once per user, whether or not the OS shows the sheet.
    localStorage.setItem(scopedKey(REQUESTED_KEY), String(now));
  } catch {
    // Without persistence we can't guarantee "once", so don't ask.
    return false;
  }

  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn("In-app review request failed:", error);
    return false;
  }
}
