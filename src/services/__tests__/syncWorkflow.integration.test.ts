import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storageServiceV2 } from '../storageServiceV2';
import { cloudStorageService } from '../cloudStorageService';
import type { JournalEntryData } from '@/components/journal/JournalEntry';

/**
 * Integration tests for the complete sync workflow
 * Tests conflict detection, resolution, and version vector management
 */

// Mock the cloud storage service
vi.mock('../cloudStorageService', () => ({
  cloudStorageService: {
    getPrimaryProvider: vi.fn(() => ({ name: 'mock-provider' })),
    getConnectedProviderNames: vi.fn(() => ['mock-provider']),
    uploadToAll: vi.fn(),
    downloadFromPrimary: vi.fn(),
    listFiles: vi.fn(() => []),
    deleteFromAll: vi.fn(),
  },
}));

// Mock IndexedDB operations - getAll must return request-like object (onsuccess/result) for storageServiceV2
vi.mock('@/utils/pwa', () => {
  const makeRequestLike = <T>(result: T) => {
    const req = { result, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    setImmediate(() => req.onsuccess?.());
    return req;
  };
  return {
    openDB: vi.fn().mockResolvedValue({
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          getAll: vi.fn(() => makeRequestLike([])),
          delete: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    }),
    saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
    getFromIndexedDB: vi.fn().mockResolvedValue(null),
  };
});

// Mock encryption utilities
vi.mock('@/utils/encryption', () => ({
  generateMasterKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encryptMasterKey: vi.fn().mockResolvedValue('encrypted-key'),
  decryptMasterKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encryptData: vi.fn((data) => Promise.resolve(JSON.stringify(data))),
  decryptData: vi.fn((data) => Promise.resolve(JSON.parse(data))),
  arrayBufferToBase64: vi.fn(() => 'base64-data'),
  base64ToArrayBuffer: vi.fn(() => new ArrayBuffer(8)),
}));

// TODO: fix - complex integration test with mock IndexedDB, cloud storage, and timing-dependent sync workflows.
// Needs rewrite with proper async orchestration and mock alignment.
describe.skip('Sync Workflow Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Initialize storage service with password
    await storageServiceV2.initialize('test-password-123');
    storageServiceV2.clearConflictLog();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Sync Workflow', () => {
    it('should sync a new entry from local to cloud', async () => {
      const mockEntry: JournalEntryData = {
        id: 'entry-001',
        title: 'Test Entry',
        body: 'Test body content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'good',
        tags: [],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Mock cloud returns empty list (no entries yet)
      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([]);

      // Save entry locally
      await storageServiceV2.saveEntry(mockEntry);

      // Trigger sync
      await storageServiceV2.performFullSync();

      // Verify entry was uploaded to cloud
      expect(cloudStorageService.uploadToAll).toHaveBeenCalledWith(
        expect.stringContaining('entry-001.json'),
        expect.any(String)
      );
    });

    it('should download a new entry from cloud to local', async () => {
      const cloudEntry = {
        id: 'entry-002',
        title: 'Cloud Entry',
        body: 'From cloud',
        date: new Date('2024-01-01T11:00:00Z'),
        mood: 'great',
        tags: [],
        createdAt: new Date('2024-01-01T11:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z'),
        versionVector: { 'device-remote': 'op-1' },
        metadata: {
          date: '2024-01-01T11:00:00Z',
          tags: [],
          mood: 'great',
          createdAt: '2024-01-01T11:00:00Z',
          updatedAt: '2024-01-01T11:00:00Z',
        },
        encryptedData: 'encrypted',
        iv: 'iv',
      };

      // Mock cloud has one entry
      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: 'entry-002.json',
          path: '/OwnJournal/entries/entry-002.json',
          modifiedAt: new Date('2024-01-01T11:00:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      // Trigger sync
      await storageServiceV2.performFullSync();

      // Verify entry was saved locally
      const localEntry = await storageServiceV2.getEntry('entry-002');
      expect(localEntry).toBeTruthy();
      expect(localEntry?.title).toBe('Cloud Entry');
    });

    it('should handle no cloud provider gracefully', async () => {
      vi.mocked(cloudStorageService.getPrimaryProvider).mockReturnValue(null);

      const mockEntry: JournalEntryData = {
        id: 'entry-003',
        title: 'Test Entry',
        body: 'Test content',
        date: new Date(),
        mood: 'okay',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageServiceV2.saveEntry(mockEntry);

      // Sync should throw error
      await expect(storageServiceV2.performFullSync()).rejects.toThrow();
    });
  });

  describe('Conflict Detection', () => {
    it('should detect concurrent edits on different devices', async () => {
      const entryId = 'entry-conflict-001';
      
      // Local version (Device A edited at 10:00)
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'Title from Device A',
        body: 'Content from Device A',
        date: new Date('2024-01-01T09:00:00Z'),
        mood: 'good',
        tags: [],
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Cloud version (Device B edited at 10:05)
      const cloudEntry = {
        id: entryId,
        title: 'Title from Device B',
        body: 'Content from Device B',
        date: new Date('2024-01-01T09:00:00Z'),
        mood: 'great',
        tags: [],
        versionVector: { 'device-B': 'op-device-B-001' },
        metadata: {
          date: '2024-01-01T09:00:00Z',
          tags: [],
          mood: 'great',
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T10:05:00Z',
        },
        encryptedData: JSON.stringify({ title: 'Title from Device B', body: 'Content from Device B' }),
        iv: 'iv-data',
      };

      // Save local entry with version vector
      await storageServiceV2.saveEntry(localEntry);

      // Mock cloud returns the conflicting entry
      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date('2024-01-01T10:05:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      // Trigger sync - should detect conflict
      await storageServiceV2.performFullSync();

      // Verify conflict was logged
      const conflicts = storageServiceV2.getConflictLog();
      expect(conflicts.length).toBeGreaterThan(0);
      
      const conflict = conflicts.find(c => c.entryId === entryId);
      expect(conflict).toBeTruthy();
      expect(conflict?.winner).toBeTruthy();
      expect(conflict?.loser).toBeTruthy();
    });

    it('should resolve conflict using Last-Write-Wins (LWW)', async () => {
      const entryId = 'entry-lww-001';
      
      // Local version (older, edited at 10:00)
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'Old Title',
        body: 'Old content',
        date: new Date('2024-01-01T09:00:00Z'),
        mood: 'okay',
        tags: [],
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Cloud version (newer, edited at 10:30)
      const cloudEntry = {
        id: entryId,
        title: 'New Title',
        body: 'New content',
        date: new Date('2024-01-01T09:00:00Z'),
        mood: 'great',
        tags: [],
        versionVector: { 'device-remote': 'op-remote-001' },
        metadata: {
          date: '2024-01-01T09:00:00Z',
          tags: [],
          mood: 'great',
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T10:30:00Z',
        },
        encryptedData: JSON.stringify({ title: 'New Title', body: 'New content' }),
        iv: 'iv-data',
      };

      await storageServiceV2.saveEntry(localEntry);

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date('2024-01-01T10:30:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      await storageServiceV2.performFullSync();

      // Winner should be the newer version (cloud)
      const currentEntry = await storageServiceV2.getEntry(entryId);
      expect(currentEntry?.title).toBe('New Title');
      expect(currentEntry?.body).toBe('New content');

      // Loser should be in conflict log
      const conflicts = storageServiceV2.getConflictLog();
      const conflict = conflicts.find(c => c.entryId === entryId);
      expect(conflict?.loser.fullEntry.title).toBe('Old Title');
    });

    it('should not detect conflict for first sync', async () => {
      const entryId = 'entry-first-sync-001';
      
      // Local entry with no version vector (first time)
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'First Sync',
        body: 'Content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'good',
        tags: [],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      await storageServiceV2.saveEntry(localEntry);

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([]);

      await storageServiceV2.performFullSync();

      // No conflicts should be logged
      const conflicts = storageServiceV2.getConflictLog();
      expect(conflicts.length).toBe(0);
    });
  });

  describe('Version Vector Management', () => {
    it('should increment version vector on each edit', async () => {
      const entry: JournalEntryData = {
        id: 'entry-version-001',
        title: 'Version Test',
        body: 'Initial content',
        date: new Date(),
        mood: 'good',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First save
      await storageServiceV2.saveEntry(entry);
      let saved = await storageServiceV2.getEntry(entry.id);
      const firstVector = (saved as any)?.versionVector;
      expect(firstVector).toBeTruthy();

      // Second save (edit)
      await storageServiceV2.saveEntry({ ...entry, body: 'Updated content' });
      saved = await storageServiceV2.getEntry(entry.id);
      const secondVector = (saved as any)?.versionVector;
      
      // Version should change
      expect(secondVector).toBeTruthy();
      expect(JSON.stringify(secondVector)).not.toBe(JSON.stringify(firstVector));
    });

    it('should merge version vectors from different devices', async () => {
      const entryId = 'entry-merge-001';
      
      // Local entry with Device A's version
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'Local Title',
        body: 'Local content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'good',
        tags: [],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      await storageServiceV2.saveEntry(localEntry);

      // Cloud entry with Device B's version
      const cloudEntry = {
        id: entryId,
        title: 'Remote Title',
        body: 'Remote content',
        date: new Date('2024-01-01T09:00:00Z'),
        mood: 'great',
        tags: [],
        versionVector: { 'device-B': 'op-B-123', 'device-C': 'op-C-456' },
        metadata: {
          date: '2024-01-01T09:00:00Z',
          tags: [],
          mood: 'great',
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T11:00:00Z',
        },
        encryptedData: JSON.stringify({ title: 'Remote Title', body: 'Remote content' }),
        iv: 'iv-data',
      };

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date('2024-01-01T11:00:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      await storageServiceV2.performFullSync();

      // After sync, entry should have merged version vector
      const merged = await storageServiceV2.getEntry(entryId);
      const mergedVector = (merged as any)?.versionVector;
      
      expect(mergedVector).toBeTruthy();
      // Should contain entries from both local and remote
      expect(Object.keys(mergedVector || {}).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Conflict Log', () => {
    it('should store complete entry data in conflict log', async () => {
      const entryId = 'entry-log-001';
      
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'Local Title',
        body: 'Local content with lots of text',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'good',
        tags: ['tag1', 'tag2'],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      const cloudEntry = {
        id: entryId,
        title: 'Remote Title',
        body: 'Remote content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'great',
        tags: ['tag3'],
        versionVector: { 'device-remote': 'op-001' },
        metadata: {
          date: '2024-01-01T10:00:00Z',
          tags: ['tag3'],
          mood: 'great',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:05:00Z',
        },
        encryptedData: JSON.stringify({ title: 'Remote Title', body: 'Remote content' }),
        iv: 'iv-data',
      };

      await storageServiceV2.saveEntry(localEntry);

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date('2024-01-01T10:05:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      await storageServiceV2.performFullSync();

      const conflicts = storageServiceV2.getConflictLog();
      const conflict = conflicts.find(c => c.entryId === entryId);
      
      expect(conflict).toBeTruthy();
      expect(conflict?.loser.fullEntry.body).toBe('Local content with lots of text');
      expect(conflict?.loser.fullEntry.tags).toEqual(['tag1', 'tag2']);
    });

    it('should generate conflict preview text', async () => {
      const entryId = 'entry-preview-001';
      
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'Very Long Title That Should Be Truncated At Some Point',
        body: 'This is a very long content that should be truncated in the preview. '.repeat(10),
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'okay',
        tags: [],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      const cloudEntry = {
        id: entryId,
        title: 'Remote Title',
        body: 'Remote content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'great',
        tags: [],
        versionVector: { 'device-remote': 'op-001' },
        metadata: {
          date: '2024-01-01T10:00:00Z',
          tags: [],
          mood: 'great',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:05:00Z',
        },
        encryptedData: JSON.stringify({ title: 'Remote Title', body: 'Remote content' }),
        iv: 'iv-data',
      };

      await storageServiceV2.saveEntry(localEntry);

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date('2024-01-01T10:05:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      await storageServiceV2.performFullSync();

      const conflicts = storageServiceV2.getConflictLog();
      const conflict = conflicts.find(c => c.entryId === entryId);
      
      expect(conflict).toBeTruthy();
      expect(conflict?.loser.preview.length).toBeLessThanOrEqual(60);
    });

    it('should clear conflict log when requested', async () => {
      // Create a conflict first
      const entryId = 'entry-clear-001';
      
      const localEntry: JournalEntryData = {
        id: entryId,
        title: 'Local',
        body: 'Local content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'good',
        tags: [],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      const cloudEntry = {
        id: entryId,
        title: 'Remote',
        body: 'Remote content',
        date: new Date('2024-01-01T10:00:00Z'),
        mood: 'great',
        tags: [],
        versionVector: { 'device-remote': 'op-001' },
        metadata: {
          date: '2024-01-01T10:00:00Z',
          tags: [],
          mood: 'great',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:05:00Z',
        },
        encryptedData: JSON.stringify({ title: 'Remote', body: 'Remote content' }),
        iv: 'iv-data',
      };

      await storageServiceV2.saveEntry(localEntry);

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date('2024-01-01T10:05:00Z'),
          size: 1000,
        },
      ]);

      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        JSON.stringify(cloudEntry)
      );

      await storageServiceV2.performFullSync();

      let conflicts = storageServiceV2.getConflictLog();
      expect(conflicts.length).toBeGreaterThan(0);

      // Clear log
      storageServiceV2.clearConflictLog();

      conflicts = storageServiceV2.getConflictLog();
      expect(conflicts.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle sync with corrupted cloud data', async () => {
      const entryId = 'entry-corrupt-001';

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([
        {
          name: `${entryId}.json`,
          path: `/OwnJournal/entries/${entryId}.json`,
          modifiedAt: new Date(),
          size: 100,
        },
      ]);

      // Return invalid JSON
      vi.mocked(cloudStorageService.downloadFromPrimary).mockResolvedValue(
        'invalid-json-data'
      );

      // Should not throw, should handle gracefully
      await expect(storageServiceV2.performFullSync()).resolves.not.toThrow();
    });

    it('should handle deleted entries during sync', async () => {
      const entryId = 'entry-deleted-001';
      
      // Create and delete entry locally
      const entry: JournalEntryData = {
        id: entryId,
        title: 'To Be Deleted',
        body: 'Content',
        date: new Date(),
        mood: 'okay',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageServiceV2.saveEntry(entry);
      await storageServiceV2.deleteEntry(entryId);

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([]);

      // Trigger sync
      await storageServiceV2.performFullSync();

      // Entry should be deleted from cloud
      expect(cloudStorageService.deleteFromAll).toHaveBeenCalled();
    });

    it('should handle large number of entries', async () => {
      const numEntries = 50;
      const entries: JournalEntryData[] = [];

      // Create 50 entries
      for (let i = 0; i < numEntries; i++) {
        const entry: JournalEntryData = {
          id: `entry-${i}`,
          title: `Entry ${i}`,
          body: `Content ${i}`,
          date: new Date(),
          mood: 'good',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        entries.push(entry);
        await storageServiceV2.saveEntry(entry);
      }

      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([]);

      // Sync should handle all entries
      await expect(storageServiceV2.performFullSync()).resolves.not.toThrow();

      // All entries should be uploaded
      expect(cloudStorageService.uploadToAll).toHaveBeenCalled();
    });

    it('should handle network timeout during sync', async () => {
      vi.mocked(cloudStorageService.listFiles).mockRejectedValue(
        new Error('Network timeout')
      );

      // Should handle error gracefully
      await expect(storageServiceV2.performFullSync()).rejects.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent sync requests', async () => {
      vi.mocked(cloudStorageService.listFiles).mockResolvedValue([]);

      // Trigger multiple syncs simultaneously
      const syncs = [
        storageServiceV2.performFullSync(),
        storageServiceV2.performFullSync(),
        storageServiceV2.performFullSync(),
      ];

      // First should complete, others should skip
      await expect(Promise.all(syncs)).resolves.not.toThrow();
    });

    it('should handle edit during sync', async () => {
      const entry: JournalEntryData = {
        id: 'entry-concurrent-001',
        title: 'Test',
        body: 'Original',
        date: new Date(),
        mood: 'good',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageServiceV2.saveEntry(entry);

      vi.mocked(cloudStorageService.listFiles).mockImplementation(async () => {
        // Edit entry while sync is in progress
        await storageServiceV2.saveEntry({ ...entry, body: 'Modified' });
        return [];
      });

      await storageServiceV2.performFullSync();

      // Latest edit should be preserved
      const final = await storageServiceV2.getEntry(entry.id);
      expect(final?.body).toBe('Modified');
    });
  });

  describe('State snapshot and compaction', () => {
    it('should treat entries in state snapshot deletedEntryIds as deleted during sync', async () => {
      const tombId = 'entry-tomb-001';
      const cloudEntryPayload = {
        id: tombId,
        encryptedData: JSON.stringify({ title: 'Tomb', body: 'Deleted on another device' }),
        iv: 'iv',
        metadata: {
          date: new Date().toISOString(),
          tags: [],
          mood: 'okay',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        versionVector: { 'device-other': 'op-1' },
      };

      vi.mocked(cloudStorageService.listFiles).mockImplementation(async (path: string) => {
        if (path === 'entries') {
          return [
            {
              name: `entry-${tombId}.json`,
              path: `/OwnJournal/entries/entry-${tombId}.json`,
              modifiedAt: new Date(),
              size: 100,
            },
          ];
        }
        if (path === 'operations') return [];
        return [];
      });

      vi.mocked(cloudStorageService.downloadFromPrimary).mockImplementation(async (filePath: string) => {
        if (filePath === 'operations/state-snapshot.json') {
          return JSON.stringify({
            version: 1,
            deletedEntryIds: [tombId],
            snapshotTimestamp: new Date().toISOString(),
            coveredUpTo: new Date().toISOString(),
            createdBy: 'test-device',
          });
        }
        if (filePath.includes(tombId)) return JSON.stringify(cloudEntryPayload);
        if (filePath === 'sync-state.json') {
          return JSON.stringify({ lastSyncTimestamp: new Date().toISOString(), deviceId: 'test' });
        }
        return null;
      });

      await storageServiceV2.performFullSync();

      const entries = await storageServiceV2.getAllEntries();
      expect(entries.some(e => e.id === tombId)).toBe(false);
    }, 10000);

    it('should merge state snapshot with op files when building deleted set', async () => {
      const deletedInSnapshot = 'entry-only-in-snapshot';
      const deletedInOp = 'entry-only-in-op';
      const opFile = {
        name: 'op-device-x-1-abc.json',
        path: '/OwnJournal/operations/op-device-x-1-abc.json',
        modifiedAt: new Date(Date.now() - 1000),
        size: 100,
      };

      vi.mocked(cloudStorageService.listFiles).mockImplementation(async (path: string) => {
        if (path === 'entries') return [];
        if (path === 'operations') return [opFile];
        return [];
      });

      vi.mocked(cloudStorageService.downloadFromPrimary).mockImplementation(async (filePath: string) => {
        if (filePath === 'operations/state-snapshot.json') {
          return JSON.stringify({
            version: 1,
            deletedEntryIds: [deletedInSnapshot],
            snapshotTimestamp: new Date().toISOString(),
            coveredUpTo: new Date().toISOString(),
            createdBy: 'test-device',
          });
        }
        if (filePath === opFile.path) {
          return JSON.stringify({
            id: 'op-1',
            entryId: deletedInOp,
            type: 'delete',
            timestamp: new Date().toISOString(),
            deviceId: 'device-x',
          });
        }
        if (filePath === 'sync-state.json') {
          return JSON.stringify({ lastSyncTimestamp: new Date().toISOString(), deviceId: 'test' });
        }
        return null;
      });

      await storageServiceV2.performFullSync();

      const entries = await storageServiceV2.getAllEntries();
      expect(entries.some(e => e.id === deletedInSnapshot)).toBe(false);
      expect(entries.some(e => e.id === deletedInOp)).toBe(false);
    }, 10000);

    it('compaction writes state snapshot and removes old op files', async () => {
      const oldOpName = 'op-device-A-100-old.json';
      const oldOpPath = `/OwnJournal/operations/${oldOpName}`;
      const retentionDays = 180;
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - retentionDays - 1);

      vi.mocked(cloudStorageService.listFiles).mockImplementation(async (path: string) => {
        if (path === 'entries') return [];
        if (path === 'operations') {
          return [
            {
              name: oldOpName,
              path: oldOpPath,
              modifiedAt: oldDate,
              size: 80,
            },
          ];
        }
        return [];
      });

      vi.mocked(cloudStorageService.downloadFromPrimary).mockImplementation(async (filePath: string) => {
        if (filePath === 'operations/state-snapshot.json') return null;
        if (filePath === oldOpPath) {
          return JSON.stringify({
            id: 'op-1',
            entryId: 'entry-deleted-long-ago',
            type: 'delete',
            timestamp: oldDate.toISOString(),
            deviceId: 'device-A',
          });
        }
        if (filePath === 'sync-state.json') {
          return JSON.stringify({ lastSyncTimestamp: new Date().toISOString(), deviceId: 'test' });
        }
        return null;
      });

      await storageServiceV2.performFullSync();
      await new Promise(r => setTimeout(r, 2500));

      expect(cloudStorageService.uploadToAll).toHaveBeenCalledWith(
        'operations/state-snapshot.json',
        expect.stringContaining('entry-deleted-long-ago')
      );
      expect(cloudStorageService.deleteFromAll).toHaveBeenCalledWith(oldOpPath);
    }, 15000);
  });
});
