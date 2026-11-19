import { useState, useEffect } from "react";
import { storageServiceV2 } from "@/services/storageServiceV2";
import type { DiagnosticEntry, SyncDiagnostics as SyncDiagnosticsType } from "@/services/storageServiceV2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Activity,
  Trash2,
  Zap,
  XCircle,
  Download
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getDateLocale } from "@/utils/dateLocale";
import { saveAs } from "file-saver";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const SyncDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState<SyncDiagnosticsType | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  
  // Get date-fns locale based on current language
  const dateLocale = getDateLocale(i18n.language);

  const refreshDiagnostics = () => {
    const data = storageServiceV2.getDiagnostics();
    setDiagnostics(data);
  };

  useEffect(() => {
    refreshDiagnostics();
    
    if (autoRefresh) {
      // Refresh every 10 seconds for better performance
      const interval = setInterval(refreshDiagnostics, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleClear = () => {
    storageServiceV2.clearDiagnostics();
    refreshDiagnostics();
  };

  const handleExport = () => {
    const data = storageServiceV2.getDiagnostics();
    const total = data.successCount + data.failureCount;
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      summary: {
        successRate: total > 0 ? Math.round((data.successCount / total) * 100) : 0,
        successCount: data.successCount,
        failureCount: data.failureCount,
        retryCount: data.retryCount,
      },
      circuitBreakers: Object.fromEntries(data.circuitBreakerStatus),
      activeRetries: Array.from(data.activeRetries),
      entries: data.recentEntries,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const safeTs = new Date().toISOString().replace(/[:.]/g, '-');
    saveAs(blob, `ownjournal-diagnostics-${safeTs}.json`);
  };

  if (!diagnostics) {
    return (
      <Card className="rounded-2xl border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{t('syncDiagnostics.title')}</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {autoRefresh ? t('syncDiagnostics.auto') : t('syncDiagnostics.manual')}
            </Button>
            <Button variant="outline" size="sm" onClick={refreshDiagnostics}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              {t('syncDiagnostics.refresh')}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{t('syncDiagnostics.loading')}</p>
      </Card>
    );
  }

  const getTypeIcon = (type: DiagnosticEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-diagnostic-success" aria-hidden="true" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-diagnostic-error" aria-hidden="true" />;
      case 'retry':
        return <RefreshCw className="w-4 h-4 text-diagnostic-warning" aria-hidden="true" />;
      case 'circuit_breaker':
        return <Zap className="w-4 h-4 text-diagnostic-error" aria-hidden="true" />;
      case 'operation':
        return <Activity className="w-4 h-4 text-diagnostic-info" aria-hidden="true" />;
    }
  };

  const getTypeBadge = (type: DiagnosticEntry['type']) => {
    const variants: Record<DiagnosticEntry['type'], BadgeVariant> = {
      success: 'default',
      error: 'destructive',
      retry: 'secondary',
      circuit_breaker: 'outline',
      operation: 'outline'
    };
    
    return (
      <Badge variant={variants[type]} className="text-xs capitalize">
        {t(`syncDiagnostics.types.${type}`)}
      </Badge>
    );
  };

  const successRate = diagnostics.successCount + diagnostics.failureCount > 0
    ? Math.round((diagnostics.successCount / (diagnostics.successCount + diagnostics.failureCount)) * 100)
    : 0;

  const circuitBreakers = Array.from(diagnostics.circuitBreakerStatus.entries());
  const activeRetries = Array.from(diagnostics.activeRetries);

  return (
    <div className="space-y-4">
      {/* Header with controls - responsive for mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-xl font-semibold">{t('syncDiagnostics.title')}</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            aria-label={autoRefresh ? t('syncDiagnostics.auto') : t('syncDiagnostics.manual')}
            className="h-10 sm:h-9"
          >
            <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline ml-2">
              {autoRefresh ? t('syncDiagnostics.auto') : t('syncDiagnostics.manual')}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDiagnostics}
            disabled={autoRefresh}
            aria-label={t('syncDiagnostics.refresh')}
            className="h-10 sm:h-9"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline ml-2">{t('syncDiagnostics.refresh')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            aria-label={t('syncDiagnostics.clear')}
            className="h-10 sm:h-9"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline ml-2">{t('syncDiagnostics.clear')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            aria-label={t('syncDiagnostics.downloadLogs')}
            className="h-10 sm:h-9"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline ml-2">{t('syncDiagnostics.downloadLogs')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-soft lg:grid-cols-4">
        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.successRate')}</div>
            <div className="text-2xl font-semibold tabular-nums text-diagnostic-success">{successRate}%</div>
            <div className="text-xs text-muted-foreground">
              {diagnostics.successCount} / {diagnostics.successCount + diagnostics.failureCount}
            </div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.retries')}</div>
            <div className="text-2xl font-semibold tabular-nums text-diagnostic-warning">{diagnostics.retryCount}</div>
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.totalAttempts')}</div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.failures')}</div>
            <div className="text-2xl font-semibold tabular-nums text-diagnostic-error">{diagnostics.failureCount}</div>
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.totalErrors')}</div>
          </div>
        </div>

        <div className="bg-card p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.activeRetries')}</div>
            <div className="text-2xl font-semibold tabular-nums text-diagnostic-info">{activeRetries.length}</div>
            <div className="text-xs text-muted-foreground">{t('syncDiagnostics.inProgress')}</div>
          </div>
        </div>
      </div>

      {/* Circuit Breakers */}
      {circuitBreakers.length > 0 && (
        <Card className="rounded-2xl border-border bg-card p-5 shadow-soft sm:p-6">
          <h4 className="eyebrow mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-diagnostic-error" aria-hidden="true" />
            {t('syncDiagnostics.circuitBreakers')}
          </h4>
          <div className="space-y-2">
            {circuitBreakers.map(([name, status]) => {
              const isOpen = Date.now() < status.openUntil;
              return (
                <div key={name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 break-all font-mono text-xs">{name}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isOpen ? "destructive" : "outline"}>
                      {isOpen ? t('syncDiagnostics.open') : t('syncDiagnostics.closed')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t('syncDiagnostics.failures_count', { count: status.failures })}
                      {isOpen && ` • ${t('syncDiagnostics.reopens', { time: formatDistanceToNow(status.openUntil, { addSuffix: true, locale: dateLocale }) })}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Active Retries */}
      {activeRetries.length > 0 && (
        <Card className="rounded-2xl border-border bg-card p-5 shadow-soft sm:p-6">
          <h4 className="eyebrow mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-diagnostic-warning animate-spin" aria-hidden="true" />
            {t('syncDiagnostics.currentlyRetrying')}
          </h4>
          <div className="space-y-1">
            {activeRetries.map((operation) => (
              <div key={operation} className="break-all text-xs font-mono text-muted-foreground">
                {operation}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Operations */}
      <Card className="rounded-2xl border-border bg-card p-5 shadow-soft sm:p-6">
        <h4 className="eyebrow mb-1">{t('syncDiagnostics.recentOperations')}</h4>
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border">
            {diagnostics.recentEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t('syncDiagnostics.noOperationsYet')}
              </div>
            ) : (
              diagnostics.recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTypeBadge(entry.type)}
                      <span className="min-w-0 max-w-full truncate text-xs font-mono text-muted-foreground">
                        {entry.operationName}
                      </span>
                      {entry.attemptNumber && (
                        <Badge variant="outline" className="text-xs">
                          {t('syncDiagnostics.attempt', { number: entry.attemptNumber })}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm break-words">{entry.message}</div>
                    {entry.delayMs !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {t('syncDiagnostics.retryDelay')}: {Math.round(entry.delayMs)}ms
                      </div>
                    )}
                    {entry.details && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          {t('syncDiagnostics.details')}
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2.5 text-xs text-foreground">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="max-w-[35%] flex-shrink-0 text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: dateLocale })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      <div className="text-xs text-muted-foreground">
        <AlertCircle className="w-3 h-3 inline mr-1" aria-hidden="true" />
        {t('syncDiagnostics.diagnosticsNote')}
      </div>
    </div>
  );
};
