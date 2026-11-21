import { scopedKey } from '@/utils/userScope';

const SEEN_KEY = 'feature-tip-dreams-voice-seen';

/** Per account on this device; read on every render, since the account is known only after sign-in. */
export function hasSeenFeatureTip(): boolean {
  try {
    return localStorage.getItem(scopedKey(SEEN_KEY)) === 'true';
  } catch {
    return false;
  }
}

export function setFeatureTipSeen(): void {
  try {
    localStorage.setItem(scopedKey(SEEN_KEY), 'true');
  } catch {
    // Shown again next time if storage is unavailable.
  }
}
