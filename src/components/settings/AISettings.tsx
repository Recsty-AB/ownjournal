/**
 * AI Settings tab — local vs cloud AI mode, model selection, device
 * capability display, download / benchmark / delete controls.
 *
 * Rendered inside SettingsDialog under the "ai" tab. Gated on Plus
 * (non-Plus users see a lock card). Gated on FEATURES.LOCAL_AI_ENABLED
 * so Phase 1 scaffolding can ship without exposing a half-finished
 * feature to users.
 *
 * See docs/LOCAL_AI.md for the full feature specification, device
 * tiers, and Phase 1 / Phase 2 split.
 */

import { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Brain,
  Cloud,
  Cpu,
  Crown,
  Loader2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Activity,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { FEATURES } from '@/config/features';
import {
  LOCAL_AI_MODELS,
  LocalAIModelId,
  formatModelSize,
  getModelsForPlatform,
  LocalAIPlatform,
} from '@/config/localAIModels';
import { useLocalAICapability } from '@/hooks/useLocalAICapability';
import { useLocalAISettings } from '@/hooks/useLocalAISettings';
import { setLocalAIPreferences, type LocalAIPreferences } from '@/utils/localAISettings';
import { checkStorageForDownload } from '@/services/localAICapabilities';
import { localAIGenerative, type DownloadProgress, type BenchmarkResult } from '@/services/localAIGenerative';

interface AISettingsProps {
  isPro: boolean;
}

export const AISettings = ({ isPro }: AISettingsProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { capability, loading: capabilityLoading, refresh } = useLocalAICapability();
  const prefs = useLocalAISettings();

  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  const updatePrefs = useCallback((patch: Partial<LocalAIPreferences>) => {
    setLocalAIPreferences(patch);
  }, []);

  // Non-Plus users see the lock card and nothing else
  if (!isPro) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed border-2">
          <CardContent className="p-6 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-primary/10">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-1">{t('settings.aiTab.plusRequired')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('settings.aiTab.plusRequiredDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Feature flag off — show "coming soon" placeholder but keep it honest
  if (!FEATURES.LOCAL_AI_ENABLED) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              {t('settings.aiTab.title')}
            </CardTitle>
            <CardDescription>{t('settings.aiTab.cloudModeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ModeCard mode="cloud" active />
            <p className="text-xs text-muted-foreground mt-4">
              {t('settings.aiTab.localComingSoon')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSelectMode = (mode: 'cloud' | 'local') => {
    updatePrefs({ mode });
    toast({
      title: mode === 'cloud'
        ? t('settings.aiTab.cloudModeSelected')
        : t('settings.aiTab.localModeSelected'),
    });
  };

  const handleSelectModel = (modelId: LocalAIModelId) => {
    updatePrefs({ selectedModel: modelId });
  };

  const handleDownload = async () => {
    if (!prefs.selectedModel || isDownloading) return;
    const modelSpec = LOCAL_AI_MODELS[prefs.selectedModel];
    // Re-check storage right before downloading — the initial
    // capability check may be minutes or hours old, and the user may
    // have filled their disk in the meantime.
    const storageCheck = await checkStorageForDownload(modelSpec.downloadSizeBytes);
    if (storageCheck.ok === false) {
      toast({
        title: t('settings.aiTab.downloadFailed'),
        description: storageCheck.detail,
        variant: 'destructive',
      });
      return;
    }
    setIsDownloading(true);
    setDownloadProgress({ loaded: 0, total: 0, percent: 0, currentFile: null });
    try {
      await localAIGenerative.loadModel(prefs.selectedModel, (progress) => {
        setDownloadProgress(progress);
      });
      updatePrefs({ lastVerifiedAt: Date.now() });
      toast({
        title: t('settings.aiTab.downloadComplete'),
        description: t('settings.aiTab.downloadCompleteDesc'),
      });
    } catch (error) {
      console.error('Local AI download failed:', error);
      toast({
        title: t('settings.aiTab.downloadFailed'),
        description: error instanceof Error ? error.message : t('settings.aiTab.downloadFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDelete = async () => {
    try {
      await localAIGenerative.clearCache();
      updatePrefs({ lastVerifiedAt: null });
      toast({ title: t('settings.aiTab.modelDeleted') });
    } catch (error) {
      console.error('Failed to delete local model:', error);
      toast({
        title: t('settings.aiTab.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleBenchmark = async () => {
    if (!prefs.selectedModel) return;
    setIsBenchmarking(true);
    try {
      // Ensure the model is loaded before benchmarking
      if (!localAIGenerative.isReady() || localAIGenerative.getLoadedModel() !== prefs.selectedModel) {
        await localAIGenerative.loadModel(prefs.selectedModel);
      }
      const result = await localAIGenerative.runBenchmark(prefs.selectedModel);
      setBenchmark(result);
    } catch (error) {
      console.error('Benchmark failed:', error);
      toast({
        title: t('settings.aiTab.benchmarkFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsBenchmarking(false);
    }
  };

  if (capabilityLoading || !capability) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const platform: LocalAIPlatform = capability.detected.platform === 'mobile' ? 'mobile' : 'desktop';
  const availableModels = getModelsForPlatform(platform);

  return (
    <div className="space-y-6">
      {/* Mode selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {t('settings.aiTab.title')}
          </CardTitle>
          <CardDescription>{t('settings.aiTab.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            value={prefs.mode}
            onValueChange={(v) => handleSelectMode(v as 'cloud' | 'local')}
          >
            <ModeCard
              mode="cloud"
              active={prefs.mode === 'cloud'}
              selectable
            />
            <ModeCard
              mode="local"
              active={prefs.mode === 'local'}
              selectable
              disabled={capability.tier === 'unsupported'}
              disabledReason={capability.tier === 'unsupported' ? capability.detail : undefined}
            />
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Local mode details — shown only when local is selected */}
      {prefs.mode === 'local' && capability.tier !== 'unsupported' && (
        <>
          {/* Device capability panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                {t('settings.aiTab.yourDevice')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <DeviceRow
                ok={capability.detected.hasWebGPU}
                label={t('settings.aiTab.webgpu')}
                value={capability.detected.hasWebGPU ? t('settings.aiTab.supported') : t('settings.aiTab.notSupported')}
              />
              <DeviceRow
                ok={
                  capability.detected.estimatedRamBytes !== null &&
                  capability.detected.estimatedRamBytes >= 6_000_000_000
                }
                label={t('settings.aiTab.ram')}
                value={
                  capability.detected.estimatedRamBytes !== null
                    ? `${formatModelSize(capability.detected.estimatedRamBytes)}`
                    : t('settings.aiTab.unknown')
                }
              />
              <DeviceRow
                ok={
                  capability.detected.availableStorageBytes === null ||
                  capability.detected.availableStorageBytes >= 3_000_000_000
                }
                label={t('settings.aiTab.storage')}
                value={
                  capability.detected.availableStorageBytes !== null
                    ? `${formatModelSize(capability.detected.availableStorageBytes)} ${t('settings.aiTab.free')}`
                    : t('settings.aiTab.unknown')
                }
              />
              <Button variant="ghost" size="sm" onClick={refresh} className="mt-2">
                {t('settings.aiTab.recheck')}
              </Button>
            </CardContent>
          </Card>

          {/* Model selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.aiTab.modelSelection')}</CardTitle>
              <CardDescription>
                {capability.tier === 'desktop-9b-capable'
                  ? t('settings.aiTab.modelSelectionDescChoice')
                  : t('settings.aiTab.modelSelectionDescSingle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value={prefs.selectedModel ?? ''}
                onValueChange={(v) => handleSelectModel(v as LocalAIModelId)}
              >
                {availableModels.map((model) => {
                  const eligible =
                    capability.detected.estimatedRamBytes === null ||
                    capability.detected.estimatedRamBytes >= model.requiredSystemRamBytes;
                  return (
                    <ModelCard
                      key={model.id}
                      model={model}
                      platform={platform}
                      selected={prefs.selectedModel === model.id}
                      eligible={eligible}
                    />
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Download / status / benchmark / delete */}
          {prefs.selectedModel && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('settings.aiTab.modelStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDownloading && downloadProgress && (
                  <div className="space-y-2">
                    <Progress value={downloadProgress.percent} />
                    <p className="text-xs text-muted-foreground">
                      {downloadProgress.currentFile ?? '…'} —{' '}
                      {formatModelSize(downloadProgress.loaded)} /{' '}
                      {formatModelSize(downloadProgress.total)} (
                      {downloadProgress.percent.toFixed(0)}%)
                    </p>
                  </div>
                )}

                {!isDownloading && prefs.lastVerifiedAt && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('settings.aiTab.modelReady')}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleDownload} disabled={isDownloading} size="sm">
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('settings.aiTab.downloading')}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        {prefs.lastVerifiedAt
                          ? t('settings.aiTab.redownload')
                          : t('settings.aiTab.download')}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleBenchmark}
                    disabled={isDownloading || isBenchmarking || !prefs.lastVerifiedAt}
                    size="sm"
                    variant="outline"
                  >
                    {isBenchmarking ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('settings.aiTab.benchmarking')}
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4 mr-2" />
                        {t('settings.aiTab.runBenchmark')}
                      </>
                    )}
                  </Button>
                  {prefs.lastVerifiedAt && (
                    <Button
                      onClick={handleDelete}
                      disabled={isDownloading}
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('settings.aiTab.deleteModel')}
                    </Button>
                  )}
                </div>

                {benchmark && <BenchmarkResults result={benchmark} />}
              </CardContent>
            </Card>
          )}

          {/* Local-only strict mode toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="local-only-toggle" className="font-medium">
                    {t('settings.aiTab.localOnly')}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('settings.aiTab.localOnlyDesc')}
                  </p>
                </div>
                <Switch
                  id="local-only-toggle"
                  checked={prefs.localOnly}
                  onCheckedChange={(checked) => updatePrefs({ localOnly: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Unsupported message */}
      {prefs.mode === 'local' && capability.tier === 'unsupported' && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h4 className="font-semibold">{t('settings.aiTab.unsupportedTitle')}</h4>
                <p className="text-sm text-muted-foreground">{capability.detail}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.aiTab.unsupportedFallback')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

interface ModeCardProps {
  mode: 'cloud' | 'local';
  active: boolean;
  selectable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const ModeCard = ({ mode, active, selectable = false, disabled = false, disabledReason }: ModeCardProps) => {
  const { t } = useTranslation();
  const Icon = mode === 'cloud' ? Cloud : Brain;
  const titleKey = mode === 'cloud' ? 'settings.aiTab.cloudMode' : 'settings.aiTab.localMode';
  const descKey = mode === 'cloud' ? 'settings.aiTab.cloudModeDesc' : 'settings.aiTab.localModeDesc';

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {selectable && (
        <RadioGroupItem value={mode} id={`mode-${mode}`} disabled={disabled} className="mt-1" />
      )}
      <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <Label htmlFor={selectable ? `mode-${mode}` : undefined} className="font-semibold cursor-pointer">
          {t(titleKey)}
        </Label>
        <p className="text-sm text-muted-foreground mt-1">{t(descKey)}</p>
        {disabled && disabledReason && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{disabledReason}</p>
        )}
      </div>
    </div>
  );
};

interface ModelCardProps {
  model: (typeof LOCAL_AI_MODELS)[LocalAIModelId];
  platform: LocalAIPlatform;
  selected: boolean;
  eligible: boolean;
}

const ModelCard = ({ model, platform, selected, eligible }: ModelCardProps) => {
  const { t } = useTranslation();
  const tps = model.tokensPerSecondEstimate[platform];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border'
      } ${!eligible ? 'opacity-50' : ''}`}
    >
      <RadioGroupItem value={model.id} id={`model-${model.id}`} disabled={!eligible} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Label htmlFor={`model-${model.id}`} className="font-semibold cursor-pointer">
            {model.displayName}
          </Label>
          <Badge variant="outline" className="text-xs">
            {model.tierLabel}
          </Badge>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <dt>{t('settings.aiTab.downloadSize')}</dt>
            <dd className="font-medium text-foreground">{formatModelSize(model.downloadSizeBytes)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('settings.aiTab.ramNeeded')}</dt>
            <dd className="font-medium text-foreground">{formatModelSize(model.inferenceRamBytes)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('settings.aiTab.minRam')}</dt>
            <dd className="font-medium text-foreground">{formatModelSize(model.requiredSystemRamBytes)}</dd>
          </div>
          {tps !== undefined && (
            <div className="flex justify-between">
              <dt>{t('settings.aiTab.speed')}</dt>
              <dd className="font-medium text-foreground">~{tps} tok/s</dd>
            </div>
          )}
        </dl>
        {!eligible && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            {t('settings.aiTab.modelIneligible', {
              required: formatModelSize(model.requiredSystemRamBytes),
            })}
          </p>
        )}
      </div>
    </div>
  );
};

const BenchmarkResults = ({ result }: { result: BenchmarkResult }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs">
      <div className="font-medium text-sm flex items-center gap-2">
        <Activity className="w-4 h-4" />
        {t('settings.aiTab.benchmarkResults')}
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('settings.aiTab.device')}</span>
        <span className="font-medium uppercase">{result.device}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('settings.aiTab.tokensPerSecond')}</span>
        <span className="font-medium">{result.tokensPerSecond.toFixed(1)}</span>
      </div>
      {result.timeToFirstTokenMs > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('settings.aiTab.timeToFirstToken')}</span>
          <span className="font-medium">{result.timeToFirstTokenMs} ms</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-muted-foreground">{t('settings.aiTab.totalTime')}</span>
        <span className="font-medium">{result.totalTimeMs} ms</span>
      </div>
    </div>
  );
};

interface DeviceRowProps {
  ok: boolean;
  label: string;
  value: string;
}

const DeviceRow = ({ ok, label, value }: DeviceRowProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
    <span className="font-medium">{value}</span>
  </div>
);
