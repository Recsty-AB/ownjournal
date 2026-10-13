import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callGoogleAI } from '../googleAIProvider';
import { getModelForType } from '../modelConfig';

const messages = [
  { role: 'system' as const, content: 'Return journal metadata in the entry language.' },
  { role: 'user' as const, content: 'I enjoyed a walk with a friend today.' },
];

const tools = [{
  type: 'function' as const,
  function: {
    name: 'generate_titles',
    description: 'Generate titles for a journal entry',
    parameters: {
      type: 'object',
      properties: { titles: { type: 'array', items: { type: 'string' } } },
      required: ['titles'],
      additionalProperties: false,
    },
  },
}];
const toolChoice = { type: 'function' as const, function: { name: 'generate_titles' } };

const routes = [
  { type: 'title', google: 'gemini-3.5-flash-lite', thinking: 'MINIMAL', maxTokens: 2000 },
  { type: 'tags', google: 'gemini-3.5-flash-lite', thinking: 'MINIMAL', maxTokens: 2000 },
  { type: 'analyzeEntry', google: 'gemini-3.8-flash', thinking: 'LOW', maxTokens: 2000 },
  { type: 'analyzeTrends', google: 'gemini-3.1-pro-preview', thinking: 'HIGH', maxTokens: 4000 },
  { type: 'analyze', google: 'gemini-3.8-flash', thinking: 'LOW', maxTokens: 2000 },
];

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => ({
        GOOGLE_API_KEY: 'test-google-key',
      })[name],
    },
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), body: JSON.parse(String(init?.body)) };
}

describe('Google request compatibility', () => {
  it.each(routes)('uses a supported model and thinking level for $type', async ({ type, google, thinking, maxTokens }) => {
    fetchMock.mockResolvedValue(Response.json({
      candidates: [{ content: { parts: [{ text: '{"summary":"A pleasant walk."}' }] }, finishReason: 'STOP' }],
    }));

    const response = await callGoogleAI(getModelForType(type), messages, undefined, undefined, maxTokens);
    const { url, body } = lastRequest();

    expect(new URL(url).pathname).toBe(`/v1beta/models/${google}:generateContent`);
    expect(body.systemInstruction).toEqual({ parts: [{ text: messages[0].content }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: messages[1].content }] }]);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingLevel: thinking },
    });
    // Check the serialized payload, including nested fields, against Google's
    // deprecation notice. Neither the SDK nor REST spellings may leak through.
    expect(JSON.stringify(body)).not.toMatch(/"(?:thinking_budget|thinkingBudget|temperature|top_p|topP|top_k|topK|candidate_count|candidateCount)":/);
    expect(response.choices[0].message.content).toBe('{"summary":"A pleasant walk."}');
  });

  it('preserves forced tool calls and parses responses containing pre-tool text', async () => {
    fetchMock.mockResolvedValue(Response.json({
      candidates: [{
        content: {
          parts: [
            { text: 'Here are the titles.' },
            { functionCall: { name: 'generate_titles', args: { titles: ['A Walk Together'] } } },
          ],
        },
        finishReason: 'STOP',
      }],
    }));

    const response = await callGoogleAI(getModelForType('title'), messages, tools, toolChoice);
    const { body } = lastRequest();

    expect(body.toolConfig).toEqual({
      functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['generate_titles'] },
    });
    expect(body.tools[0].functionDeclarations[0].name).toBe('generate_titles');
    expect(body.tools[0].functionDeclarations[0].parameters).not.toHaveProperty('additionalProperties');
    expect(response.choices[0].message.tool_calls?.[0].function).toEqual({
      name: 'generate_titles',
      arguments: '{"titles":["A Walk Together"]}',
    });
  });

  it('leaves thinking at the provider default for models without a configured level', async () => {
    fetchMock.mockResolvedValue(Response.json({ candidates: [] }));

    await callGoogleAI('custom-model', messages);

    expect(lastRequest().body.generationConfig).toEqual({ maxOutputTokens: 2000 });
  });
});
