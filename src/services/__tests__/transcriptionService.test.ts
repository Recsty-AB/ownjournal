import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invokeWithRetry: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock('@/utils/edgeFunctionRetry', () => ({
  invokeWithRetry: mocks.invokeWithRetry,
}));

import { insertTranscript, transcribeAudio, TranscriptionError } from '../transcriptionService';

describe('insertTranscript', () => {
  it('appends to an empty entry', () => {
    expect(insertTranscript('', ' Hello there. ', 0, 0)).toEqual({ value: 'Hello there.', caret: 12 });
  });

  it('adds a space after existing text', () => {
    expect(insertTranscript('Morning.', 'Then lunch.', 8, 8)).toEqual({
      value: 'Morning. Then lunch.',
      caret: 20,
    });
  });

  it('separates the transcript from text on both sides at the caret', () => {
    expect(insertTranscript('AB', 'x', 1, 1)).toEqual({ value: 'A x B', caret: 3 });
  });

  it('does not double existing whitespace', () => {
    expect(insertTranscript('Line one\n', 'Line two', 9, 9)).toEqual({ value: 'Line one\nLine two', caret: 17 });
  });

  it('replaces a selection', () => {
    expect(insertTranscript('I felt bad today', 'great', 7, 10).value).toBe('I felt great today');
  });

  it('leaves the text unchanged for an empty transcript', () => {
    expect(insertTranscript('Keep me', '   ', 3, 3)).toEqual({ value: 'Keep me', caret: 3 });
  });

  it('clamps an out-of-range selection', () => {
    expect(insertTranscript('abc', 'd', 99, 99).value).toBe('abc d');
  });
});

describe('transcribeAudio', () => {
  const blob = new Blob(['x'], { type: 'audio/webm' });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  });

  it('sends the clip as multipart form data and returns the transcript', async () => {
    mocks.invokeWithRetry.mockResolvedValue({ data: { text: 'Hello', monthlySecondsUsed: 30 }, error: null });

    const result = await transcribeAudio({ blob, durationSeconds: 29.6, language: 'zh-TW' });

    expect(result).toEqual({ text: 'Hello', monthlySecondsUsed: 30 });
    const [, name, options] = mocks.invokeWithRetry.mock.calls[0];
    expect(name).toBe('ai-transcribe');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('durationSeconds')).toBe('30');
    expect(options.body.get('language')).toBe('zh-TW');
    expect(options.headers.Authorization).toBe('Bearer token');
  });

  it.each([
    [401, 'authRequired'],
    [403, 'plusRequired'],
    [413, 'tooLarge'],
    [415, 'unsupportedFormat'],
    [429, 'limitReached'],
    [503, 'failed'],
  ])('maps HTTP %i to %s', async (status, code) => {
    mocks.invokeWithRetry.mockResolvedValue({ data: null, error: { context: { status } } });

    await expect(transcribeAudio({ blob, durationSeconds: 5, language: 'en' })).rejects.toMatchObject({ code });
  });

  it('fails fast when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await expect(transcribeAudio({ blob, durationSeconds: 5, language: 'en' })).rejects.toEqual(
      new TranscriptionError('offline'),
    );
    expect(mocks.invokeWithRetry).not.toHaveBeenCalled();
  });

  it('requires a session', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await expect(transcribeAudio({ blob, durationSeconds: 5, language: 'en' })).rejects.toMatchObject({
      code: 'authRequired',
    });
  });
});
