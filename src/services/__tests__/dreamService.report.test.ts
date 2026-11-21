/**
 * The saved Dream patterns report summarises dream content, so in an
 * encrypted journal it is stored encrypted and cannot be read while locked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DreamPatternsReport } from '@/types/dream';
import { DREAM_PATTERNS_REPORT_KEY } from '@/types/dream';

const h = vi.hoisted(() => ({
  settings: new Map<string, any>(),
  key: null as unknown,
  e2e: false,
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('@/utils/pwa', () => ({
  getFromIndexedDB: vi.fn(async (_store: string, key: string) => structuredClone(h.settings.get(key))),
  saveToIndexedDB: vi.fn(async (_store: string, value: any) => {
    h.settings.set(value.key, structuredClone(value));
  }),
}));
vi.mock('@/utils/encryptionModeStorage', () => ({ isE2EEnabled: () => h.e2e }));
vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: { getMasterKey: () => h.key, onMasterKeyChanged: () => () => {} },
}));
// A reversible stand-in for AES-GCM: enough to see what is stored in the clear.
vi.mock('@/utils/encryption', () => ({
  encryptData: vi.fn(async (text: string) => ({
    encrypted: new TextEncoder().encode([...text].reverse().join('')).buffer,
    iv: new Uint8Array([1, 2, 3]).buffer,
  })),
  decryptData: vi.fn(async (buf: ArrayBuffer) => [...new TextDecoder().decode(buf)].reverse().join('')),
  arrayBufferToBase64: (buf: ArrayBuffer) => Buffer.from(new Uint8Array(buf)).toString('base64'),
  base64ToArrayBuffer: (s: string) => {
    const b = Buffer.from(s, 'base64');
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  },
}));

import { isJournalLocked, loadPatternsReport, savePatternsReport } from '../dreamService';
import { convertStoredPatternsReport } from '../dreamPatternsReportStore';

const REPORT: DreamPatternsReport = {
  version: 1,
  createdAt: '2026-11-19T08:00:00.000Z',
  dreamCount: 5,
  overview: 'Your sister and the sea keep returning.',
  recurring: [{ kind: 'character', label: 'sister', count: 4, note: 'Often guiding you.' }],
  changes: [],
  questions: ['What are you looking for?'],
};

const storedText = () => JSON.stringify(h.settings.get(DREAM_PATTERNS_REPORT_KEY));

beforeEach(() => {
  h.settings.clear();
  h.key = null;
  h.e2e = false;
});

describe('Dream patterns report storage', () => {
  it('stores the report encrypted in an encrypted journal and reads it back once unlocked', async () => {
    h.e2e = true;
    h.key = {} as CryptoKey;

    await savePatternsReport(REPORT);

    const stored = JSON.stringify(h.settings.get(DREAM_PATTERNS_REPORT_KEY));
    expect(stored).not.toContain('sister');
    expect(stored).not.toContain('sea');
    expect(await loadPatternsReport()).toEqual(REPORT);
  });

  it('cannot read the report while the journal is locked', async () => {
    h.e2e = true;
    h.key = {} as CryptoKey;
    await savePatternsReport(REPORT);

    h.key = null;

    expect(isJournalLocked()).toBe(true);
    expect(await loadPatternsReport()).toBeNull();
  });

  it('never writes the report in the clear in an encrypted journal', async () => {
    h.e2e = true;

    await savePatternsReport(REPORT);

    expect(h.settings.has(DREAM_PATTERNS_REPORT_KEY)).toBe(false);
  });

  it('hides a report left in the clear while an encrypted journal is locked, and encrypts it once unlocked', async () => {
    h.settings.set(DREAM_PATTERNS_REPORT_KEY, { key: DREAM_PATTERNS_REPORT_KEY, value: REPORT });
    h.e2e = true;

    expect(await loadPatternsReport()).toBeNull();

    h.key = {} as CryptoKey;

    expect(await loadPatternsReport()).toEqual(REPORT);
    expect(storedText()).not.toContain('sister');
    expect(await loadPatternsReport()).toEqual(REPORT);
  });

  it('encrypts the saved report when the journal becomes encrypted', async () => {
    await savePatternsReport(REPORT);
    expect(storedText()).toContain('sister');

    await convertStoredPatternsReport({} as CryptoKey, true);

    expect(storedText()).not.toContain('sister');
    h.e2e = true;
    h.key = {} as CryptoKey;
    expect(await loadPatternsReport()).toEqual(REPORT);
  });

  it('keeps the saved report readable when the journal stops being encrypted', async () => {
    h.e2e = true;
    h.key = {} as CryptoKey;
    await savePatternsReport(REPORT);

    await convertStoredPatternsReport(h.key as CryptoKey, false);

    // The key is discarded after the switch.
    h.e2e = false;
    h.key = null;
    expect(await loadPatternsReport()).toEqual(REPORT);
  });

  it('leaves the stored report alone when there is nothing to convert', async () => {
    await convertStoredPatternsReport({} as CryptoKey, false);
    expect(h.settings.has(DREAM_PATTERNS_REPORT_KEY)).toBe(false);

    await savePatternsReport(REPORT);
    const before = storedText();
    await convertStoredPatternsReport({} as CryptoKey, false);
    expect(storedText()).toBe(before);
  });

  it('keeps the report as is in a journal without encryption', async () => {
    await savePatternsReport(REPORT);

    expect(isJournalLocked()).toBe(false);
    expect(await loadPatternsReport()).toEqual(REPORT);
  });
});
