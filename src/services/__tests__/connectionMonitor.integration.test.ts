/**
 * Integration tests for ConnectionMonitor
 * Tests health monitoring and failure tracking for cloud providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionMonitor, connectionMonitor } from '@/utils/connectionMonitor';

describe('ConnectionMonitor - Integration', () => {
  let monitor: ConnectionMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = ConnectionMonitor.getInstance();
    
    // Reset all provider health
    monitor.reset('googleDriveSync');
    monitor.reset('dropboxSync');
    monitor.reset('nextcloudSync');
    monitor.reset('iCloudSync');
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConnectionMonitor.getInstance();
      const instance2 = ConnectionMonitor.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use the exported singleton instance', () => {
      expect(connectionMonitor).toBe(ConnectionMonitor.getInstance());
    });
  });

  describe('Success Tracking', () => {
    it('should record successful operations', () => {
      monitor.recordSuccess('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.isHealthy).toBe(true);
      expect(health.failures).toBe(0);
      expect(health.lastSuccess).toBeGreaterThan(0);
    });

    it('should reset failure count on success', () => {
      // Record failures
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');

      expect(monitor.getHealth('googleDriveSync').failures).toBe(2);

      // Record success
      monitor.recordSuccess('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.failures).toBe(0);
      expect(health.isHealthy).toBe(true);
    });

    it('should update last success timestamp', () => {
      const before = Date.now();
      monitor.recordSuccess('googleDriveSync');
      const after = Date.now();

      const health = monitor.getHealth('googleDriveSync');
      expect(health.lastSuccess).toBeGreaterThanOrEqual(before);
      expect(health.lastSuccess).toBeLessThanOrEqual(after);
    });
  });

  describe('Failure Tracking', () => {
    it('should record failed operations', () => {
      monitor.recordFailure('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.failures).toBe(1);
      expect(health.isHealthy).toBe(true); // Still healthy after 1 failure
    });

    it('should increment consecutive failure count', () => {
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.failures).toBe(3);
    });

    it('should mark as unhealthy after threshold failures', () => {
      // Record 3 consecutive failures (threshold)
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.isHealthy).toBe(false);
      expect(health.failures).toBe(3);
    });

    it('should warn in development mode after threshold failures', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Record failures until threshold
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provider googleDriveSync has 3 consecutive failures')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Health Status', () => {
    it('should return healthy status for new providers', () => {
      const health = monitor.getHealth('newProvider');

      expect(health.isHealthy).toBe(true);
      expect(health.failures).toBe(0);
      expect(health.lastSuccess).toBe(0);
    });

    it('should track health across multiple providers independently', () => {
      monitor.recordSuccess('googleDriveSync');
      monitor.recordFailure('dropboxSync');
      monitor.recordFailure('dropboxSync');
      monitor.recordFailure('dropboxSync');

      const googleHealth = monitor.getHealth('googleDriveSync');
      const dropboxHealth = monitor.getHealth('dropboxSync');

      expect(googleHealth.isHealthy).toBe(true);
      expect(googleHealth.failures).toBe(0);

      expect(dropboxHealth.isHealthy).toBe(false);
      expect(dropboxHealth.failures).toBe(3);
    });

    it('should return all provider health statuses', () => {
      monitor.recordSuccess('googleDriveSync');
      monitor.recordFailure('dropboxSync');
      monitor.recordFailure('dropboxSync');
      monitor.recordFailure('dropboxSync');

      const allHealth = monitor.getAllHealth();

      expect(allHealth).toHaveProperty('googleDriveSync');
      expect(allHealth).toHaveProperty('dropboxSync');
      expect(allHealth).toHaveProperty('nextcloudSync');
      expect(allHealth).toHaveProperty('iCloudSync');

      expect(allHealth.googleDriveSync.isHealthy).toBe(true);
      expect(allHealth.dropboxSync.isHealthy).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset provider health', () => {
      monitor.recordFailure('googleDriveSync');
      monitor.recordFailure('googleDriveSync');

      expect(monitor.getHealth('googleDriveSync').failures).toBe(2);

      monitor.reset('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.isHealthy).toBe(true);
      expect(health.failures).toBe(0);
      expect(health.lastSuccess).toBe(0);
    });

    it('should allow fresh tracking after reset', () => {
      monitor.recordFailure('googleDriveSync');
      monitor.reset('googleDriveSync');
      monitor.recordSuccess('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.isHealthy).toBe(true);
      expect(health.failures).toBe(0);
      expect(health.lastSuccess).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle intermittent failures gracefully', () => {
      // Pattern: success, fail, success, fail, success
      monitor.recordSuccess('googleDriveSync');
      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(true);

      monitor.recordFailure('googleDriveSync');
      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(true);

      monitor.recordSuccess('googleDriveSync');
      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(true);

      monitor.recordFailure('googleDriveSync');
      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(true);

      monitor.recordSuccess('googleDriveSync');
      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(true);
    });

    it('should detect prolonged outages', () => {
      // Simulate prolonged outage
      for (let i = 0; i < 10; i++) {
        monitor.recordFailure('googleDriveSync');
      }

      const health = monitor.getHealth('googleDriveSync');
      expect(health.isHealthy).toBe(false);
      expect(health.failures).toBe(10);
    });

    it('should recover from outages', () => {
      // Simulate outage
      for (let i = 0; i < 5; i++) {
        monitor.recordFailure('googleDriveSync');
      }

      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(false);

      // Recovery
      monitor.recordSuccess('googleDriveSync');

      const health = monitor.getHealth('googleDriveSync');
      expect(health.isHealthy).toBe(true);
      expect(health.failures).toBe(0);
    });

    it('should track different provider health simultaneously', () => {
      // Google Drive: healthy
      monitor.recordSuccess('googleDriveSync');

      // Dropbox: struggling
      monitor.recordFailure('dropboxSync');
      monitor.recordSuccess('dropboxSync');
      monitor.recordFailure('dropboxSync');

      // Nextcloud: down
      for (let i = 0; i < 5; i++) {
        monitor.recordFailure('nextcloudSync');
      }

      const allHealth = monitor.getAllHealth();

      expect(allHealth.googleDriveSync.isHealthy).toBe(true);
      expect(allHealth.dropboxSync.isHealthy).toBe(true);
      expect(allHealth.nextcloudSync.isHealthy).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle rapid successive calls efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        monitor.recordSuccess('googleDriveSync');
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });

    it('should handle many providers without performance degradation', () => {
      const providers = Array.from({ length: 100 }, (_, i) => `provider${i}`);

      const start = Date.now();

      providers.forEach(provider => {
        monitor.recordSuccess(provider);
        monitor.recordFailure(provider);
        monitor.getHealth(provider);
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined provider names', () => {
      const health = monitor.getHealth('nonexistent-provider');

      expect(health.isHealthy).toBe(true);
      expect(health.failures).toBe(0);
    });

    it('should handle rapid success/failure toggles', () => {
      for (let i = 0; i < 50; i++) {
        if (i % 2 === 0) {
          monitor.recordSuccess('googleDriveSync');
        } else {
          monitor.recordFailure('googleDriveSync');
        }
      }

      // Last operation was failure, so should have 1 failure
      const health = monitor.getHealth('googleDriveSync');
      expect(health.failures).toBe(1);
    });

    it('should maintain separate state for similar provider names', () => {
      monitor.recordSuccess('googleDrive');
      monitor.recordFailure('googleDriveSync');

      expect(monitor.getHealth('googleDrive').isHealthy).toBe(true);
      expect(monitor.getHealth('googleDriveSync').isHealthy).toBe(true);
    });
  });

  describe('Integration with Cloud Operations', () => {
    it('should track health during upload operations', async () => {
      const mockUpload = async (provider: string) => {
        try {
          // Simulate upload
          if (Math.random() > 0.8) throw new Error('Upload failed');
          monitor.recordSuccess(provider);
        } catch {
          monitor.recordFailure(provider);
          throw new Error('Upload failed');
        }
      };

      const results = await Promise.allSettled([
        mockUpload('googleDriveSync'),
        mockUpload('googleDriveSync'),
        mockUpload('googleDriveSync'),
      ]);

      const health = monitor.getHealth('googleDriveSync');
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      // Health should reflect the last operation
      expect(health.failures).toBeLessThanOrEqual(failCount);
    });
  });
});
