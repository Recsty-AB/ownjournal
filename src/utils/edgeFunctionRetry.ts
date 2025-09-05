/**
 * Client-side retry wrapper for Supabase Edge Function calls.
 * Retries once with a 2s delay when the function returns 503 with retryable: true.
 * Does not retry 4xx errors (rate limits, auth, etc.).
 */

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 1;

export interface EdgeFunctionInvokeOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

type InvokeFn = <T = unknown>(name: string, options: EdgeFunctionInvokeOptions) => Promise<{ data: T | null; error: unknown }>;

/**
 * Invoke a Supabase Edge Function with one retry on 503 retryable errors.
 * Returns the same { data, error } shape as supabase.functions.invoke().
 * On final failure, the error object is unchanged so callers can still use error.context?.json() for the response body.
 *
 * @param supabase - Supabase client (or any object with functions.invoke)
 * @param name - Edge function name (e.g. 'ai-analyze')
 * @param options - Same options as supabase.functions.invoke (body, headers)
 */
export async function invokeWithRetry<T = unknown>(
  supabase: { functions: { invoke: InvokeFn } },
  name: string,
  options: EdgeFunctionInvokeOptions
): Promise<{ data: T | null; error: unknown }> {
  let result = await supabase.functions.invoke<T>(name, options);
  if (!result.error) return result;

  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    const status = (result.error as { context?: { status?: number } })?.context?.status;
    let body: { retryable?: boolean } | null = null;
    try {
      const ctx = (result.error as { context?: { json?: () => Promise<unknown> } })?.context;
      if (typeof ctx?.json === "function") {
        body = (await ctx.json()) as { retryable?: boolean };
      }
    } catch {
      // ignore parse failure
    }

    const isRetryable503 = status === 503 && body?.retryable === true;
    if (!isRetryable503) return result;

    if (import.meta.env.DEV) {
      console.log(`[edgeFunctionRetry] 503 retryable for ${name}, retrying in ${RETRY_DELAY_MS}ms`);
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    result = await supabase.functions.invoke<T>(name, options);
    attempts++;
  }

  return result;
}
