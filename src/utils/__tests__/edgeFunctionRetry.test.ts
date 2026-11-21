import { describe, expect, it, vi } from 'vitest';
import { invokeWithRetry } from '../edgeFunctionRetry';

// supabase-js hands back the failed Response as `error.context`; its body can
// be read only once.
const failure = (status: number, body: Record<string, unknown>) => ({
  data: null,
  error: { context: new Response(JSON.stringify(body), { status }) },
});

const client = (...results: unknown[]) => {
  const invoke = vi.fn();
  results.forEach((result) => invoke.mockResolvedValueOnce(result));
  return { supabase: { functions: { invoke } } as never, invoke };
};

describe('invokeWithRetry', () => {
  it('leaves the error body readable, so the caller can tell a monthly limit from a plain failure', async () => {
    const { supabase, invoke } = client(failure(429, { limitReached: true }));

    const { error } = await invokeWithRetry(supabase, 'ai-analyze', { body: {} });

    expect(invoke).toHaveBeenCalledOnce();
    const context = (error as { context: Response }).context;
    expect(await context.json()).toEqual({ limitReached: true });
  });

  it('retries a 503 marked retryable once and returns the second result', async () => {
    vi.useFakeTimers();
    const { supabase, invoke } = client(failure(503, { retryable: true }), { data: { ok: true }, error: null });

    const pending = invokeWithRetry(supabase, 'ai-analyze', { body: {} });
    await vi.runAllTimersAsync();

    expect(await pending).toEqual({ data: { ok: true }, error: null });
    expect(invoke).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry a 503 that is not marked retryable', async () => {
    const { supabase, invoke } = client(failure(503, { error: 'invalid response' }));

    const { error } = await invokeWithRetry(supabase, 'ai-analyze', { body: {} });

    expect(invoke).toHaveBeenCalledOnce();
    expect(await (error as { context: Response }).context.json()).toEqual({ error: 'invalid response' });
  });
});
