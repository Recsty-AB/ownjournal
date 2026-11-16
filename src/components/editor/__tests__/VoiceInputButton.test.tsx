import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  canShowAnyPurchaseCTA: vi.fn(() => true),
  transcribeAudio: vi.fn(),
  getMonthlySecondsUsed: vi.fn(),
  hasVoiceConsent: vi.fn(() => true),
  setVoiceConsent: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/utils/platformDetection', () => ({ canShowAnyPurchaseCTA: mocks.canShowAnyPurchaseCTA }));
vi.mock('@/services/transcriptionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/transcriptionService')>();
  return {
    ...actual,
    transcribeAudio: mocks.transcribeAudio,
    getMonthlySecondsUsed: mocks.getMonthlySecondsUsed,
    hasVoiceConsent: mocks.hasVoiceConsent,
    setVoiceConsent: mocks.setVoiceConsent,
  };
});

import { VoiceInputButton } from '../VoiceInputButton';
import { TranscriptionError } from '@/services/transcriptionService';

class FakeMediaRecorder {
  static isTypeSupported = vi.fn((type: string) => type === 'audio/webm;codecs=opus');
  static last: FakeMediaRecorder | null = null;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: MediaStream, options: { mimeType?: string }) {
    this.mimeType = options.mimeType ?? '';
    FakeMediaRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canShowAnyPurchaseCTA.mockReturnValue(true);
  mocks.hasVoiceConsent.mockReturnValue(true);
  mocks.getMonthlySecondsUsed.mockResolvedValue(600);
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function recordAndStop() {
  fireEvent.click(screen.getByRole('button', { name: /voice\.dictate/ }));
  const stop = await screen.findByRole('button', { name: /voice\.stop/ });
  await act(async () => {
    fireEvent.click(stop);
  });
}

describe('VoiceInputButton', () => {
  it('records, transcribes and hands back the text', async () => {
    mocks.transcribeAudio.mockResolvedValue({ text: 'Dictated words.', monthlySecondsUsed: 610 });
    const onTranscript = vi.fn();
    render(<VoiceInputButton isPro onTranscript={onTranscript} />);

    await recordAndStop();

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Dictated words.'));
    expect(mocks.transcribeAudio.mock.calls[0][0].blob.type).toBe('audio/webm;codecs=opus');
    expect(stopTrack).toHaveBeenCalled();
  });

  it('asks for consent before the first recording', async () => {
    mocks.hasVoiceConsent.mockReturnValue(false);
    render(<VoiceInputButton isPro onTranscript={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /voice\.dictate/ }));

    expect(await screen.findByText('voice.consentTitle')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'voice.consentAccept' }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    expect(mocks.setVoiceConsent).toHaveBeenCalled();
  });

  it('discards a cancelled recording', async () => {
    const onTranscript = vi.fn();
    render(<VoiceInputButton isPro onTranscript={onTranscript} />);

    fireEvent.click(screen.getByRole('button', { name: /voice\.dictate/ }));
    const cancel = await screen.findByRole('button', { name: 'voice.cancel' });
    await act(async () => {
      fireEvent.click(cancel);
    });

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });

  it('keeps the recording for a retry after a failure', async () => {
    mocks.transcribeAudio
      .mockRejectedValueOnce(new TranscriptionError('failed'))
      .mockResolvedValueOnce({ text: 'Second try.', monthlySecondsUsed: 10 });
    const onTranscript = vi.fn();
    render(<VoiceInputButton isPro onTranscript={onTranscript} />);

    await recordAndStop();
    fireEvent.click(await screen.findByRole('button', { name: /voice\.retry/ }));

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Second try.'));
    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(2);
    expect(mocks.transcribeAudio.mock.calls[1][0].blob).toBe(mocks.transcribeAudio.mock.calls[0][0].blob);
  });

  it('does not start recording when the monthly limit is used up', async () => {
    mocks.getMonthlySecondsUsed.mockResolvedValue(200 * 60);
    render(<VoiceInputButton isPro onTranscript={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /voice\.dictate/ }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0].description).toBe('voice.errors.limitReached');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('reports a blocked microphone', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<VoiceInputButton isPro onTranscript={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /voice\.dictate/ }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0].description).toBe('voice.errors.permissionDenied');
  });

  it('shows free users what voice entry unlocks without recording', async () => {
    render(<VoiceInputButton isPro={false} onTranscript={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'voice.plusFeature' }));

    expect(await screen.findByText('voice.teaserBody')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
  });

  it('renders nothing for free users on native builds without a purchase path', () => {
    mocks.canShowAnyPurchaseCTA.mockReturnValue(false);
    const { container } = render(<VoiceInputButton isPro={false} onTranscript={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the browser cannot record audio', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { container } = render(<VoiceInputButton isPro onTranscript={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
