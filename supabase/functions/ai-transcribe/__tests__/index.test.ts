import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  serve: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  convert: vi.fn((text: string) => `TW:${text}`),
}));

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: mocks.serve }));
vi.mock('https://esm.sh/@supabase/supabase-js@2.49.1', () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: () => ({ insert: mocks.insert }),
  }),
}));
vi.mock('https://esm.sh/opencc-js@1.4.2/cn2t', () => ({
  default: { Converter: () => mocks.convert },
}));

const fetchMock = vi.fn<typeof fetch>();
let handler: (request: Request) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => ({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        GOOGLE_API_KEY: 'test-google-key',
      })[name],
    },
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ is_pro: true, monthly_transcription_seconds: 0 }], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  await import('../index');
  handler = mocks.serve.mock.calls[0][0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface SendOptions {
  bytes?: number;
  type?: string;
  durationSeconds?: number;
  language?: string;
  auth?: boolean;
}

// Under jsdom, Request.formData() can't parse multipart bodies (undici's
// parser rejects jsdom's File), so hand the handler a minimal request stub.
// The handler only reads method, headers and formData().
function send({ bytes = 1000, type = 'audio/webm;codecs=opus', durationSeconds = 12, language = 'en', auth = true }: SendOptions = {}) {
  const audio = {
    size: bytes,
    type,
    arrayBuffer: async () => new ArrayBuffer(bytes),
  };
  const fields: Record<string, unknown> = {
    audio,
    durationSeconds: String(durationSeconds),
    language,
  };
  const request = {
    method: 'POST',
    headers: new Headers(auth ? { Authorization: 'Bearer test-user-token' } : {}),
    formData: async () => ({ get: (name: string) => fields[name] ?? null }),
  };
  return handler(request as unknown as Request);
}

function geminiReply(text: string) {
  return Response.json({ id: 'interactions/abc', status: 'completed', output_text: text });
}

function geminiRequestBody() {
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
}

describe('ai-transcribe', () => {
  it('transcribes with gemini-3.5-transcribe in smart mode without storing the interaction', async () => {
    fetchMock.mockResolvedValue(geminiReply('Today I went for a long walk.'));

    const response = await send();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: 'Today I went for a long walk.',
      secondsUsed: 12,
      monthlySecondsUsed: 12,
      monthlyLimitSeconds: 12000,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-google-key');

    const body = geminiRequestBody();
    expect(body.model).toBe('models/gemini-3.5-transcribe');
    expect(body.store).toBe(false);
    expect(body.generation_config.transcription_config).toEqual({ mode: 'smart' });
    expect(body.input[0]).toMatchObject({ type: 'audio', mime_type: 'audio/webm' });
    expect(typeof body.input[0].data).toBe('string');
  });

  it('relies on automatic language detection rather than sending language codes', async () => {
    fetchMock.mockResolvedValue(geminiReply('Hej'));

    await send({ language: 'sv' });

    expect(geminiRequestBody().generation_config.transcription_config.language_codes).toBeUndefined();
  });

  it('records only the billed duration in usage stats', async () => {
    fetchMock.mockResolvedValue(geminiReply('Private journal text'));

    await send({ durationSeconds: 42 });

    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const row = mocks.insert.mock.calls[0][0];
    expect(row).toEqual({
      user_id: 'test-user',
      analysis_type: 'transcription',
      audio_seconds: 42,
      model_used: 'gemini-3.5-transcribe',
    });
    expect(JSON.stringify(row)).not.toContain('Private journal text');
  });

  it('never logs the transcript', async () => {
    fetchMock.mockResolvedValue(geminiReply('Something very private'));

    await send();

    const logged = [console.log, console.warn, console.error]
      .flatMap((fn) => vi.mocked(fn).mock.calls)
      .map((args) => args.join(' '))
      .join('\n');
    expect(logged).not.toContain('Something very private');
  });

  it('bills at least the duration implied by the file size', async () => {
    fetchMock.mockResolvedValue(geminiReply('text'));

    // 160 000 bytes at the 16 000 B/s ceiling is at least 10 s, even if the client claims 1 s.
    const response = await send({ bytes: 160_000, durationSeconds: 1 });

    expect((await response.json()).secondsUsed).toBe(10);
  });

  it('maps Safari audio/mp4 recordings to audio/m4a', async () => {
    fetchMock.mockResolvedValue(geminiReply('text'));

    await send({ type: 'audio/mp4' });

    expect(geminiRequestBody().input[0].mime_type).toBe('audio/m4a');
  });

  it('converts to Traditional Chinese for zh-TW users only', async () => {
    fetchMock.mockImplementation(async () => geminiReply('今天我用软件写了日记'));

    const tw = await send({ language: 'zh-TW' });
    expect((await tw.json()).text).toBe('TW:今天我用软件写了日记');

    const cn = await send({ language: 'zh' });
    expect((await cn.json()).text).toBe('今天我用软件写了日记');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await send({ auth: false });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires Plus', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_pro: false, monthly_transcription_seconds: 0 }], error: null });

    const response = await send();

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enforces the 200-minute monthly limit', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_pro: true, monthly_transcription_seconds: 12000 }], error: null });

    const response = await send();

    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('limitReached');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows the clip that crosses the limit', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_pro: true, monthly_transcription_seconds: 11990 }], error: null });
    fetchMock.mockResolvedValue(geminiReply('text'));

    const response = await send({ durationSeconds: 60 });

    expect(response.status).toBe(200);
  });

  it('rejects recordings over the size limit', async () => {
    const response = await send({ bytes: 10 * 1024 * 1024 + 1 });

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported formats', async () => {
    const response = await send({ type: 'video/mp4' });

    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a retryable 503 and bills nothing when Gemini is unavailable', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { message: 'overloaded' } }, { status: 503 }));

    const response = await send();

    expect(response.status).toBe(503);
    expect((await response.json()).retryable).toBe(true);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('reads the transcript from steps when output_text is absent', async () => {
    fetchMock.mockResolvedValue(Response.json({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: 'From steps.' }] }],
    }));

    const response = await send();

    expect((await response.json()).text).toBe('From steps.');
  });
});
