import { useState, useEffect } from "react";
import { storageServiceV2 } from "@/services/storageServiceV2";
import type { SyncDiagnostics } from "@/services/storageServiceV2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingDown,
  Activity
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

interface HealthMetrics {
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  healthScore: number; // 0-100
  conflictRate: number; // conflicts per sync
  failureRate: number; // percentage
  avgSyncLatency: number; // ms
  circuitBreakersActive: number;
  recentConflicts: number;
  recentFailures: number;
  alerts: HealthAlert[];
  recommendations: Recommendation[];
}

interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
}

export const SyncHealthMonitor = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { t } = useTranslation();

  const calculateHealthMetrics = (): HealthMetrics => {
    const diagnostics = storageServiceV2.getDiagnostics();
    const conflicts = storageServiceV2.getConflictLog();
    
    // Calculate metrics
    const totalOperations = diagnostics.successCount + diagnostics.failureCount;
    const failureRate = totalOperations > 0 
      ? (diagnostics.failureCount / totalOperations) * 100 
      : 0;
    
    // Recent conflicts (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentConflicts = conflicts.filter(c => 
      new Date(c.timestamp).getTime() > oneHourAgo
    ).length;
    
    // Recent failures (last 10 operations)
    const recentFailures = diagnostics.recentEntries
      .slice(0, 10)
      .filter(e => e.type === 'error').length;
    
    // Circuit breakers
    const circuitBreakers = Array.from(diagnostics.circuitBreakerStatus.entries());
    const activeBreakers = circuitBreakers.filter(([_, status]) => 
      Date.now() < status.openUntil
    ).length;
    
    // Calculate conflict rate (conflicts per 100 syncs)
    const successfulSyncs = diagnostics.successCount || 1;
    const conflictRate = (conflicts.length / successfulSyncs) * 100;
    
    // Estimate avg sync latency from recent successful operations
    const recentSuccesses = diagnostics.recentEntries
      .filter(e => e.type === 'success')
      .slice(0, 20);
    const avgLatency = recentSuccesses.length > 0 ? 1500 : 0; // Placeholder
    
    // Generate alerts
    const alerts: HealthAlert[] = [];
    const recommendations: Recommendation[] = [];
    
    // Alert: High failure rate
    if (failureRate > 20) {
      alerts.push({
        id: 'high-failure-rate',
        severity: failureRate > 50 ? 'critical' : 'error',
        title: t('syncHealth.highFailureRate'),
        description: t('syncHealth.highFailureRateDesc', { rate: failureRate.toFixed(1) }),
        timestamp: new Date()
      });
      recommendations.push({
        id: 'rec-failure-rate',
        priority: 'high',
        title: t('syncHealth.reduceFailures'),
        description: t('syncHealth.reduceFailuresDesc'),
        action: t('syncHealth.reduceFailuresAction')
      });
    }
    
    // Alert: Excessive conflicts
    if (conflictRate > 5) {
      alerts.push({
        id: 'high-conflict-rate',
        severity: 'warning',
        title: t('syncHealth.frequentConflicts'),
        description: t('syncHealth.frequentConflictsDesc', { rate: conflictRate.toFixed(1) }),
        timestamp: new Date()
      });
      recommendations.push({
        id: 'rec-conflicts',
        priority: 'medium',
        title: t('syncHealth.minimizeConcurrentEdits'),
        description: t('syncHealth.minimizeConcurrentEditsDesc'),
        action: t('syncHealth.minimizeConcurrentEditsAction')
      });
    }
    
    // Alert: Recent conflicts spike
    if (recentConflicts > 3) {
      alerts.push({
        id: 'recent-conflicts',
        severity: 'warning',
        title: t('syncHealth.recentConflictSpike'),
        description: t('syncHealth.recentConflictSpikeDesc', { count: recentConflicts }),
        timestamp: new Date()
      });
    }
    
    // Alert: Circuit breakers active
    if (activeBreakers > 0) {
      alerts.push({
        id: 'circuit-breakers',
        severity: 'critical',
        title: t('syncHealth.circuitBreakersActive'),
        description: t('syncHealth.circuitBreakersActiveDesc', { count: activeBreakers }),
        timestamp: new Date()
      });
      recommendations.push({
        id: 'rec-circuit-breaker',
        priority: 'high',
        title: t('syncHealth.waitForCircuitBreaker'),
        description: t('syncHealth.waitForCircuitBreakerDesc'),
        action: t('syncHealth.waitForCircuitBreakerAction')
      });
    }
    
    // Alert: Recent failures
    if (recentFailures > 5) {
      alerts.push({
        id: 'recent-failures',
        severity: 'error',
        title: t('syncHealth.multipleRecentFailures'),
        description: t('syncHealth.multipleRecentFailuresDesc', { count: recentFailures }),
        timestamp: new Date()
      });
    }
    
    // Success recommendations
    if (alerts.length === 0) {
      recommendations.push({
        id: 'rec-healthy',
        priority: 'low',
        title: t('syncHealth.systemHealthy'),
        description: t('syncHealth.systemHealthyDesc'),
        action: t('syncHealth.noActionNeeded')
      });
    }
    
    // Calculate overall health score (0-100)
    let healthScore = 100;
    healthScore -= failureRate; // Subtract failure rate
    healthScore -= conflictRate * 2; // Conflicts weighted 2x
    healthScore -= activeBreakers * 20; // Each circuit breaker -20 points
    healthScore -= recentFailures * 3; // Recent failures weighted more
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    // Determine overall health status
    let overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    if (healthScore >= 90) overallHealth = 'excellent';
    else if (healthScore >= 70) overallHealth = 'good';
    else if (healthScore >= 40) overallHealth = 'warning';
    else overallHealth = 'critical';
    
    return {
      overallHealth,
      healthScore,
      conflictRate,
      failureRate,
      avgSyncLatency: avgLatency,
      circuitBreakersActive: activeBreakers,
      recentConflicts,
      recentFailures,
      alerts,
      recommendations
    };
  };

  const refreshMetrics = () => {
    setMetrics(calculateHealthMetrics());
  };

  useEffect(() => {
    refreshMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, 15000); // 15 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  if (!metrics) return null;

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-diagnostic-success';
      case 'good': return 'text-diagnostic-info';
      case 'warning': return 'text-diagnostic-warning';
      case 'critical': return 'text-diagnostic-error';
      default: return 'text-muted-foreground';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-diagnostic-success" aria-hidden="true" />;
      case 'good': return <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-diagnostic-info" aria-hidden="true" />;
      case 'warning': return <AlertTriangle className="w-6 h-6 flex-shrink-0 text-diagnostic-warning" aria-hidden="true" />;
      case 'critical': return <XCircle className="w-6 h-6 flex-shrink-0 text-diagnostic-error" aria-hidden="true" />;
    }
  };

  const getAlertVariant = (severity: string): "default" | "destructive" => {
    switch (severity) {
      case 'critical':
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getBadgeVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case 'critical':
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header - stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">
            {t('syncHealth.title')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('syncHealth.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-label={autoRefresh ? t('syncHealth.auto') : t('syncHealth.manual')}
            className="h-10 sm:h-9"
          >
            <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline ml-2">
              {autoRefresh ? t('syncHealth.auto') : t('syncHealth.manual')}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            disabled={autoRefresh}
            aria-label={t('syncHealth.refresh')}
            className="h-10 sm:h-9"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline ml-2">{t('syncHealth.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Overall Health Score */}
      <Card className="rounded-2xl border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-start sm:items-center gap-3">
            {getHealthIcon(metrics.overallHealth)}
            <div className="min-w-0">
              <h4 className="text-xl font-semibold sm:text-2xl">
                {t('syncHealth.overallHealth')}: <span className={getHealthColor(metrics.overallHealth)}>
                  {t(`syncHealth.${metrics.overallHealth}`)}
                </span>
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('syncHealth.healthScore')}: {metrics.healthScore}/100
              </p>
            </div>
          </div>
          {metrics.overallHealth === 'excellent' && (
            <Badge variant="outline" className="whitespace-nowrap shrink-0 self-start sm:self-center border-diagnostic-success/40 font-medium text-diagnostic-success">
              {t('syncHealth.allSystemsNormal')}
            </Badge>
          )}
        </div>
        <Progress value={metrics.healthScore} className="h-2" />
      </Card>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2">
          <h4 className="eyebrow">
            {t('syncHealth.activeAlerts', { count: metrics.alerts.length })}
          </h4>
          <div className="space-y-2">
            {metrics.alerts.map(alert => (
              <Alert key={alert.id} variant={getAlertVariant(alert.severity)} className="rounded-xl">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
                  {alert.title}
                  <Badge variant={getBadgeVariant(alert.severity)}>
                    {t(`syncHealth.severity.${alert.severity}`)}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-sm">
                  {alert.description}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-soft md:grid-cols-3">
        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.failureRate')}
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${metrics.failureRate > 20 ? 'text-diagnostic-error' : 'text-diagnostic-success'}`}>
              {metrics.failureRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.target')}: {t('syncHealth.lessThan10')}
            </div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.conflictRate')}
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${metrics.conflictRate > 5 ? 'text-diagnostic-warning' : 'text-diagnostic-success'}`}>
              {metrics.conflictRate.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.per100Syncs')}
            </div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.circuitBreakers')}
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${metrics.circuitBreakersActive > 0 ? 'text-diagnostic-error' : 'text-diagnostic-success'}`}>
              {metrics.circuitBreakersActive}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.circuitBreakersActive > 0 ? t('syncHealth.active') : t('syncHealth.noneActive')}
            </div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.recentConflicts')}
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${metrics.recentConflicts > 3 ? 'text-diagnostic-warning' : 'text-diagnostic-success'}`}>
              {metrics.recentConflicts}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.lastHour')}
            </div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.recentFailures')}
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${metrics.recentFailures > 5 ? 'text-diagnostic-error' : 'text-diagnostic-success'}`}>
              {metrics.recentFailures}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.last10Ops')}
            </div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.avgLatency')}
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {metrics.avgSyncLatency}ms
            </div>
            <div className="text-xs text-muted-foreground">
              {t('syncHealth.estimated')}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <Card className="rounded-2xl border-border bg-card p-5 shadow-soft sm:p-6">
        <h4 className="eyebrow mb-1">
          {t('syncHealth.recommendations')}
        </h4>
        <ScrollArea className="h-[300px]">
          <div className="divide-y divide-border">
            {metrics.recommendations.map(rec => (
              <div key={rec.id} className="py-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h5 className="min-w-0 text-sm font-medium">{rec.title}</h5>
                  <Badge 
                    variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                    className="flex-shrink-0 text-xs"
                  >
                    {t(`syncHealth.${rec.priority}`)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {rec.description}
                </p>
                {rec.action && (
                  <div className="text-xs font-medium text-foreground">
                    → {rec.action}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Info Footer */}
      <div className="rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">{t('syncHealth.healthTips')}</strong>
        <ul className="mt-2 space-y-1">
          <li>{t('syncHealth.greenMetrics')}</li>
          <li>{t('syncHealth.yellowWarnings')}</li>
          <li>{t('syncHealth.redAlerts')}</li>
          <li>{t('syncHealth.circuitBreakersReset')}</li>
          <li>{t('syncHealth.checkDiagnostics')}</li>
        </ul>
      </div>
    </div>
  );
};
