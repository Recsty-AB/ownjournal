import { describe, it, expect, beforeEach, vi } from 'vitest';

let currentPlatform = 'capacitor-ios';
vi.mock('@/utils/platformDetection', () => ({
  getPlatformInfo: () => ({ platform: currentPlatform }),
}));

const requestReview = vi.fn();
vi.mock('@capacitor-community/in-app-review', () => ({
  InAppReview: { requestReview: () => requestReview() },
}));

import {
  maybeRequestAppReview,
  REVIEW_MIN_DAYS,
  REVIEW_MIN_ENTRIES,
} from '../appReviewService';
import { setCurrentUserId } from '@/utils/userScope';

const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 0, 1);
const LATER = START + REVIEW_MIN_DAYS * DAY_MS;
const ready = { entryCount: REVIEW_MIN_ENTRIES, hadSyncError: false };

/** Records the first save at START, then asks again at `now`. */
async function askAfterFirstSave(now: number, ctx = ready) {
  await maybeRequestAppReview({ entryCount: 1, hadSyncError: false }, START);
  return maybeRequestAppReview(ctx, now);
}

describe('appReviewService', () => {
  beforeEach(() => {
    localStorage.clear();
    requestReview.mockReset();
    requestReview.mockResolvedValue(undefined);
    currentPlatform = 'capacitor-ios';
    setCurrentUserId('user-a');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('requests a review once the user has enough entries and days', async () => {
    expect(await askAfterFirstSave(LATER)).toBe(true);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('works on Android too', async () => {
    currentPlatform = 'capacitor-android';
    expect(await askAfterFirstSave(LATER)).toBe(true);
  });

  it('asks only once per user, even across later saves', async () => {
    await askAfterFirstSave(LATER);
    expect(await maybeRequestAppReview(ready, LATER + 30 * DAY_MS)).toBe(false);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when the OS request fails', async () => {
    requestReview.mockRejectedValueOnce(new Error('unavailable'));
    expect(await askAfterFirstSave(LATER)).toBe(false);
    expect(await maybeRequestAppReview(ready, LATER + DAY_MS)).toBe(false);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it('tracks the once-per-user flag separately for each user', async () => {
    await askAfterFirstSave(LATER);
    setCurrentUserId('user-b');
    expect(await askAfterFirstSave(LATER)).toBe(true);
    expect(requestReview).toHaveBeenCalledTimes(2);
  });

  it('waits until enough days have passed since the first save', async () => {
    expect(await askAfterFirstSave(LATER - DAY_MS)).toBe(false);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('waits for enough journal entries', async () => {
    const ctx = { entryCount: REVIEW_MIN_ENTRIES - 1, hadSyncError: false };
    expect(await askAfterFirstSave(LATER, ctx)).toBe(false);
  });

  it('skips sessions that had a sync error', async () => {
    expect(await askAfterFirstSave(LATER, { ...ready, hadSyncError: true })).toBe(false);
    // Still eligible later on.
    expect(await maybeRequestAppReview(ready, LATER + DAY_MS)).toBe(true);
  });

  it('skips while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(await askAfterFirstSave(LATER)).toBe(false);
  });

  it.each(['web', 'electron-mac'])('never asks on %s', async (platform) => {
    currentPlatform = platform;
    expect(await askAfterFirstSave(LATER)).toBe(false);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('never asks before a user is signed in', async () => {
    setCurrentUserId(null);
    expect(await askAfterFirstSave(LATER)).toBe(false);
  });
});
