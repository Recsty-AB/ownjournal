/**
 * Storage round-trip for dream entries (type: 'dream', dream details, saved
 * dream reflection) across Simple mode, E2E v1 and E2E v2, both migration
 * directions and the startup snapshot.
 *
 * IndexedDB and encryption are replaced by in-memory fakes: "encryption" is a
 * reversible base64 wrap, enough to prove which fields end up inside the
 * payload and which end up in plaintext metadata.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { JournalEntryData } from '@/components/journal/JournalEntry';
import { DREAM_PATTERNS_REPORT_CLEARED, DREAM_PATTERNS_REPORT_KEY, type DreamReflection } from '@/types/dream';

const h = vi.hoisted(() => ({
  stores: new Map<string, Map<string, any>>(),
  e2e: { value: false },
  features: { CLOUD_CRYPTO_V2_WRITE: false } as Record<string, boolean>,
}));

function store(name: string): Map<string, any> {
  if (!h.stores.has(name)) h.stores.set(name, new Map());
  return h.stores.get(name)!;
}

vi.mock('@/utils/pwa', () => {
  const getStore = (name: string) => {
    if (!h.stores.has(name)) h.stores.set(name, new Map());
    return h.stores.get(name)!;
  };
  return {
    openDB: vi.fn(async () => ({
      transaction: () => ({
        objectStore: (name: string) => ({
          getAll: () => {
            const req: any = {};
            setTimeout(() => {
              req.result = Array.from(getStore(name).values()).map((v) => structuredClone(v));
              req.onsuccess?.();
            }, 0);
            return req;
          },
          clear: () => {
            const req: any = {};
            getStore(name).clear();
            setTimeout(() => req.onsuccess?.(), 0);
            return req;
          },
          delete: (key: string) => {
            getStore(name).delete(key);
            return {};
          },
        }),
      }),
    })),
    saveToIndexedDB: vi.fn(async (name: string, value: any) => {
      getStore(name).set(value.id ?? value.key, structuredClone(value));
    }),
    getFromIndexedDB: vi.fn(async (name: string, key: string) => {
      const v = getStore(name).get(key);
      return v === undefined ? undefined : structuredClone(v);
    }),
  };
});

vi.mock('@/utils/encryption', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/encryption')>();
  const toBase64 = (buf: ArrayBuffer) => Buffer.from(new Uint8Array(buf)).toString('base64');
  const fromBase64 = (s: string) => {
    const b = Buffer.from(s, 'base64');
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  return {
    ...actual,
    arrayBufferToBase64: vi.fn(toBase64),
    base64ToArrayBuffer: vi.fn(fromBase64),
    encryptData: vi.fn(async (text: string) => {
      const bytes = new TextEncoder().encode('ENC:' + text);
      return { encrypted: bytes.buffer.slice(0), iv: new Uint8Array([1, 2, 3, 4]).buffer };
    }),
    decryptData: vi.fn(async (buf: ArrayBuffer) => {
      const text = new TextDecoder().decode(new Uint8Array(buf));
      if (!text.startsWith('ENC:')) throw new Error('bad ciphertext');
      return text.slice(4);
    }),
  };
});

vi.mock('@/utils/encryptionModeStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/encryptionModeStorage')>();
  return { ...actual, isE2EEnabled: () => h.e2e.value };
});

vi.mock('@/config/features', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/features')>();
  return { ...actual, FEATURES: h.features };
});

vi.mock('../cloudStorageService', () => ({
  cloudStorageService: {
    uploadToAll: vi.fn(),
    downloadFromPrimary: vi.fn(),
    listFromPrimary: vi.fn(),
    deleteFromAll: vi.fn(),
    getConnectedProviderNames: vi.fn(() => []),
    getPrimaryProvider: vi.fn(() => null),
  },
}));

vi.mock('../aiMetadataService', () => ({
  aiMetadataService: {
    getMetadata: vi.fn(async () => null),
    setMetadata: vi.fn(async () => undefined),
  },
}));

vi.mock('../connectionStateManager', () => ({
  connectionStateManager: {
    ensureConnections: vi.fn().mockResolvedValue(undefined),
    getConnectedProviderNames: vi.fn(() => []),
    getPrimaryProvider: vi.fn(() => null),
    subscribe: vi.fn(() => () => {}),
  },
}));

import { storageServiceV2 } from '../storageServiceV2';
import { setCurrentUserId } from '@/utils/userScope';
import { convertStoredPatternsReport } from '../dreamPatternsReportStore';

const SAVED_REPORT = {
  version: 1,
  createdAt: '2026-11-19T08:00:00.000Z',
  dreamCount: 5,
  overview: 'Searching runs through your dreams.',
  recurring: [],
  changes: [],
  questions: [],
};

const service = storageServiceV2 as any;

const reflection: DreamReflection = {
  version: 1,
  createdAt: '2026-11-18T07:00:00.000Z',
  contentHash: 'h1x9',
  summary: 'A house with rooms you had not seen before.',
  themes: [{ title: 'Discovery', note: 'New rooms appear.' }],
  images: [{ image: 'house', possibilities: 'the self' }],
  wakingLinks: ['New job'],
  questions: ['What did the hidden room hold?'],
  coded: { characters: ['self'], settings: ['house'], emotions: ['curiosity'], themes: ['discovery'] },
  care: 'none',
};

function dreamEntry(id = 'dream-1'): JournalEntryData {
  return {
    id,
    title: 'Hidden rooms',
    body: 'I walked through my old house and found a door I had never seen.',
    tags: ['house'],
    mood: 'okay',
    activities: [],
    images: [],
    date: new Date('2026-11-18T06:30:00.000Z'),
    createdAt: new Date('2026-11-18T06:35:00.000Z'),
    updatedAt: new Date('2026-11-18T06:40:00.000Z'),
    type: 'dream',
    dream: { feelings: ['curiosity', 'awe'], recurring: true, lucid: true },
    dreamReflection: reflection,
  };
}

function noteEntry(id = 'note-1'): JournalEntryData {
  return {
    id,
    title: 'Groceries',
    body: 'Milk, eggs',
    tags: [],
    mood: 'okay',
    activities: [],
    images: [],
    date: new Date('2026-11-17T10:00:00.000Z'),
    createdAt: new Date('2026-11-17T10:00:00.000Z'),
    updatedAt: new Date('2026-11-17T10:00:00.000Z'),
    type: 'note',
  };
}

function plainEntry(id = 'entry-1'): JournalEntryData {
  return {
    id,
    title: 'A day',
    body: 'Went for a walk.',
    tags: ['walk'],
    mood: 'good',
    activities: ['walking'],
    images: [],
    date: new Date('2026-11-16T10:00:00.000Z'),
    createdAt: new Date('2026-11-16T10:00:00.000Z'),
    updatedAt: new Date('2026-11-16T10:00:00.000Z'),
  };
}

function stored(id: string) {
  return store('entries').get(id);
}

function decodePayload(raw: any): any {
  if (!raw.iv) return JSON.parse(raw.encryptedData);
  const text = Buffer.from(raw.encryptedData, 'base64').toString('utf8');
  expect(text.startsWith('ENC:')).toBe(true);
  return JSON.parse(text.slice(4));
}

function expectNoDreamInMetadata(raw: any) {
  expect(raw.metadata).not.toHaveProperty('dream');
  expect(raw.metadata).not.toHaveProperty('dreamReflection');
  const metaJson = JSON.stringify(raw.metadata);
  expect(metaJson).not.toContain('curiosity');
  expect(metaJson).not.toContain('Hidden rooms');
  expect(metaJson).not.toContain(reflection.summary);
}

function expectDreamRoundTrip(loaded: JournalEntryData | null) {
  expect(loaded).not.toBeNull();
  expect(loaded!.type).toBe('dream');
  expect(loaded!.dream).toEqual({ feelings: ['curiosity', 'awe'], recurring: true, lucid: true });
  expect(loaded!.dreamReflection).toEqual(reflection);
  expect(loaded!.title).toBe('Hidden rooms');
  expect(loaded!.tags).toEqual(['house']);
}

type Mode = 'simple' | 'e2e-v1' | 'e2e-v2';

function setMode(mode: Mode) {
  h.e2e.value = mode !== 'simple';
  h.features.CLOUD_CRYPTO_V2_WRITE = mode === 'e2e-v2';
  service.masterKey = mode === 'simple' ? null : ({} as CryptoKey);
}

describe('storageServiceV2 dream entries', () => {
  beforeEach(() => {
    h.stores.clear();
    setMode('simple');
    service.initializationPromise = null;
  });

  describe.each<Mode>(['simple', 'e2e-v1', 'e2e-v2'])('save and load in %s', (mode) => {
    beforeEach(() => setMode(mode));

    it('keeps type, details and reflection; dream fields only in the payload', async () => {
      await storageServiceV2.saveEntry(dreamEntry());

      const raw = stored('dream-1');
      expect(Boolean(raw.iv)).toBe(mode !== 'simple');
      expectNoDreamInMetadata(raw);

      const payload = decodePayload(raw);
      expect(payload.dream).toEqual({ feelings: ['curiosity', 'awe'], recurring: true, lucid: true });
      expect(payload.dreamReflection).toEqual(reflection);

      // type follows its existing route
      if (mode === 'e2e-v2') {
        expect(raw.metadata.type).toBeUndefined();
        expect(payload.type).toBe('dream');
      } else {
        expect(raw.metadata.type).toBe('dream');
      }

      expectDreamRoundTrip(await storageServiceV2.getEntry('dream-1'));
      const all = await storageServiceV2.getAllEntries();
      expectDreamRoundTrip(all.find((e) => e.id === 'dream-1') ?? null);
    });

    it('omits dream keys from the payload when not defined', async () => {
      const entry = dreamEntry();
      delete entry.dream;
      delete entry.dreamReflection;
      await storageServiceV2.saveEntry(entry);

      const payload = decodePayload(stored('dream-1'));
      expect(payload).not.toHaveProperty('dream');
      expect(payload).not.toHaveProperty('dreamReflection');

      // A loaded dream always has details (the reflection card tells a dream
      // that is not loaded yet by their absence).
      const loaded = await storageServiceV2.getEntry('dream-1');
      expect(loaded!.type).toBe('dream');
      expect(loaded!.dream).toEqual({ feelings: [] });
      expect(loaded).not.toHaveProperty('dreamReflection');
    });

    it('notes and ordinary entries behave as before', async () => {
      await storageServiceV2.saveEntry(noteEntry());
      await storageServiceV2.saveEntry(plainEntry());

      const note = await storageServiceV2.getEntry('note-1');
      expect(note!.type).toBe('note');
      expect(note).not.toHaveProperty('dream');
      expect(note).not.toHaveProperty('dreamReflection');

      const plain = await storageServiceV2.getEntry('entry-1');
      expect(plain).not.toHaveProperty('type');
      expect(plain!.mood).toBe('good');
      expect(plain!.activities).toEqual(['walking']);

      for (const id of ['note-1', 'entry-1']) {
        const payload = decodePayload(stored(id));
        expect(payload).not.toHaveProperty('dream');
        expect(payload).not.toHaveProperty('dreamReflection');
      }
    });

    it('does not attach dream fields to a non-dream entry', async () => {
      // e.g. a dream switched back to an ordinary entry with stale fields
      const entry = { ...dreamEntry(), type: undefined } as JournalEntryData;
      await storageServiceV2.saveEntry(entry);

      const loaded = await storageServiceV2.getEntry('dream-1');
      expect(loaded).not.toHaveProperty('type');
      expect(loaded).not.toHaveProperty('dream');
      expect(loaded).not.toHaveProperty('dreamReflection');
      // Switching a dream off drops its details from what is stored, too.
      const payload = decodePayload(stored('dream-1'));
      expect(payload).not.toHaveProperty('dream');
      expect(payload).not.toHaveProperty('dreamReflection');
    });
  });

  it('sanitizes malformed stored dream fields', async () => {
    store('entries').set('dream-x', {
      id: 'dream-x',
      iv: '',
      encryptedData: JSON.stringify({
        title: 't',
        body: 'b',
        images: [],
        dream: { feelings: ['joy', 'nope', 'joy'], nightmare: 'yes' },
        dreamReflection: { version: 2, summary: 's', createdAt: 'x' },
      }),
      metadata: {
        date: '2026-11-18T00:00:00.000Z',
        tags: [],
        mood: 'okay',
        createdAt: '2026-11-18T00:00:00.000Z',
        updatedAt: '2026-11-18T00:00:00.000Z',
        type: 'dream',
      },
    });

    const loaded = await storageServiceV2.getEntry('dream-x');
    expect(loaded!.dream).toEqual({ feelings: ['joy'] });
    expect(loaded).not.toHaveProperty('dreamReflection');
  });

  describe.each<'e2e-v1' | 'e2e-v2'>(['e2e-v1', 'e2e-v2'])('migrations with %s', (e2eMode) => {
    it('Simple to E2E keeps type and dream fields', async () => {
      setMode('simple');
      await storageServiceV2.saveEntry(dreamEntry());
      await storageServiceV2.saveEntry(noteEntry());

      store('settings').set(DREAM_PATTERNS_REPORT_KEY, { key: DREAM_PATTERNS_REPORT_KEY, value: SAVED_REPORT });

      setMode(e2eMode);
      const result = await storageServiceV2.migrateEntriesToE2E();
      expect(result).toEqual({ migrated: 2, skipped: 0, failed: 0 });

      // The saved Dream patterns report is encrypted along with the entries.
      const report = store('settings').get(DREAM_PATTERNS_REPORT_KEY).value;
      expect(typeof report.ciphertext).toBe('string');
      expect(JSON.stringify(report)).not.toContain('Searching');

      const raw = stored('dream-1');
      expect(raw.iv).toBeTruthy();
      expectNoDreamInMetadata(raw);
      const payload = decodePayload(raw);
      expect(payload.dreamReflection).toEqual(reflection);
      if (e2eMode === 'e2e-v2') {
        expect(raw.metadata.type).toBeUndefined();
        expect(payload.type).toBe('dream');
      }

      expectDreamRoundTrip(await storageServiceV2.getEntry('dream-1'));
      expect((await storageServiceV2.getEntry('note-1'))!.type).toBe('note');
    });

    it('E2E to Simple keeps type and dream fields', async () => {
      setMode(e2eMode);
      await storageServiceV2.saveEntry(dreamEntry());
      await storageServiceV2.saveEntry(noteEntry());
      store('settings').set(DREAM_PATTERNS_REPORT_KEY, { key: DREAM_PATTERNS_REPORT_KEY, value: SAVED_REPORT });
      await convertStoredPatternsReport(storageServiceV2.getMasterKey()!, true);
      expect(JSON.stringify(store('settings').get(DREAM_PATTERNS_REPORT_KEY))).not.toContain('Searching');

      const result = await storageServiceV2.migrateEntriesToSimple();
      expect(result).toEqual({ migrated: 2, skipped: 0, failed: 0 });

      // The saved Dream patterns report stays readable without the key.
      expect(store('settings').get(DREAM_PATTERNS_REPORT_KEY).value).toEqual(SAVED_REPORT);

      setMode('simple');
      const raw = stored('dream-1');
      expect(raw.iv).toBe('');
      expectNoDreamInMetadata(raw);
      expect(raw.metadata.type).toBe('dream');
      expect(JSON.parse(raw.encryptedData).dream).toEqual({
        feelings: ['curiosity', 'awe'],
        recurring: true,
        lucid: true,
      });

      expectDreamRoundTrip(await storageServiceV2.getEntry('dream-1'));
      expect((await storageServiceV2.getEntry('note-1'))!.type).toBe('note');
    });
  });

  it.each<'e2e-v1' | 'e2e-v2'>(['e2e-v1', 'e2e-v2'])(
    'cloud Simple to E2E migration keeps type and dream fields (%s)',
    async (e2eMode) => {
      const { cloudStorageService } = await import('../cloudStorageService');
      setMode('simple');
      await storageServiceV2.saveEntry(dreamEntry());
      const simpleFile = JSON.stringify(stored('dream-1'));
      store('entries').clear();

      setMode(e2eMode);
      const uploads: Record<string, string> = {};
      (cloudStorageService as any).listFiles = vi.fn(async () => [
        { name: 'entry-dream-1.json', path: 'entries/entry-dream-1.json' },
      ]);
      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(simpleFile as any);
      vi.mocked(cloudStorageService.uploadToAll).mockImplementation(async (path: string, content: string) => {
        uploads[path] = content;
      });

      await service.migrateSimpleModeEntriesToE2E();

      const uploaded = JSON.parse(uploads['entries/entry-dream-1.json']);
      expect(uploaded.iv).toBeTruthy();
      expectNoDreamInMetadata(uploaded);
      const payload = decodePayload(uploaded);
      expect(payload.dream).toEqual({ feelings: ['curiosity', 'awe'], recurring: true, lucid: true });
      expect(payload.dreamReflection).toEqual(reflection);
      if (e2eMode === 'e2e-v2') {
        expect(uploaded.metadata.type).toBeUndefined();
        expect(payload.type).toBe('dream');
      } else {
        expect(uploaded.metadata.type).toBe('dream');
      }

      expectDreamRoundTrip(await storageServiceV2.getEntry('dream-1'));
    },
  );

  it('Delete all entries also removes the saved Dream patterns report', async () => {
    store('settings').set(DREAM_PATTERNS_REPORT_KEY, { key: DREAM_PATTERNS_REPORT_KEY, value: { overview: 'Searching.' } });
    store('settings').set('unrelated', { key: 'unrelated', value: 1 });
    const cloud = vi.spyOn(storageServiceV2 as any, 'deleteAllCloudData').mockResolvedValue(undefined);
    const cleared = vi.fn();
    window.addEventListener(DREAM_PATTERNS_REPORT_CLEARED, cleared);

    await storageServiceV2.deleteAllEntries();

    expect(store('settings').has(DREAM_PATTERNS_REPORT_KEY)).toBe(false);
    expect(store('settings').has('unrelated')).toBe(true);
    expect(cleared).toHaveBeenCalledTimes(1);
    window.removeEventListener(DREAM_PATTERNS_REPORT_CLEARED, cleared);
    cloud.mockRestore();
  });

  it('snapshot keeps type dream without dream details or reflection', async () => {
    setCurrentUserId('user-1');
    await storageServiceV2.saveEntrySnapshot([dreamEntry(), noteEntry(), plainEntry()]);

    const record = store('settings').get('cachedEntrySnapshot');
    const json = JSON.stringify(record.value);
    expect(json).not.toContain('dreamReflection');
    expect(json).not.toContain('"dream":');
    for (const item of record.value) {
      expect(item).not.toHaveProperty('dream');
      expect(item).not.toHaveProperty('body');
    }
    expect(json).not.toContain('curiosity');
    expect(json).not.toContain(reflection.summary);

    const loaded = await storageServiceV2.loadEntrySnapshot();
    const byId = Object.fromEntries(loaded.map((e) => [e.id, e]));
    expect(byId['dream-1'].type).toBe('dream');
    expect(byId['dream-1']).not.toHaveProperty('dream');
    expect(byId['dream-1']).not.toHaveProperty('dreamReflection');
    expect(byId['note-1'].type).toBe('note');
    expect(byId['entry-1']).not.toHaveProperty('type');
  });
});
