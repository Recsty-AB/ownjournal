// Connection health monitor for cloud storage
export class ConnectionMonitor {
  private static instance: ConnectionMonitor;
  private healthChecks = new Map<string, { lastSuccess: number; consecutiveFailures: number }>();
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly MAX_FAILURES_BEFORE_ALERT = 3;

  static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor();
    }
    return ConnectionMonitor.instance;
  }

  recordSuccess(provider: string): void {
    this.healthChecks.set(provider, {
      lastSuccess: Date.now(),
      consecutiveFailures: 0
    });
  }

  recordFailure(provider: string): void {
    const current = this.healthChecks.get(provider) || { lastSuccess: 0, consecutiveFailures: 0 };
    current.consecutiveFailures++;
    this.healthChecks.set(provider, current);

    if (current.consecutiveFailures >= this.MAX_FAILURES_BEFORE_ALERT) {
      if (import.meta.env.DEV) {
        console.warn(`⚠️ Provider ${provider} has ${current.consecutiveFailures} consecutive failures`);
      }
    }
  }

  getHealth(provider: string): { isHealthy: boolean; lastSuccess: number; failures: number } {
    const health = this.healthChecks.get(provider);
    if (!health) {
      return { isHealthy: true, lastSuccess: 0, failures: 0 };
    }

    const isHealthy = health.consecutiveFailures < this.MAX_FAILURES_BEFORE_ALERT;
    return {
      isHealthy,
      lastSuccess: health.lastSuccess,
      failures: health.consecutiveFailures
    };
  }

  reset(provider: string): void {
    this.healthChecks.delete(provider);
  }

  getAllHealth(): Record<string, { isHealthy: boolean; lastSuccess: number; failures: number }> {
    const result: Record<string, any> = {};
    const providers = ['googleDriveSync', 'dropboxSync', 'nextcloudSync', 'iCloudSync'];
    
    for (const provider of providers) {
      result[provider] = this.getHealth(provider);
    }
    
    return result;
  }
}

export const connectionMonitor = ConnectionMonitor.getInstance();
