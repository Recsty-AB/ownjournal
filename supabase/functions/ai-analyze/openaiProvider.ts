/**
 * OpenAI Provider for direct OpenAI API calls
 * 
 * This module calls the OpenAI API directly and returns
 * OpenAI-compatible responses (which the codebase already expects).
 * 
 * Usage: Set AI_PROVIDER=openai environment variable to use as primary
 */

/**
 * Maps Google model names to OpenAI equivalents
 */
function mapToOpenAIModel(googleModel: string): string {
  const modelName = googleModel.startsWith("google/")
    ? googleModel.substring(7)
    : googleModel;

  const modelMap: Record<string, string> = {
    "gemini-2.5-flash": "gpt-5.4-nano",
    "gemini-3-flash-preview": "gpt-5.4-mini",
    "gemini-3.1-pro-preview": "gpt-5.4",
    "gemini-2.5-pro": "gpt-5.4",
    "gemini-2.5-flash-preview": "gpt-5.4-nano",
    "gemini-2.5-pro-preview": "gpt-5.4",
  };

  return modelMap[modelName] || "gpt-5.4-nano";
}

/** Options for OpenAI requests (e.g. reasoning effort for faster title/tag generation). */
export type OpenAIRequestOptions = {
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
};

/**
 * Call OpenAI API directly with OpenAI-compatible parameters
 * Returns the response as-is since the codebase already uses OpenAI format
 */
export async function callOpenAI(
  model: string,
  messages: any[],
  tools?: any[],
  toolChoice?: any,
  maxTokens?: number,
  options?: OpenAIRequestOptions
): Promise<any> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  if (OPENAI_API_KEY.toLowerCase() === "google" || OPENAI_API_KEY === Deno.env.get("GOOGLE_API_KEY")) {
    throw new Error("OPENAI_API_KEY appears to be set to the Google key; set it to your OpenAI API key from https://platform.openai.com/account/api-keys");
  }

  const openaiModel = mapToOpenAIModel(model);

  const requestBody: any = {
    model: openaiModel,
    messages,
    max_completion_tokens: maxTokens,
  };

  if (tools) {
    requestBody.tools = tools;
  }
  if (toolChoice) {
    requestBody.tool_choice = toolChoice;
  }
  if (options?.reasoningEffort) {
    requestBody.reasoning = { effort: options.reasoningEffort };
  }

  console.log(`[OPENAI] Calling model: ${openaiModel} (mapped from ${model})`, {
    messageCount: messages.length,
    hasTools: !!tools,
    maxTokens,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OPENAI] API error:", response.status, errorText);

    if (response.status === 429) {
      throw new Error("OPENAI_RATE_LIMIT");
    }
    if (response.status === 402 || response.status === 403) {
      throw new Error("OPENAI_AUTH_ERROR");
    }
    if (response.status >= 500) {
      throw new Error(`OPENAI_SERVER_ERROR: ${response.status} - ${errorText}`);
    }
    if (response.status === 408) {
      throw new Error("OPENAI_TIMEOUT");
    }

    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  console.log("[OPENAI] Response received", {
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  });

  return data;
}

/**
 * Utility function to check if OpenAI provider is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!Deno.env.get("OPENAI_API_KEY");
}
