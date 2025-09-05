/**
 * Google AI Provider for direct Generative Language API calls
 * 
 * This module converts OpenAI-compatible requests to Google's native
 * Generative Language API format and converts responses back.
 * 
 * Usage: Set AI_PROVIDER=google environment variable to enable (default)
 */

// Types for OpenAI-compatible format (used by existing code)
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

// Types for Google API format
interface GooglePart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

interface GoogleContent {
  role: "user" | "model";
  parts: GooglePart[];
}

interface GoogleFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface GoogleTool {
  functionDeclarations: GoogleFunctionDeclaration[];
}

interface GoogleToolConfig {
  functionCallingConfig: {
    mode: "AUTO" | "ANY" | "NONE";
    allowedFunctionNames?: string[];
  };
}

interface GoogleRequest {
  contents: GoogleContent[];
  systemInstruction?: { parts: GooglePart[] };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
  tools?: GoogleTool[];
  toolConfig?: GoogleToolConfig;
}

interface GoogleResponse {
  candidates?: Array<{
    content: {
      parts: GooglePart[];
      role: string;
    };
    finishReason?: string;
    finishMessage?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// OpenAI-compatible response format (what existing code expects)
interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Maps gateway model names to Google API model names
 */
function mapModelName(model: string): string {
  // Strip the "google/" prefix if present
  const modelName = model.startsWith("google/")
    ? model.substring(7)
    : model;
  
  // Direct mapping - Google API uses the same names without prefix
  const modelMap: Record<string, string> = {
    "gemini-3-flash-preview": "gemini-3-flash-preview",
    "gemini-3.1-pro-preview": "gemini-3.1-pro-preview",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-flash-preview": "gemini-2.5-flash-preview",
    "gemini-2.5-pro-preview": "gemini-2.5-pro-preview",
  };
  
  return modelMap[modelName] || modelName;
}

/**
 * Converts OpenAI-style messages to Google's native format
 */
function convertMessagesToGoogleFormat(messages: OpenAIMessage[]): {
  contents: GoogleContent[];
  systemInstruction?: { parts: GooglePart[] };
} {
  let systemInstruction: { parts: GooglePart[] } | undefined;
  const contents: GoogleContent[] = [];
  
  for (const message of messages) {
    if (message.role === "system") {
      // Google uses systemInstruction for system prompts
      systemInstruction = {
        parts: [{ text: message.content }]
      };
    } else if (message.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: message.content }]
      });
    } else if (message.role === "assistant") {
      contents.push({
        role: "model",
        parts: [{ text: message.content }]
      });
    }
  }
  
  return { contents, systemInstruction };
}

/**
 * Recursively removes OpenAI-specific fields from a schema object
 * Google's Generative Language API doesn't support these fields
 */
function sanitizeParametersForGoogle(params: Record<string, unknown>): Record<string, unknown> {
  // Fields that Google's API doesn't support
  const unsupportedFields = [
    "additionalProperties",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "pattern",
    "format",
    "strict"
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Skip unsupported fields
    if (unsupportedFields.includes(key)) {
      continue;
    }
    
    // Recursively clean nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeParametersForGoogle(value as Record<string, unknown>);
    } 
    // Handle arrays (e.g., items in array schemas)
    else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        item && typeof item === "object" 
          ? sanitizeParametersForGoogle(item as Record<string, unknown>)
          : item
      );
    } 
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Converts OpenAI-style tools to Google's function declarations format
 */
function convertToolsToGoogleFormat(tools?: OpenAITool[]): GoogleTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  
  const functionDeclarations: GoogleFunctionDeclaration[] = tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    // Sanitize parameters to remove Google-incompatible fields
    parameters: sanitizeParametersForGoogle(tool.function.parameters)
  }));
  
  return [{ functionDeclarations }];
}

/**
 * Converts OpenAI tool_choice to Google toolConfig format
 */
function convertToolChoiceToGoogleFormat(
  toolChoice?: OpenAIToolChoice,
  tools?: OpenAITool[]
): GoogleToolConfig | undefined {
  if (!toolChoice || !tools) return undefined;
  
  // When a specific function is requested, use ANY mode with allowed function names
  return {
    functionCallingConfig: {
      mode: "ANY",
      allowedFunctionNames: [toolChoice.function.name]
    }
  };
}

/**
 * Parses Google's response format back to OpenAI-compatible structure
 */
function parseGoogleResponse(response: GoogleResponse, hasToolCalls: boolean): OpenAIResponse {
  const candidate = response.candidates?.[0];
  
  if (!candidate) {
    // Handle error or empty response
    return {
      choices: [{
        message: {
          role: "assistant",
          content: response.error?.message || "No response from AI"
        },
        finish_reason: "error"
      }]
    };
  }
  
  // Check if content exists - Google may return candidate without content
  if (!candidate.content || !candidate.content.parts) {
    console.error("[GOOGLE_AI] Response has no content.parts:", JSON.stringify(candidate));
    
    // Try to recover from MALFORMED_FUNCTION_CALL - Google sometimes wraps function calls in Python syntax
    if (candidate.finishReason === "MALFORMED_FUNCTION_CALL" && candidate.finishMessage) {
      console.log("[GOOGLE_AI] Attempting to recover from MALFORMED_FUNCTION_CALL");
      
      // Extract function name and arguments from Python-style call
      // Format: "Malformed function call: print(default_api.generate_tag_sets(tagSets=[[...]]))"
      const match = candidate.finishMessage.match(/(\w+)\s*=\s*(\[[\s\S]*)/);
      
      if (match) {
        const [, argName, rawArgValue] = match;
        
        // Strip trailing parentheses from Python-style function call wrapping
        // e.g. "generate_tag_sets(tagSets=[[...]]))" leaves trailing )
        const argValue = rawArgValue.replace(/\)+\s*$/, '');
        
        // Try to parse the truncated JSON array - it may be incomplete
        let parsedValue;
        try {
          // Try direct parse first
          parsedValue = JSON.parse(argValue);
        } catch {
          // If incomplete, try to fix by closing brackets
          let fixedJson = argValue;
          // Count unclosed brackets
          const openBrackets = (fixedJson.match(/\[/g) || []).length;
          const closeBrackets = (fixedJson.match(/\]/g) || []).length;
          const missing = openBrackets - closeBrackets;
          
          // Close any unclosed array brackets
          for (let i = 0; i < missing; i++) {
            // Remove trailing incomplete element and close
            fixedJson = fixedJson.replace(/,\s*\["[^"]*$/, '');
            fixedJson = fixedJson.replace(/,\s*"[^"]*$/, '');
            fixedJson += ']';
          }
          
          try {
            parsedValue = JSON.parse(fixedJson);
            console.log("[GOOGLE_AI] Successfully recovered truncated JSON");
          } catch (e) {
            console.error("[GOOGLE_AI] Failed to recover malformed function call:", e);
          }
        }
        
        if (parsedValue) {
          // Determine function name from the finishMessage
          const funcNameMatch = candidate.finishMessage.match(/\.(\w+)\(/);
          const functionName = funcNameMatch ? funcNameMatch[1] : "unknown";
          
          console.log("[GOOGLE_AI] Recovered function call:", {
            name: functionName,
            argName,
            valueLength: Array.isArray(parsedValue) ? parsedValue.length : 'N/A'
          });
          
          return {
            choices: [{
              message: {
                role: "assistant",
                content: null,
                tool_calls: [{
                  id: `call_recovered_${Date.now()}`,
                  type: "function",
                  function: {
                    name: functionName,
                    arguments: JSON.stringify({ [argName]: parsedValue })
                  }
                }]
              },
              finish_reason: "tool_calls"
            }]
          };
        }
      }
    }
    
    // Original fallback
    return {
      choices: [{
        message: {
          role: "assistant",
          content: "AI response was empty or blocked"
        },
        finish_reason: candidate.finishReason || "error"
      }]
    };
  }
  
  const parts = candidate.content.parts;
  let content: string | null = null;
  let toolCalls: OpenAIResponse["choices"][0]["message"]["tool_calls"] | undefined;
  
  for (const part of parts) {
    if (part.text) {
      content = (content || "") + part.text;
    }
    if (part.functionCall) {
      if (!toolCalls) toolCalls = [];
      
      // Safely handle args - might be undefined or null for complex schemas
      const args = part.functionCall.args || {};
      
      toolCalls.push({
        id: `call_${Date.now()}_${toolCalls.length}`,
        type: "function",
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(args)
        }
      });
    }
  }
  
  return {
    choices: [{
      message: {
        role: "assistant",
        content: content,
        tool_calls: toolCalls
      },
      finish_reason: candidate.finishReason || "stop"
    }],
    usage: response.usageMetadata ? {
      prompt_tokens: response.usageMetadata.promptTokenCount,
      completion_tokens: response.usageMetadata.candidatesTokenCount,
      total_tokens: response.usageMetadata.totalTokenCount
    } : undefined
  };
}

/**
 * Main entry point: Call Google AI with OpenAI-compatible parameters
 * Returns an OpenAI-compatible response
 */
export async function callGoogleAI(
  model: string,
  messages: OpenAIMessage[],
  tools?: OpenAITool[],
  toolChoice?: OpenAIToolChoice,
  maxTokens?: number
): Promise<OpenAIResponse> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY not configured. Set AI_PROVIDER=openai to use OpenAI instead.");
  }
  
  const googleModel = mapModelName(model);
  const { contents, systemInstruction } = convertMessagesToGoogleFormat(messages);
  const googleTools = convertToolsToGoogleFormat(tools);
  const googleToolConfig = convertToolChoiceToGoogleFormat(toolChoice, tools);
  
  const requestBody: GoogleRequest = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens || 2000
    }
  };
  
  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }
  
  // Use function calling when tools are provided
  if (googleTools) {
    requestBody.tools = googleTools;
  }
  if (googleToolConfig) {
    requestBody.toolConfig = googleToolConfig;
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    
    // Map Google error codes to OpenAI-compatible format for consistent handling
    if (response.status === 429) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    if (response.status === 400) {
      throw new Error(`INVALID_REQUEST: ${errorText}`);
    }
    if (response.status === 403) {
      throw new Error("API_KEY_INVALID");
    }
    
    throw new Error(`Google AI API error: ${response.status} - ${errorText}`);
  }
  
  const googleResponse: GoogleResponse = await response.json();
  
  return parseGoogleResponse(googleResponse, !!tools);
}

/**
 * Utility function to check if Google AI provider is configured
 */
export function isGoogleAIConfigured(): boolean {
  return !!Deno.env.get("GOOGLE_API_KEY");
}
