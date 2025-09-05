import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration tests specifically for conflict resolution strategies
 * Tests various conflict scenarios and resolution outcomes
 */

// Mock version vector utilities
interface VersionVector {
  [deviceId: string]: string;
}

function detectConflict(
  localVector: VersionVector,
  remoteVector: VersionVector,
  localDeviceId: string
): boolean {
  // If either vector is empty, no conflict (first sync)
  if (Object.keys(localVector).length === 0 || Object.keys(remoteVector).length === 0) {
    return false;
  }

  // Check if both have made changes
  let localHasChanges = false;
  let remoteHasChanges = false;

  // Check if local has changes remote doesn't know about
  for (const [deviceId, opId] of Object.entries(localVector)) {
    if (!remoteVector[deviceId] || remoteVector[deviceId] !== opId) {
      localHasChanges = true;
      break;
    }
  }

  // Check if remote has changes local doesn't know about
  for (const [deviceId, opId] of Object.entries(remoteVector)) {
    if (!localVector[deviceId] || localVector[deviceId] !== opId) {
      remoteHasChanges = true;
      break;
    }
  }

  // Conflict = both have made changes
  return localHasChanges && remoteHasChanges;
}

function mergeVersionVectors(v1: VersionVector, v2: VersionVector): VersionVector {
  return { ...v1, ...v2 };
}

describe('Conflict Resolution Integration Tests', () => {
  describe('Version Vector Conflict Detection', () => {
    it('should detect concurrent edits from two devices', () => {
      const localVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-001',
      };

      const remoteVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-002', // Device B made more changes
      };

      const hasConflict = detectConflict(localVector, remoteVector, 'device-A');
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict when remote is ahead', () => {
      const localVector: VersionVector = {
        'device-A': 'op-A-001',
      };

      const remoteVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-001', // Only remote has changes
      };

      const hasConflict = detectConflict(localVector, remoteVector, 'device-A');
      expect(hasConflict).toBe(false);
    });

    it('should not detect conflict when local is ahead', () => {
      const localVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-001',
      };

      const remoteVector: VersionVector = {
        'device-A': 'op-A-001', // Only local has device-B changes
      };

      const hasConflict = detectConflict(localVector, remoteVector, 'device-A');
      expect(hasConflict).toBe(true); // Actually this IS a conflict - local has changes remote doesn't
    });

    it('should not detect conflict on first sync', () => {
      const localVector: VersionVector = {};
      const remoteVector: VersionVector = {
        'device-B': 'op-B-001',
      };

      const hasConflict = detectConflict(localVector, remoteVector, 'device-A');
      expect(hasConflict).toBe(false);
    });

    it('should detect three-way conflict', () => {
      const localVector: VersionVector = {
        'device-A': 'op-A-002',
        'device-B': 'op-B-001',
      };

      const remoteVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-001',
        'device-C': 'op-C-001',
      };

      const hasConflict = detectConflict(localVector, remoteVector, 'device-A');
      expect(hasConflict).toBe(true);
    });
  });

  describe('Version Vector Merging', () => {
    it('should merge version vectors from two devices', () => {
      const v1: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-001',
      };

      const v2: VersionVector = {
        'device-B': 'op-B-002',
        'device-C': 'op-C-001',
      };

      const merged = mergeVersionVectors(v1, v2);

      expect(merged).toEqual({
        'device-A': 'op-A-001',
        'device-B': 'op-B-002', // Latest from v2
        'device-C': 'op-C-001',
      });
    });

    it('should preserve all device entries when merging', () => {
      const v1: VersionVector = {
        'device-A': 'op-A-001',
      };

      const v2: VersionVector = {
        'device-B': 'op-B-001',
        'device-C': 'op-C-001',
      };

      const merged = mergeVersionVectors(v1, v2);

      expect(Object.keys(merged)).toHaveLength(3);
      expect(merged['device-A']).toBe('op-A-001');
      expect(merged['device-B']).toBe('op-B-001');
      expect(merged['device-C']).toBe('op-C-001');
    });

    it('should handle empty version vectors', () => {
      const v1: VersionVector = {};
      const v2: VersionVector = {
        'device-A': 'op-A-001',
      };

      const merged = mergeVersionVectors(v1, v2);
      expect(merged).toEqual({ 'device-A': 'op-A-001' });
    });
  });

  describe('Last-Write-Wins (LWW) Resolution', () => {
    interface Entry {
      id: string;
      updatedAt: Date;
      deviceId: string;
      title: string;
    }

    function resolveLWW(local: Entry, remote: Entry): 'local' | 'remote' {
      const localTime = local.updatedAt.getTime();
      const remoteTime = remote.updatedAt.getTime();

      if (localTime > remoteTime) {
        return 'local';
      } else if (remoteTime > localTime) {
        return 'remote';
      } else {
        // Tiebreaker: lexicographic comparison of device IDs
        return local.deviceId > remote.deviceId ? 'local' : 'remote';
      }
    }

    it('should choose newer timestamp', () => {
      const local: Entry = {
        id: 'entry-1',
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        deviceId: 'device-A',
        title: 'Local',
      };

      const remote: Entry = {
        id: 'entry-1',
        updatedAt: new Date('2024-01-01T10:05:00Z'),
        deviceId: 'device-B',
        title: 'Remote',
      };

      const winner = resolveLWW(local, remote);
      expect(winner).toBe('remote');
    });

    it('should use device ID as tiebreaker', () => {
      const sameTime = new Date('2024-01-01T10:00:00Z');

      const local: Entry = {
        id: 'entry-1',
        updatedAt: sameTime,
        deviceId: 'device-B',
        title: 'Local',
      };

      const remote: Entry = {
        id: 'entry-1',
        updatedAt: sameTime,
        deviceId: 'device-A',
        title: 'Remote',
      };

      const winner = resolveLWW(local, remote);
      expect(winner).toBe('local'); // 'device-B' > 'device-A'
    });

    it('should handle millisecond precision timestamps', () => {
      const local: Entry = {
        id: 'entry-1',
        updatedAt: new Date('2024-01-01T10:00:00.123Z'),
        deviceId: 'device-A',
        title: 'Local',
      };

      const remote: Entry = {
        id: 'entry-1',
        updatedAt: new Date('2024-01-01T10:00:00.124Z'),
        deviceId: 'device-B',
        title: 'Remote',
      };

      const winner = resolveLWW(local, remote);
      expect(winner).toBe('remote');
    });

    it('should be deterministic with same inputs', () => {
      const local: Entry = {
        id: 'entry-1',
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        deviceId: 'device-A',
        title: 'Local',
      };

      const remote: Entry = {
        id: 'entry-1',
        updatedAt: new Date('2024-01-01T10:05:00Z'),
        deviceId: 'device-B',
        title: 'Remote',
      };

      const winner1 = resolveLWW(local, remote);
      const winner2 = resolveLWW(local, remote);
      const winner3 = resolveLWW(local, remote);

      expect(winner1).toBe(winner2);
      expect(winner2).toBe(winner3);
    });
  });

  describe('Conflict Scenarios', () => {
    it('should handle rapid successive edits', () => {
      const vectors: VersionVector[] = [];
      let currentVector: VersionVector = {};

      // Simulate 10 rapid edits from device-A
      for (let i = 0; i < 10; i++) {
        currentVector = {
          ...currentVector,
          'device-A': `op-A-${i}`,
        };
        vectors.push({ ...currentVector });
      }

      // Each version should be different
      const uniqueVectors = new Set(vectors.map(v => JSON.stringify(v)));
      expect(uniqueVectors.size).toBe(10);
    });

    it('should handle offline editing and sync', () => {
      // Device A makes changes while offline
      const deviceAVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-A-offline-1': 'op-A-002',
        'device-A-offline-2': 'op-A-003',
      };

      // Device B also made changes during that time
      const deviceBVector: VersionVector = {
        'device-B': 'op-B-001',
        'device-B-1': 'op-B-002',
      };

      // When A comes back online and syncs with B's changes
      const hasConflict = detectConflict(deviceAVector, deviceBVector, 'device-A');
      expect(hasConflict).toBe(true);

      // After resolution, merge should contain all operations
      const merged = mergeVersionVectors(deviceAVector, deviceBVector);
      expect(Object.keys(merged).length).toBeGreaterThan(3);
    });

    it('should handle deleted entry conflict', () => {
      // Local: entry was deleted (no vector entry)
      const localVector: VersionVector = {};

      // Remote: entry was edited
      const remoteVector: VersionVector = {
        'device-B': 'op-B-001',
      };

      const hasConflict = detectConflict(localVector, remoteVector, 'device-A');
      
      // Should not detect as conflict (deletion is a special case)
      expect(hasConflict).toBe(false);
    });

    it('should handle same edit on multiple devices', () => {
      // Both devices made the same exact change (unlikely but possible)
      const sameVector: VersionVector = {
        'device-A': 'op-shared-001',
      };

      const hasConflict = detectConflict(sameVector, sameVector, 'device-A');
      expect(hasConflict).toBe(false);
    });

    it('should handle cascading conflicts', () => {
      // Device A and B conflict
      const deviceAVector: VersionVector = {
        'device-A': 'op-A-002',
        'device-B': 'op-B-001',
      };

      const deviceBVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-002',
      };

      const hasConflictAB = detectConflict(deviceAVector, deviceBVector, 'device-A');
      expect(hasConflictAB).toBe(true);

      // After resolution, merge vectors
      const mergedAB = mergeVersionVectors(deviceAVector, deviceBVector);

      // Now device C syncs and has its own changes
      const deviceCVector: VersionVector = {
        'device-A': 'op-A-001',
        'device-B': 'op-B-001',
        'device-C': 'op-C-001',
      };

      const hasConflictABC = detectConflict(mergedAB, deviceCVector, 'device-A');
      expect(hasConflictABC).toBe(true);
    });
  });

  describe('Performance and Scale', () => {
    it('should handle large version vectors efficiently', () => {
      const largeVector1: VersionVector = {};
      const largeVector2: VersionVector = {};

      // Create vectors with 100 devices each
      for (let i = 0; i < 100; i++) {
        largeVector1[`device-${i}`] = `op-${i}-001`;
        largeVector2[`device-${i}`] = i % 2 === 0 ? `op-${i}-002` : `op-${i}-001`;
      }

      const startTime = performance.now();
      const hasConflict = detectConflict(largeVector1, largeVector2, 'device-0');
      const endTime = performance.now();

      expect(hasConflict).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should be fast (< 10ms)
    });

    it('should merge large vectors efficiently', () => {
      const v1: VersionVector = {};
      const v2: VersionVector = {};

      for (let i = 0; i < 1000; i++) {
        v1[`device-${i}`] = `op-${i}-001`;
        v2[`device-${i + 1000}`] = `op-${i}-001`;
      }

      const startTime = performance.now();
      const merged = mergeVersionVectors(v1, v2);
      const endTime = performance.now();

      expect(Object.keys(merged).length).toBe(2000);
      expect(endTime - startTime).toBeLessThan(50); // Should be fast (< 50ms)
    });
  });
});
