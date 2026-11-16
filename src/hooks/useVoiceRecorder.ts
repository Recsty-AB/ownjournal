import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderState = 'idle' | 'requesting' | 'recording';

export type VoiceRecorderErrorCode = 'notSupported' | 'permissionDenied' | 'noMicrophone' | 'failed';

export class VoiceRecorderError extends Error {
  constructor(readonly code: VoiceRecorderErrorCode) {
    super(code);
    this.name = 'VoiceRecorderError';
  }
}

export interface VoiceRecording {
  blob: Blob;
  durationSeconds: number;
}

interface UseVoiceRecorderOptions {
  /** Default auto-stop limit in seconds; start() can lower it per clip. */
  maxSeconds: number;
  /** Called with the finished clip, whether stopped manually or automatically. */
  onRecorded: (recording: VoiceRecording) => void;
}

// Opus first: smallest files, and accepted by Gemini as audio/webm or audio/ogg.
// Safari/WKWebView only support audio/mp4 (AAC), which the server maps to audio/m4a.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
const AUDIO_BITS_PER_SECOND = 32_000;

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function toRecorderError(error: unknown): VoiceRecorderError {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return new VoiceRecorderError('permissionDenied');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new VoiceRecorderError('noMicrophone');
  return new VoiceRecorderError('failed');
}

/**
 * Records a single audio clip with MediaRecorder. The audio stays in memory
 * and the microphone is released as soon as recording stops or the
 * component unmounts.
 */
export function useVoiceRecorder({ maxSeconds, onRecorded }: UseVoiceRecorderOptions) {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const clipLimitRef = useRef(maxSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const releaseResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    discardRef.current = true;
    stop();
  }, [stop]);

  const start = useCallback(async (clipMaxSeconds: number = maxSeconds) => {
    if (recorderRef.current) return;
    clipLimitRef.current = Math.max(1, Math.min(maxSeconds, clipMaxSeconds));
    if (!isVoiceRecordingSupported()) throw new VoiceRecorderError('notSupported');

    setState('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (error) {
      setState('idle');
      throw toRecorderError(error);
    }

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setState('idle');
      throw new VoiceRecorderError('notSupported');
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const durationSeconds = Math.min(clipLimitRef.current, (performance.now() - startedAtRef.current) / 1000);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || '' });
      chunksRef.current = [];
      releaseResources();
      setState('idle');
      setElapsedSeconds(0);
      if (!discardRef.current && blob.size > 0) {
        onRecordedRef.current({ blob, durationSeconds });
      }
    };

    startedAtRef.current = performance.now();
    setElapsedSeconds(0);
    recorder.start(1000);
    setState('recording');

    timerRef.current = setInterval(() => {
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      setElapsedSeconds(Math.min(clipLimitRef.current, Math.floor(elapsed)));
      if (elapsed >= clipLimitRef.current) stop();
    }, 250);
  }, [maxSeconds, releaseResources, stop]);

  // Never leave the microphone open after unmount, and drop the clip.
  useEffect(() => {
    return () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseResources();
    };
  }, [releaseResources]);

  return { state, elapsedSeconds, clipLimitSeconds: clipLimitRef.current, start, stop, cancel };
}
