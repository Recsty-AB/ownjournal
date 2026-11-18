import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Crown, Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  isVoiceRecordingSupported,
  useVoiceRecorder,
  VoiceRecorderError,
  type VoiceRecording,
} from "@/hooks/useVoiceRecorder";
import {
  getMonthlySecondsUsed,
  hasVoiceConsent,
  setVoiceConsent,
  transcribeAudio,
  TranscriptionError,
  TRANSCRIPTION_LIMITS,
} from "@/services/transcriptionService";
import { canShowAnyPurchaseCTA } from "@/utils/platformDetection";

interface VoiceInputButtonProps {
  isPro: boolean;
  /** Receives the cleaned-up transcript of each finished recording. */
  onTranscript: (text: string) => void;
}

const WARN_BEFORE_STOP_SECONDS = 10;

const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const VoiceInputButton = ({ isPro, onTranscript }: VoiceInputButtonProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [consentOpen, setConsentOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // Kept in memory only, so a failed transcription can be retried without re-recording.
  const [failedRecording, setFailedRecording] = useState<VoiceRecording | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const showError = (key: string, params?: Record<string, unknown>) => {
    toast({ title: t("voice.title"), description: t(key, params), variant: "destructive" });
  };

  const transcribe = async (recording: VoiceRecording) => {
    setTranscribing(true);
    setFailedRecording(null);
    try {
      const result = await transcribeAudio({
        blob: recording.blob,
        durationSeconds: recording.durationSeconds,
        language: i18n.language,
      });
      setRemainingSeconds(Math.max(0, TRANSCRIPTION_LIMITS.monthlySeconds - result.monthlySecondsUsed));
      if (result.text.trim()) {
        onTranscript(result.text);
      } else {
        showError("voice.errors.noSpeech");
      }
    } catch (error) {
      const code = error instanceof TranscriptionError ? error.code : "failed";
      if (code === "limitReached") {
        setRemainingSeconds(0);
        showError("voice.errors.limitReached", { minutes: TRANSCRIPTION_LIMITS.monthlySeconds / 60 });
      } else {
        // Offline and transient failures keep the clip for a retry.
        if (code === "offline" || code === "failed") setFailedRecording(recording);
        showError(`voice.errors.${code}`);
      }
    } finally {
      setTranscribing(false);
    }
  };

  const recorder = useVoiceRecorder({
    maxSeconds: TRANSCRIPTION_LIMITS.maxClipSeconds,
    onRecorded: (recording) => {
      void transcribe(recording);
    },
  });

  const beginRecording = async () => {
    setPreparing(true);
    try {
      const used = await getMonthlySecondsUsed();
      const remaining = used === null ? null : Math.max(0, TRANSCRIPTION_LIMITS.monthlySeconds - used);
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        showError("voice.errors.limitReached", { minutes: TRANSCRIPTION_LIMITS.monthlySeconds / 60 });
        return;
      }
      setFailedRecording(null);
      await recorder.start(remaining ?? TRANSCRIPTION_LIMITS.maxClipSeconds);
    } catch (error) {
      const code = error instanceof VoiceRecorderError ? error.code : "failed";
      showError(code === "failed" ? "voice.errors.failed" : `voice.errors.${code}`);
    } finally {
      setPreparing(false);
    }
  };

  const handleStartClick = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showError("voice.errors.offline");
      return;
    }
    if (!hasVoiceConsent()) {
      setConsentOpen(true);
      return;
    }
    void beginRecording();
  };

  // Same rule as the other Plus AI surfaces: on native builds without a
  // purchase path, don't show Plus-branded controls to free users at all.
  if (!isPro && !canShowAnyPurchaseCTA()) return null;
  if (!isVoiceRecordingSupported()) return null;

  // Free users get a teaser of what Plus unlocks (text only, like the
  // Activity Insights lock card); upgrading happens through the plan banner.
  if (!isPro) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="relative h-9 w-9"
            aria-label={t("voice.plusFeature")}
            title={t("voice.plusFeature")}
          >
            <Mic className="w-4 h-4 text-muted-foreground" />
            <Crown className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-2">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">{t("voice.title")}</p>
            <Crown className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">{t("voice.teaserBody")}</p>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t("voice.plusFeature")}</p>
        </PopoverContent>
      </Popover>
    );
  }

  if (recorder.state === "recording") {
    const secondsLeft = recorder.clipLimitSeconds - recorder.elapsedSeconds;
    const warn = secondsLeft <= WARN_BEFORE_STOP_SECONDS;
    return (
      <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <span className={`text-sm tabular-nums ${warn ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {warn
            ? t("voice.stopsIn", { seconds: Math.max(0, Math.ceil(secondsLeft)) })
            : `${formatClock(recorder.elapsedSeconds)} / ${formatClock(recorder.clipLimitSeconds)}`}
        </span>
        <Button type="button" size="sm" onClick={recorder.stop}>
          <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
          {t("voice.stop")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={recorder.cancel} aria-label={t("voice.cancel")} title={t("voice.cancel")}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (transcribing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("voice.transcribing")}
      </div>
    );
  }

  if (failedRecording) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void transcribe(failedRecording)}>
          <RotateCcw className="w-4 h-4 mr-1.5" />
          {t("voice.retry")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setFailedRecording(null)}>
          {t("voice.discard")}
        </Button>
      </div>
    );
  }

  const busy = preparing || recorder.state === "requesting";

  return (
    <>
      <div className="flex items-center gap-2">
        {remainingSeconds !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("voice.minutesLeft", { minutes: Math.floor(remainingSeconds / 60) })}
          </span>
        )}
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={handleStartClick}
          disabled={busy}
          aria-label={t("voice.dictate")}
          title={t("voice.dictate")}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        </Button>
      </div>

      <AlertDialog open={consentOpen} onOpenChange={setConsentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voice.consentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voice.consentBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("voice.consentDecline")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setVoiceConsent();
                void beginRecording();
              }}
            >
              {t("voice.consentAccept")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
