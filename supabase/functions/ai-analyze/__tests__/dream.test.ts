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
let handler: (request: Request) => Promise<Response>;

const DREAM_TEXT =
  'I was back in my old school, but the corridors kept getting longer and every door opened onto the sea. My sister was calling me from somewhere I could not find.';

function usageSummary(overrides: Record<string, unknown> = {}) {
  return {
    is_pro: true,
    monthly_dream_reflection_count: 0,
    weekly_dream_patterns_count: 0,
    ...overrides,
  };
}

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
  mocks.rpc.mockResolvedValue({ data: [usageSummary()], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  await import('../index');
  handler = mocks.serve.mock.calls[0][0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function post(body: Record<string, unknown>) {
  return handler(new Request('https://test.supabase.co/functions/v1/ai-analyze', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-user-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function reflectBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'analyzeDream',
    language: 'en',
    content: DREAM_TEXT,
    date: '2026-11-19',
    dream: { feelings: ['confusion', 'longing', 'fear'], recurring: true },
    ...overrides,
  };
}

function toolResponse(name: string, args: Record<string, unknown>) {
  return Response.json({
    candidates: [{ content: { parts: [{ functionCall: { name, args } }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 400, thoughtsTokenCount: 250, totalTokenCount: 1550 },
  });
}

const REFLECTION = {
  summary: 'You were in your old school, the corridors stretched out and the doors opened onto the sea.',
  themes: [{ title: 'Searching', note: 'Perhaps something feels out of reach.' }],
  images: [{ image: 'Doors opening onto the sea', possibilities: 'It might point to something vast.' }],
  wakingLinks: ['You wrote about missing your sister this week.'],
  questions: ['What were you hoping to find?'],
  coded: { characters: ['sister'], settings: ['school', 'sea'], emotions: ['confusion'], themes: ['searching'] },
  care: 'none',
};

function promptText() {
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  return {
    system: body.systemInstruction.parts.map((p: any) => p.text).join('\n'),
    user: body.contents.map((c: any) => c.parts.map((p: any) => p.text).join('\n')).join('\n'),
    url: String(fetchMock.mock.calls[0][0]),
    body,
  };
}

describe('analyzeDream', () => {
  it('returns a sanitized reflection and records usage with tokens', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    const response = await post(reflectBody({
      wakingContext: [{ date: '2026-11-18', shortSummary: 'Missed my sister.', topics: ['family'], dominantEmotion: 'sadness', mainStressors: ['deadline'] }],
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.reflection).toMatchObject({
      version: 1,
      summary: REFLECTION.summary,
      wakingLinks: REFLECTION.wakingLinks,
      care: 'none',
      coded: REFLECTION.coded,
    });
    expect(data).toMatchObject({ used: 1, limit: 30 });

    const { url, user, body } = promptText();
    expect(url).toContain('/models/gemini-3.8-flash:generateContent');
    // Room for a long dream in a token-heavy script plus the model's thinking.
    expect(body.generationConfig.maxOutputTokens).toBe(6000);
    // Reflections run often and stay on the model's default.
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(user).toContain(DREAM_TEXT);
    expect(user).toContain('confusion, fear');
    expect(user).not.toContain('longing');
    expect(user).toContain('recurring dream');
    expect(user).toContain('Missed my sister.');
    expect(user).toContain('recorded 2026-11-19)');
    // Only what the consent text lists reaches the prompt.
    expect(user).not.toContain('deadline');

    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'test-user',
      analysis_type: 'dreamReflection',
      input_tokens: 900,
      output_tokens: 400,
      thinking_tokens: 250,
    }));
    // Usage rows carry counters only, never dream content.
    expect(JSON.stringify(mocks.insert.mock.calls[0][0])).not.toContain('school');
  });

  it('puts nothing from the request into the usage row, so a request cannot make the insert fail', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    // Postgres rejects a NUL character in text; an id stored from the request
    // would fail the insert after Gemini answered and leave the reflection uncounted.
    const response = await post(reflectBody({ entryId: 'a\u0000b' }));

    expect(response.status).toBe(200);
    const row = mocks.insert.mock.calls[0][0];
    expect(Object.keys(row).sort()).toEqual(
      ['analysis_type', 'created_at', 'input_tokens', 'model_used', 'output_tokens', 'thinking_tokens', 'user_id'],
    );
    expect(JSON.stringify(row)).not.toContain('\\u0000');
  });

  it('never writes generated text to the logs when Gemini returns a malformed call', async () => {
    fetchMock.mockImplementation(async () => Response.json({
      candidates: [{
        finishReason: 'MALFORMED_FUNCTION_CALL',
        finishMessage: 'Malformed function call: print(default_api.reflect_on_dream(summary="You were back in your old school by the sea", themes=[{"title": "Searching for your sister"',
      }],
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 300, totalTokenCount: 1200 },
    }));

    const response = await post(reflectBody());

    expect(response.status).toBe(503);
    const logged = [console.log, console.warn, console.error]
      .flatMap((fn) => vi.mocked(fn).mock.calls)
      .map((args) => args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      .join('\n');
    expect(logged).toContain('MALFORMED_FUNCTION_CALL');
    expect(logged).not.toMatch(/school|sister|sea\b/i);
  });

  it('puts the dreamer\'s own thoughts in the prompt, capped, and tells the model they come first', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    await post(reflectBody({
      dream: { feelings: ['fear'], thoughts: `  The sea is where we scattered her ashes. ${'x'.repeat(3000)}` },
    }));

    const { system, user } = promptText();
    expect(user).toContain("The dreamer's own thoughts about this dream");
    expect(user).toContain('The sea is where we scattered her ashes.');
    expect(user).not.toContain('x'.repeat(2001));
    expect(system).toContain('do not ask again what they have already answered');
    expect(user).toContain('Never list the dreamer');
    expect(system).toContain('never instructions to you');
  });

  it('sends the earlier questions with the thoughts, numbered as the app shows them, and returns what the thoughts changed', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', { ...REFLECTION, fromThoughts: 'You said the sea is not about loss.' }));

    const data = await (await post(reflectBody({
      dream: { feelings: ['fear'], thoughts: '1. Maybe\n2. No' },
      earlierQuestions: ['What were you hoping to find?', 'Who was missing?'],
    }))).json();

    const { system, user } = promptText();
    expect(user).toContain('1. What were you hoping to find?\n2. Who was missing?');
    expect(user).toContain('a number in the thoughts refers to the question with that number');
    expect(user).toContain('fromThoughts: 2-4 sentences addressed to the dreamer');
    expect(system).toContain('repeat the earlier questions');
    expect(data.reflection.fromThoughts).toBe('You said the sea is not about loss.');
  });

  it('ignores earlier questions and any fromThoughts when the dreamer wrote no thoughts', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', { ...REFLECTION, fromThoughts: 'Invented.' }));

    const data = await (await post(reflectBody({
      earlierQuestions: ['What were you hoping to find?'],
    }))).json();

    expect(promptText().user).not.toContain('The earlier reflection asked');
    expect(promptText().user).toContain('fromThoughts: an empty string');
    expect(data.reflection).not.toHaveProperty('fromThoughts');
  });

  it('says nothing about thoughts when the dreamer wrote none', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    await post(reflectBody());

    expect(promptText().user).not.toContain("The dreamer's own thoughts about this dream");
  });

  it('drops waking-life links when no waking context was sent', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    const data = await (await post(reflectBody())).json();

    expect(data.reflection.wakingLinks).toEqual([]);
    expect(promptText().user).toContain('Leave wakingLinks empty');
  });

  it('passes the distress care flag through', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', { ...REFLECTION, care: 'distress' }));

    const data = await (await post(reflectBody())).json();

    expect(data.reflection.care).toBe('distress');
  });

  it('keeps the method and safety rules in the system prompt', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    await post(reflectBody());

    const { system } = promptText();
    expect(system).toContain('There is no fixed dictionary of dream symbols');
    expect(system).toContain('Do not give medical or mental-health advice');
    expect(system).toContain('same language as the dream text');
  });

  it('refuses at the monthly limit without calling Gemini', async () => {
    mocks.rpc.mockResolvedValue({ data: [usageSummary({ monthly_dream_reflection_count: 30 })], error: null });

    const response = await post(reflectBody());

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ limitReached: true, limit: 30, current: 30 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('refuses when the usage counter is missing instead of running without a limit', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_pro: true }], error: null });

    const response = await post(reflectBody());

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires Plus', async () => {
    mocks.rpc.mockResolvedValue({ data: [usageSummary({ is_pro: false })], error: null });

    const response = await post(reflectBody());

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects dreams over the word cap', async () => {
    const response = await post(reflectBody({ content: Array(1501).fill('wave').join(' ') }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ tooLong: true, limit: 1500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps languages written without spaces by characters', async () => {
    const response = await post(reflectBody({ content: '夢'.repeat(8001) }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ tooLong: true, characterLimit: 8000 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects dreams that are too short', async () => {
    const response = await post(reflectBody({ content: 'Falling.' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ tooShort: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never puts a time of day in the prompt', async () => {
    fetchMock.mockResolvedValue(toolResponse('reflect_on_dream', REFLECTION));

    await post(reflectBody({ date: '2026-11-19T06:30:00.000Z' }));

    expect(promptText().user).toContain('recorded 2026-11-19)');
    expect(promptText().user).not.toContain('06:30');
  });

  it('rejects a request without a date', async () => {
    const response = await post(reflectBody({ date: 'yesterday' }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not retry a dream the provider refuses for its content, and says so', async () => {
    fetchMock.mockResolvedValue(Response.json({
      candidates: [{ finishReason: 'SAFETY' }],
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 0, totalTokenCount: 900 },
    }));

    const response = await post(reflectBody());

    expect(response.status).toBe(422);
    expect((await response.json()).blocked).toBe(true);
    // The same content would be refused again.
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      analysis_type: 'dreamReflectionFailed',
      input_tokens: 900,
    }));
  });

  it('treats a blocked prompt the same way', async () => {
    fetchMock.mockResolvedValue(Response.json({
      promptFeedback: { blockReason: 'PROHIBITED_CONTENT' },
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 0, totalTokenCount: 900 },
    }));

    const response = await post(reflectBody());

    expect(response.status).toBe(422);
    expect((await response.json()).blocked).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      analysis_type: 'dreamReflectionFailed',
      input_tokens: 900,
    }));
  });

  it('records a failed row when Gemini errors on the retry after a first billed answer', async () => {
    fetchMock
      .mockResolvedValueOnce(toolResponse('reflect_on_dream', { summary: '' }))
      .mockResolvedValueOnce(Response.json({ error: { message: 'Internal' } }, { status: 500 }));

    const response = await post(reflectBody());

    expect(response.status).toBe(500);
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      analysis_type: 'dreamReflectionFailed',
      input_tokens: 900,
      output_tokens: 400,
    }));
  });

  it('retries once on unusable output, then records a failed row that does not count as a reflection', async () => {
    const unusable = () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: 'Sorry.' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 10, thoughtsTokenCount: 50, totalTokenCount: 960 },
      });
    fetchMock.mockResolvedValueOnce(unusable()).mockResolvedValueOnce(unusable());

    const response = await post(reflectBody());

    expect(response.status).toBe(503);
    // Not retryable: the client must not double the two Gemini calls made here.
    expect((await response.json()).retryable).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledOnce();
    // Both attempts are counted in the tokens.
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      analysis_type: 'dreamReflectionFailed',
      input_tokens: 1800,
      output_tokens: 20,
      thinking_tokens: 100,
    }));
  });

  it('adds up the tokens of both attempts when the retry succeeds', async () => {
    const unusable = Response.json({
      candidates: [{ content: { parts: [{ text: 'Sorry.' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 10, thoughtsTokenCount: 50, totalTokenCount: 960 },
    });
    fetchMock.mockResolvedValueOnce(unusable).mockResolvedValueOnce(toolResponse('reflect_on_dream', REFLECTION));

    const response = await post(reflectBody());

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      analysis_type: 'dreamReflection',
      input_tokens: 1800,
      output_tokens: 410,
      thinking_tokens: 300,
    }));
  });

  it('stops calling Gemini once the monthly cap on failed requests is reached', async () => {
    mocks.rpc.mockResolvedValue({ data: [usageSummary({ monthly_dream_failed_count: 20 })], error: null });

    const response = await post(reflectBody());

    expect(response.status).toBe(429);
    const data = await response.json();
    // Not the reflection limit: the app shows its own "paused this month" message.
    expect(data.limitReached).toBeUndefined();
    expect(data.failedLimitReached).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps Gemini rate limits to 429', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { message: 'Quota' } }, { status: 429 }));

    const response = await post(reflectBody());

    expect(response.status).toBe(429);
    // A rate-limited request produced no tokens and costs nothing.
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('analyzeDreamPatterns', () => {
  const coded = { characters: ['sister'], settings: ['school'], emotions: ['fear'], themes: ['searching'] };
  const dreams = (n: number) =>
    Array.from({ length: n }, () => ({ coded }));

  const PATTERNS = {
    overview: 'Searching appears in most of your dreams.',
    recurring: [{ kind: 'setting', label: 'school', count: 5, note: 'Often the place where things happen.' }],
    changes: [],
    wakingLinks: [],
    questions: ['Where else do you feel you are searching?'],
  };

  it('needs at least five reflected dreams', async () => {
    const response = await post({ type: 'analyzeDreamPatterns', language: 'en', dreams: dreams(4) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ notEnoughDreams: true, needed: 5 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds the report from coded records only and records usage', async () => {
    fetchMock.mockResolvedValue(toolResponse('find_dream_patterns', PATTERNS));

    const response = await post({ type: 'analyzeDreamPatterns', language: 'ja', dreams: dreams(5) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report).toMatchObject({ overview: PATTERNS.overview, dreamCount: 5, recurring: PATTERNS.recurring });
    expect(data).toMatchObject({ used: 1, limit: 1 });
    const { system, user, body } = promptText();
    expect(body.generationConfig.maxOutputTokens).toBe(16000);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' });
    expect(system).toContain('Japanese');
    expect(system).toContain('early, tentative themes');
    // The dreamer is in almost every dream; listing them says nothing.
    expect(system + user).toContain('Never report the dreamer themselves');
    expect(user).toContain('settings: school');
    expect(user).not.toMatch(/2026|chosen feelings|nightmare/);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ analysis_type: 'dreamPatterns' }));
  });

  it('never compares with the journal, even when journal data is sent', async () => {
    fetchMock.mockResolvedValue(toolResponse('find_dream_patterns', { ...PATTERNS, wakingLife: { shared: [{ label: 'work', note: 'n' }] } }));

    const response = await post({
      type: 'analyzeDreamPatterns', language: 'en', dreams: dreams(6),
      waking: { entryCount: 9, topics: [{ label: 'work', count: 6 }], emotions: [] },
    });

    expect((await response.json()).report).not.toHaveProperty('waking');
    const { system, user, body } = promptText();
    expect(user).not.toContain('work (6)');
    expect(system).toContain("nothing from the dreamer's other journal entries");
    expect(JSON.stringify(body.tools)).not.toContain('wakingLife');
  });

  it('refuses at the monthly limit', async () => {
    mocks.rpc.mockResolvedValue({ data: [usageSummary({ weekly_dream_patterns_count: 1 })], error: null });

    const response = await post({ type: 'analyzeDreamPatterns', language: 'en', dreams: dreams(6) });

    expect(response.status).toBe(429);
    const limited = await response.json();
    expect(limited).toMatchObject({ limitReached: true, limit: 1, current: 1 });
    expect(limited.error).toContain('weekly limit');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records unusable report output as a failed row that does not count as a report', async () => {
    fetchMock.mockImplementation(async () => toolResponse('find_dream_patterns', { overview: '' }));

    const response = await post({ type: 'analyzeDreamPatterns', language: 'en', dreams: dreams(6) });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      analysis_type: 'dreamPatternsFailed',
      input_tokens: 1800,
    }));
  });

  it('stops calling Gemini once the monthly cap on failed requests is reached', async () => {
    mocks.rpc.mockResolvedValue({ data: [usageSummary({ monthly_dream_failed_count: 20 })], error: null });

    const response = await post({ type: 'analyzeDreamPatterns', language: 'en', dreams: dreams(6) });

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.limitReached).toBeUndefined();
    expect(data.failedLimitReached).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('analyzeTrends with dreams', () => {
  const coded = { characters: ['sister'], settings: ['school'], emotions: ['fear'], themes: ['searching'] };
  const trendDreams = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-11-0${i + 1}`,
      coded,
      ...(i === 0 ? { nightmare: true } : {}),
      // Never accepted: the client sends no text.
      body: 'Secret dream text',
    }));
  const trendBody = (extra: Record<string, unknown> = {}) => ({
    type: 'analyzeTrends',
    language: 'en',
    period: { start: '2026-10-22T00:00:00.000Z', end: '2026-11-21T00:00:00.000Z' },
    aggregates: {
      entryCount: 8, avgSentiment: 0.1,
      topEmotions: [{ emotion: 'tired', count: 4 }], topTopics: [{ topic: 'work', count: 5 }],
      timeOfDayDistribution: { morning: 8 }, lengthDistribution: { short: 8 },
    },
    entryMetadata: Array.from({ length: 8 }, (_, i) => ({
      date: `2026-11-0${i + 1}`, sentimentScore: -0.2, dominantEmotion: 'tired', topics: ['work'], timeOfDay: 'morning',
    })),
    ...extra,
  });
  const TREND = {
    periodSummary: 'A busy month.',
    moodTrend: 'Steady, with a dip.',
    insights: ['Work weighs on you.'],
    focusAreas: ['Rest'],
    closingReflection: 'You kept showing up.',
  };
  const textResponse = (value: Record<string, unknown>) =>
    Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 800, thoughtsTokenCount: 100, totalTokenCount: 2900 },
    });

  it('runs on Flash and dates each entry', async () => {
    fetchMock.mockResolvedValue(textResponse(TREND));

    const response = await post(trendBody());

    expect(response.status).toBe(200);
    const { user, url, body } = promptText();
    expect(url).toContain('/models/gemini-3.8-flash:generateContent');
    expect(body.generationConfig.maxOutputTokens).toBe(16000);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' });
    expect(user).toContain('1. 2026-11-01, Sentiment: -0.20');
    // Observations about the user's life are offered, not stated as fact.
    expect(user).toContain("OFFER, DON'T STATE");
    expect(user).toContain('「〜ように見えます」');
    expect(user).not.toContain('Dreams the user recorded');
    expect(user).not.toContain('dreamInsights');
  });

  it('sets the dreams beside the journal by date, from labels only, and returns what it found', async () => {
    fetchMock.mockResolvedValue(textResponse({ ...TREND, dreamInsights: ['a', 'b', 'c', 'd', 'e'] }));

    const response = await post(trendBody({ dreams: trendDreams(3) }));

    const data = await response.json();
    expect(data.dreamInsights).toEqual(['a', 'b', 'c', 'd']);
    expect(data.dreamCount).toBe(3);
    const { user } = promptText();
    expect(user).toContain('Dreams the user recorded in this period (3, oldest first)');
    expect(user).toContain('2026-11-01 (nightmare): characters: sister | settings: school');
    expect(user).toContain('a nightmare is not a bad day');
    expect(user).toContain('"dreamInsights"');
    expect(user).not.toContain('Secret dream text');
  });

  it('leaves dreams out with fewer than three, whatever the model returns', async () => {
    fetchMock.mockResolvedValue(textResponse({ ...TREND, dreamInsights: ['invented'] }));

    const response = await post(trendBody({ dreams: trendDreams(2) }));

    const data = await response.json();
    expect(data).not.toHaveProperty('dreamInsights');
    expect(data).not.toHaveProperty('dreamCount');
    expect(promptText().user).not.toContain('Dreams the user recorded');
  });
});
