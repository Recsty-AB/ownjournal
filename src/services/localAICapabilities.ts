/**
 * Local AI capability detection.
 *
 * Determines whether the current device can run Qwen3.5-4B (mobile
 * minimum) and, on desktop, whether it can run Qwen3.5-9B.
 *
 * Detection runs in four layers that degrade gracefully:
 *
 *   1. Hard gates: WebGPU adapter must actually be requestable
 *      (wrapped in a timeout so broken drivers don't hang the check).
 *   2. Platform-aware RAM estimation with an iOS fallback via the
 *      iPhone model-identifier table (Safari does not expose
 *      navigator.deviceMemory). Capacitor's Device plugin is not
 *      installed, so on Capacitor iOS we parse the UA string for
 *      public iPhone model names when available and otherwise return
 *      `null` to let the user opt in with runtime validation.
 *   3. Storage quota check.
 *   4. (Optional, not part of passive detection.) A runtime WebGPU
 *      smoke test that the caller can trigger explicitly before a
 *      large download.
 */

import { LOCAL_AI_MODELS, LocalAIModelId, type LocalAIPlatform } from '@/config/localAIModels';
import { getPlatformInfo } from '@/utils/platformDetection';

export type UnsupportedReason =
  | 'no-webgpu'
  | 'insufficient-ram'
  | 'insufficient-storage'
  | 'unsupported-platform';

export type LocalAICapability =
  | {
      tier: 'unsupported';
      reason: UnsupportedReason;
      detail: string;
      detected: DetectedSpecs;
    }
  | {
      tier: 'mobile-4b';
      availableModels: LocalAIModelId[];
      detected: DetectedSpecs;
    }
  | {
      tier: 'desktop-4b';
      availableModels: LocalAIModelId[];
      detected: DetectedSpecs;
    }
  | {
      tier: 'desktop-9b-capable';
      availableModels: LocalAIModelId[];
      detected: DetectedSpecs;
    };

export interface DetectedSpecs {
  platform: LocalAIPlatform | 'unknown';
  hasWebGPU: boolean;
  estimatedRamBytes: number | null;
  ramSource: 'navigator.deviceMemory' | 'ua-iphone-identifier' | 'electron-os' | 'unknown';
  availableStorageBytes: number | null;
  userAgent: string;
}

/**
 * iPhone identifier → RAM (GB) lookup table.
 *
 * Apple's internal model identifiers (`iPhone17,3` etc.) are publicly
 * documented and are what both Capacitor's Device plugin and several
 * web fingerprinting libraries surface. When the app is running
 * inside Capacitor iOS without the Device plugin, we fall back to
 * parsing the UA string, but Safari's UA does not contain the
 * identifier — so realistic coverage is: Capacitor via `window.Capacitor`
 * expando (if a future release populates it), or unknown.
 *
 * iPhone 13 and earlier (4 GB) are unsupported.
 * iPhone 13 Pro / Pro Max through 15 non-Pro: 6 GB (supported).
 * iPhone 15 Pro, 16 series, 17 series: 8 GB (supported).
 * iPhone 17 Pro: 12 GB (supported).
 */
const IPHONE_IDENTIFIER_RAM_GB: Record<string, number> = {
  // iPhone 12 series — 4 GB, all unsupported
  'iPhone13,1': 4, 'iPhone13,2': 4, 'iPhone13,3': 4, 'iPhone13,4': 4,
  // iPhone 13 / 13 mini — 4 GB, unsupported
  'iPhone14,4': 4, 'iPhone14,5': 4,
  // iPhone 13 Pro / Pro Max — 6 GB, supported
  'iPhone14,2': 6, 'iPhone14,3': 6,
  // iPhone SE 3 — 4 GB, unsupported
  'iPhone14,6': 4,
  // iPhone 14 / 14 Plus — 6 GB, supported
  'iPhone14,7': 6, 'iPhone14,8': 6,
  // iPhone 14 Pro / Pro Max — 6 GB, supported
  'iPhone15,2': 6, 'iPhone15,3': 6,
  // iPhone 15 / 15 Plus — 6 GB, supported
  'iPhone15,4': 6, 'iPhone15,5': 6,
  // iPhone 15 Pro / Pro Max — 8 GB, supported
  'iPhone16,1': 8, 'iPhone16,2': 8,
  // iPhone 16 / 16 Plus — 8 GB, supported
  'iPhone17,3': 8, 'iPhone17,4': 8,
  // iPhone 16 Pro / Pro Max — 8 GB, supported
  'iPhone17,1': 8, 'iPhone17,2': 8,
  // iPhone 17 series — 8 GB baseline, 12 GB Pro (speculative, will refine when published)
  'iPhone18,1': 8, 'iPhone18,2': 8, 'iPhone18,3': 12, 'iPhone18,4': 12,
};

/**
 * Estimate iPhone RAM in GB from a model identifier string.
 * Returns null if the identifier is unknown.
 */
export function estimateIPhoneRAMFromIdentifier(identifier: string): number | null {
  return IPHONE_IDENTIFIER_RAM_GB[identifier] ?? null;
}

/**
 * Check whether WebGPU is actually usable — navigator.gpu exists AND
 * a real adapter can be requested. Wrapped in a timeout so broken
 * drivers can't hang the check indefinitely.
 */
export async function checkWebGPU(timeoutMs = 3000): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
  if (!gpu?.requestAdapter) return false;
  try {
    const adapterPromise = gpu.requestAdapter();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const adapter = await Promise.race([adapterPromise, timeoutPromise]);
    return adapter !== null && adapter !== undefined;
  } catch {
    return false;
  }
}

/**
 * Estimate the current device's RAM in bytes. Strategy:
 *
 *   1. Electron desktop → query os.totalmem() via IPC
 *   2. Chromium/Android → navigator.deviceMemory (capped at 8 GB)
 *   3. iOS → iPhone identifier table via window.Capacitor expando if
 *      present, otherwise unknown
 */
export async function estimateRAM(): Promise<{
  bytes: number | null;
  source: DetectedSpecs['ramSource'];
}> {
  const electronApi = (window as unknown as {
    electronAPI?: { getSystemRAM?: () => Promise<number> };
  }).electronAPI;
  if (electronApi?.getSystemRAM) {
    try {
      const bytes = await electronApi.getSystemRAM();
      if (typeof bytes === 'number' && bytes > 0) {
        return { bytes, source: 'electron-os' };
      }
    } catch {
      // fall through
    }
  }

  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (typeof deviceMemory === 'number' && deviceMemory > 0) {
    return { bytes: deviceMemory * 1_000_000_000, source: 'navigator.deviceMemory' };
  }

  // iOS fallback — look for an identifier on the Capacitor expando.
  // Future Capacitor Device plugin integration should populate this.
  const capacitor = (window as unknown as { Capacitor?: { deviceIdentifier?: string } }).Capacitor;
  if (capacitor?.deviceIdentifier) {
    const gb = estimateIPhoneRAMFromIdentifier(capacitor.deviceIdentifier);
    if (gb !== null) {
      return { bytes: gb * 1_000_000_000, source: 'ua-iphone-identifier' };
    }
  }

  return { bytes: null, source: 'unknown' };
}

/**
 * Check available persistent storage. Returns bytes or null if the
 * Storage API is not supported.
 */
export async function estimateAvailableStorage(): Promise<number | null> {
  if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? null;
    const usage = estimate.usage ?? 0;
    if (quota === null) return null;
    return Math.max(0, quota - usage);
  } catch {
    return null;
  }
}

/**
 * Detect whether this is a mobile device, including the case where a
 * mobile phone loads the web PWA in Chrome/Safari (no Capacitor).
 * Returns 'mobile' for phones, 'desktop' for laptops/desktops,
 * 'unknown' for anything unrecognized.
 */
export function detectPlatformForLocalAI(): LocalAIPlatform | 'unknown' {
  const platformInfo = getPlatformInfo();

  // Electron desktop / Capacitor iOS/Android are authoritative
  if (platformInfo.isDesktop) return 'desktop';
  if (platformInfo.isMobile) return 'mobile';

  // Web PWA — UA-sniff to distinguish phone from desktop.
  // This prevents Chrome-on-Android users from being offered the
  // desktop 9B tier just because no Capacitor bridge is present.
  if (platformInfo.isWeb) {
    const ua = navigator.userAgent || '';
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
    return isMobileUA ? 'mobile' : 'desktop';
  }

  return 'unknown';
}

/**
 * Run the full capability detection and return the resulting tier.
 * This is the single function the UI should call.
 */
export async function detectLocalAICapability(): Promise<LocalAICapability> {
  const platform = detectPlatformForLocalAI();

  const [hasWebGPU, ramResult, storage] = await Promise.all([
    checkWebGPU(),
    estimateRAM(),
    estimateAvailableStorage(),
  ]);

  const detected: DetectedSpecs = {
    platform,
    hasWebGPU,
    estimatedRamBytes: ramResult.bytes,
    ramSource: ramResult.source,
    availableStorageBytes: storage,
    userAgent: navigator.userAgent,
  };

  if (platform === 'unknown') {
    return {
      tier: 'unsupported',
      reason: 'unsupported-platform',
      detail: 'Local AI requires a mobile or desktop build of OwnJournal.',
      detected,
    };
  }

  if (!hasWebGPU) {
    return {
      tier: 'unsupported',
      reason: 'no-webgpu',
      detail: 'Your device does not support WebGPU, which is required for on-device AI.',
      detected,
    };
  }

  const fourB = LOCAL_AI_MODELS['qwen3.5-4b'];

  if (storage !== null && storage < fourB.downloadSizeBytes * 1.2) {
    return {
      tier: 'unsupported',
      reason: 'insufficient-storage',
      detail: `Local AI needs at least ${formatBytesShort(fourB.downloadSizeBytes * 1.2)} of free space.`,
      detected,
    };
  }

  if (ramResult.bytes !== null && ramResult.bytes < fourB.requiredSystemRamBytes) {
    return {
      tier: 'unsupported',
      reason: 'insufficient-ram',
      detail: `Local AI requires at least ${formatBytesShort(fourB.requiredSystemRamBytes)} of RAM.`,
      detected,
    };
  }

  if (platform === 'mobile') {
    return {
      tier: 'mobile-4b',
      availableModels: ['qwen3.5-4b'],
      detected,
    };
  }

  const nineB = LOCAL_AI_MODELS['qwen3.5-9b'];
  const nineBCapable =
    ramResult.bytes !== null &&
    ramResult.bytes >= nineB.requiredSystemRamBytes &&
    (storage === null || storage >= nineB.downloadSizeBytes * 1.2);

  if (nineBCapable) {
    return {
      tier: 'desktop-9b-capable',
      availableModels: ['qwen3.5-4b', 'qwen3.5-9b'],
      detected,
    };
  }

  return {
    tier: 'desktop-4b',
    availableModels: ['qwen3.5-4b'],
    detected,
  };
}

/**
 * Re-check only the storage quota. Used right before starting a
 * download so we fail fast if the user filled their disk between the
 * initial detection and clicking the download button.
 */
export async function checkStorageForDownload(
  downloadSizeBytes: number,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const free = await estimateAvailableStorage();
  if (free === null) return { ok: true }; // can't check, trust user
  if (free < downloadSizeBytes * 1.2) {
    return {
      ok: false,
      detail: `Not enough free space. Local AI needs at least ${formatBytesShort(
        downloadSizeBytes * 1.2,
      )} free; you have ${formatBytesShort(free)}.`,
    };
  }
  return { ok: true };
}

function formatBytesShort(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${bytes} B`;
}
