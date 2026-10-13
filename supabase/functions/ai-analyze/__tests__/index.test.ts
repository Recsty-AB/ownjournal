import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  serve: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: mocks.serve }));
vi.mock('https://esm.sh/@supabase/supabase-js@2.49.1', () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: () => ({ insert: mocks.insert }),
  }),
}));

const fetchMock = vi.fn<typeof fetch>();
const envGet = vi.fn();
let handler: (request: Request) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  fetchMock.mockReset();
  envGet.mockImplementation((name: string) => ({
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GOOGLE_API_KEY: 'test-google-key',
    // Old deployments may leave these secrets behind. They must have no effect.
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'unused-openai-key',
    ENABLE_AI_RETRY: 'true',
  })[name]);
  vi.stubGlobal('Deno', { env: { get: envGet } });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ is_pro: true, monthly_title_count: 0 }], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  await import('../index');
  handler = mocks.serve.mock.calls[0][0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function requestTitles() {
  return handler(new Request('https://test.supabase.co/functions/v1/ai-analyze', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-user-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'title', language: 'en', content: 'I enjoyed a walk with a friend today.' }),
  }));
}

function titleResponse() {
  return Response.json({
    candidates: [{
      content: { parts: [{ functionCall: { name: 'generate_titles', args: { titles: ['A Walk Together'] } } }] },
      finishReason: 'STOP',
    }],
  });
}

describe('Gemini-only analysis', () => {
  it('uses Gemini even when obsolete OpenAI configuration is present', async () => {
    fetchMock.mockResolvedValue(titleResponse());

    const response = await requestTitles();

    expect(response.status).toBe(200);
    expect((await response.json()).suggestedTitles).toContain('A Walk Together');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).hostname).toBe('generativelanguage.googleapis.com');
    expect(envGet).not.toHaveBeenCalledWith('AI_PROVIDER');
    expect(envGet).not.toHaveBeenCalledWith('OPENAI_API_KEY');
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it.each([429, 403, 503])('returns Google HTTP %s errors without sending the entry to another provider', async (status) => {
    fetchMock.mockResolvedValue(Response.json({ error: { message: 'Provider unavailable' } }, { status }));

    const response = await requestTitles();

    expect(response.status).toBe(status === 503 ? 500 : status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).hostname).toBe('generativelanguage.googleapis.com');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('keeps invalid-output retries within Gemini and preserves title parsing', async () => {
    const invalidResponse = () => Response.json({
      candidates: [{ content: { parts: [{ text: 'Unable to produce titles' }] }, finishReason: 'STOP' }],
    });
    fetchMock
      .mockResolvedValueOnce(invalidResponse())
      .mockResolvedValueOnce(invalidResponse())
      .mockResolvedValueOnce(titleResponse());

    const response = await requestTitles();

    expect(response.status).toBe(200);
    expect((await response.json()).suggestedTitles).toContain('A Walk Together');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.every(url => url.hostname === 'generativelanguage.googleapis.com')).toBe(true);
    expect(urls.map(url => url.pathname)).toEqual([
      '/v1beta/models/gemini-3.5-flash-lite:generateContent',
      '/v1beta/models/gemini-3.5-flash-lite:generateContent',
      '/v1beta/models/gemini-3.1-pro-preview:generateContent',
    ]);
  });
});
