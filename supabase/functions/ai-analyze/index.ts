import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callGoogleAI } from "./googleAIProvider.ts";
import { callOpenAI } from "./openaiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AI Provider selection: "google" (default) or "openai"
const AI_PROVIDER = Deno.env.get("AI_PROVIDER") || "google";

// Retry switch: when false (default), skip server-side retry blocks and return 503 retryable immediately
const ENABLE_AI_RETRY = Deno.env.get("ENABLE_AI_RETRY") === "true";

// Helper function to strip markdown code blocks from AI responses
const stripMarkdownCodeBlock = (content: string): string => {
  let cleaned = content.trim();
  
  // Try strict match first (code block spans entire content)
  const strictRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const strictMatch = cleaned.match(strictRegex);
  if (strictMatch) {
    return strictMatch[1].trim();
  }
  
  // Try to extract JSON from within code blocks anywhere in content
  const looseRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const looseMatch = cleaned.match(looseRegex);
  if (looseMatch) {
    return looseMatch[1].trim();
  }
  
  // Fallback: return trimmed content as-is
  return cleaned;
};

// Shared utility: repair truncated JSON (e.g., from token limit cutoff)
const repairTruncatedJson = (jsonStr: string): any | null => {
  try {
    // First try direct parse
    return JSON.parse(jsonStr);
  } catch {
    // Continue to repair
  }
  
  try {
    let fixed = jsonStr;
    
    // Remove trailing incomplete string values (e.g., ,"incomple...)
    fixed = fixed.replace(/,\s*"[^"]*$/, '');
    // Remove trailing incomplete array elements (e.g., ,["incomple...)
    fixed = fixed.replace(/,\s*\["[^"]*$/, '');
    // Remove trailing comma
    fixed = fixed.replace(/,\s*$/, '');
    
    // Count and close unbalanced brackets/braces
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    
    const missingBrackets = openBrackets - closeBrackets;
    for (let i = 0; i < missingBrackets; i++) fixed += ']';
    const missingBraces = openBraces - closeBraces;
    for (let i = 0; i < missingBraces; i++) fixed += '}';
    
    const parsed = JSON.parse(fixed);
    return parsed;
  } catch (e) {
    console.error("[JSON_REPAIR] Repair failed:", e);
    return null;
  }
};

// Robust tool call argument parser with repair fallback
const parseToolCallArguments = (argsStr: string, context: string): any | null => {
  // Attempt 1: Direct parse
  try {
    return JSON.parse(argsStr);
  } catch {
    console.warn(`[${context}] Direct JSON.parse failed, trying recovery...`);
  }
  
  // Attempt 2: Strip trailing parentheses (Google Python-style wrapping)
  try {
    const stripped = argsStr.replace(/\)\s*$/, '');
    if (stripped !== argsStr) {
      const parsed = JSON.parse(stripped);
      return parsed;
    }
  } catch {
    // Continue
  }
  
  // Attempt 3: Repair truncated JSON
  const repaired = repairTruncatedJson(argsStr);
  if (repaired) {
    console.warn(`[${context}] Recovered via JSON repair (data may be partial)`);
    return repaired;
  }
  
  console.error(`[${context}] All parsing attempts failed for arguments (first 300 chars):`, argsStr?.substring(0, 300));
  return null;
};

// Trim, collapse spaces, and remove spaces between CJK characters (fixes weird spaces in Japanese etc.)
const cleanTitle = (t: string): string =>
  t.trim()
    .replace(/\s{2,}/g, " ")
    .replace(/([\u3000-\u9FFF\uF900-\uFAFF])\s+([\u3000-\u9FFF\uF900-\uFAFF])/g, "$1$2");

// Helper: extract titles array from parsed object with flexible key checking
const extractTitlesFromParsed = (parsed: any): string[] | null => {
  if (!parsed || typeof parsed !== "object") return null;

  // Check known property names
  const titleKeys = ["titles", "title_suggestions", "suggested_titles"];
  for (const key of titleKeys) {
    if (Array.isArray(parsed[key]) && parsed[key].length > 0 && parsed[key].every((t: any) => typeof t === "string")) {
      return parsed[key].map((t: string) => cleanTitle(t));
    }
  }

  // Generic: find any array of strings in the object
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value) && value.length > 0 && value.every((t: any) => typeof t === "string")) {
      console.warn("[TITLES] Found titles via generic array detection, key was not in expected list");
      return (value as string[]).map(cleanTitle);
    }
  }

  return null;
};

// Options for AI requests (e.g. OpenAI reasoning.effort for faster title/tag generation)
type AIRequestOptions = { reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" };

// Unified AI caller with automatic fallback between providers
async function callAIWithFallback(
  model: string,
  messages: any[],
  tools?: any[],
  toolChoice?: any,
  maxTokens?: number,
  options?: AIRequestOptions
): Promise<{ data: any; provider: string }> {
  const primaryProvider = AI_PROVIDER;
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  // Try primary provider first
  try {
    
    if (primaryProvider === "google") {
      const data = await callGoogleAI(model, messages, tools, toolChoice, maxTokens);
      return { data, provider: "google" };
    } else {
      const data = await callOpenAI(model, messages, tools, toolChoice, maxTokens, options);
      return { data, provider: "openai" };
    }
  } catch (primaryError) {
    const errorMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
    console.warn(`[AI_FALLBACK] Primary provider (${primaryProvider}) failed:`, errorMessage);
    
    // Determine if we should fallback
    const shouldFallback =
      errorMessage.includes("RATE_LIMIT") ||
      errorMessage.includes("429") ||
      errorMessage.includes("AUTH_ERROR") ||
      errorMessage.includes("402") ||
      errorMessage.includes("API_KEY_INVALID") ||
      errorMessage.includes("403") ||
      errorMessage.includes("500") ||
      errorMessage.includes("503") ||
      errorMessage.includes("SERVER_ERROR") ||
      errorMessage.includes("MALFORMED") ||
      errorMessage.includes("INVALID_REQUEST") ||
      errorMessage.includes("INVALID_ARGUMENT") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("TIMEOUT") ||
      errorMessage.includes("RECITATION") ||
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("network") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("fetch failed");
    
    if (!shouldFallback) {
      throw primaryError; // Don't fallback for validation errors, etc.
    }
    
    // Fallback to the other provider
    const fallbackProvider = primaryProvider === "google" ? "openai" : "google";
    
    // Check if fallback provider is configured before attempting
    if (fallbackProvider === "google" && !GOOGLE_API_KEY) {
      console.error(`[AI_FALLBACK] Cannot fallback to Google: GOOGLE_API_KEY not configured`);
      throw primaryError;
    }
    if (fallbackProvider === "openai" && !OPENAI_API_KEY) {
      console.error(`[AI_FALLBACK] Cannot fallback to OpenAI: OPENAI_API_KEY not configured`);
      throw primaryError;
    }
    
    console.log(`[AI_FALLBACK] Falling back to: ${fallbackProvider} (triggered by: ${errorMessage.substring(0, 80)})`);
    
    try {
      if (fallbackProvider === "openai") {
        const data = await callOpenAI(model, messages, tools, toolChoice, maxTokens, options);
        return { data, provider: "openai" };
      } else {
        const data = await callGoogleAI(model, messages, tools, toolChoice, maxTokens);
        return { data, provider: "google" };
      }
    } catch (fallbackError) {
      const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(`[AI_FALLBACK] Fallback provider (${fallbackProvider}) also failed:`, fallbackErrorMsg);
      
      // Throw a combined error
      throw new Error(`AI unavailable: Primary (${primaryProvider}): ${errorMessage}, Fallback (${fallbackProvider}): ${fallbackErrorMsg}`);
    }
  }
}

serve(async (req) => {
  const functionStartTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    // Extract token from Authorization header and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Auth error: No Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - Please sign in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized - Please sign in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authTime = Date.now() - functionStartTime;

    const requestBody = await req.json();
    const {
      type,
      language,
      entryId,
      content,
      createdAt,
      entries,
      tags,
      mood,
      existingTags,
      predefinedActivities,
      existingActivities,
      period,
      aggregates,
      entryMetadata,
      timeBuckets,
      batchContext,
    } = requestBody;

    // Language mapping — must cover every language listed in
    // src/i18n/config.ts. Keep this in sync when adding new UI locales,
    // otherwise AI output silently falls back to English.
    const languageMap: Record<string, string> = {
      en: "English",
      es: "Spanish",
      ja: "Japanese",
      ko: "Korean",
      zh: "Simplified Chinese",
      "zh-TW": "Traditional Chinese",
      de: "German",
      fr: "French",
      pt: "Portuguese (European)",
      "pt-BR": "Brazilian Portuguese",
      it: "Italian",
      nl: "Dutch",
      pl: "Polish",
      hi: "Hindi",
      sv: "Swedish",
      da: "Danish",
      nb: "Norwegian Bokmål",
      fi: "Finnish",
      id: "Indonesian",
      vi: "Vietnamese",
      th: "Thai",
    };
    // Normalize: strip BCP-47 region subtag unless the exact tag is a key
    // (so "ja-JP" → "ja" but "zh-TW" stays as-is).
    const normalizedLang = language && typeof language === "string"
      ? (languageMap[language] ? language : language.split("-")[0])
      : "en";
    const targetLanguage = languageMap[normalizedLang] || "English";

    // Check word limit
    if (content && typeof content === "string") {
      const wordCount = content.trim().split(/\s+/).length;
      const MAX_WORDS = 3000;
      if (wordCount > MAX_WORDS) {
        return new Response(
          JSON.stringify({
            error: `Content exceeds the ${MAX_WORDS} word limit. Current word count: ${wordCount}. Please shorten your entry.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Calculate time boundaries for usage limits
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

    // Get consolidated usage summary in a single query (6 queries → 1 query)
    const usageQueryStart = Date.now();
    const { data: usageSummary, error: usageError } = await supabaseClient.rpc("get_ai_usage_summary", {
      p_user_id: user.id,
      p_start_of_month: startOfMonth,
      p_start_of_week: startOfWeek.toISOString(),
      p_start_of_year: startOfYear,
    });
    const usageQueryTime = Date.now() - usageQueryStart;

    if (usageError) {
      console.error("[ERROR] Error fetching usage summary:", usageError, "- Query time:", usageQueryTime, "ms");
      return new Response(JSON.stringify({ error: "Failed to check usage limits" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = usageSummary[0];
    
    // Check if user is Pro
    if (!summary?.is_pro) {
      return new Response(JSON.stringify({ error: "Pro subscription required for AI features" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Define usage limits
    const limits: Record<string, { monthly?: number; weekly?: number }> = {
      title: { monthly: 200 },
      tags: { monthly: 200 },
      entryAnalysis: { monthly: 150 },
      trendAnalysis: { weekly: 1 },
    };

    // Check limits based on type
    if (type === "title" || type === "tags" || type === "analyzeEntry" || type === "analyzeTrends") {
      const analysisType =
        type === "analyzeEntry" ? "entryAnalysis" : type === "analyzeTrends" ? "trendAnalysis" : type;
      const limit = limits[analysisType];

      if (limit) {
        // Check monthly limit
        if (limit.monthly) {
          let currentCount = 0;
          let effectiveLimit = limit.monthly;

          // Get current count from consolidated summary
          if (analysisType === "title") currentCount = Number(summary.monthly_title_count);
          else if (analysisType === "tags") currentCount = Number(summary.monthly_tags_count);
          else if (analysisType === "entryAnalysis") {
            currentCount = Number(summary.monthly_entry_count);
            // Check if user qualifies for the yearly 2000 boost
            const yearlyTrendCount = Number(summary.yearly_trend_count);
            const yearlyEntryCount = Number(summary.yearly_entry_count);
            if (yearlyTrendCount > 0 && yearlyEntryCount < 2000) {
              effectiveLimit = 2000;
            }
          }

          if (currentCount >= effectiveLimit) {
            const resetInfo =
              analysisType === "entryAnalysis" && effectiveLimit === 150
                ? "Your yearly 2000 boost has been used. Limit resets next month."
                : "Limit resets next month.";

            return new Response(
              JSON.stringify({
                error: `You've reached the monthly limit of ${effectiveLimit} ${analysisType} requests. ${resetInfo}`,
                limit: effectiveLimit,
                current: currentCount,
              }),
              {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        // Check weekly limit (for trend analysis)
        if (limit.weekly && analysisType === "trendAnalysis") {
          const weeklyCount = Number(summary.weekly_trend_count);
          if (weeklyCount >= limit.weekly) {
            return new Response(
              JSON.stringify({
                error: `You can only run ${analysisType} once per week. Try again next week.`,
                limit: limit.weekly,
                current: weeklyCount,
              }),
              {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }
      }

      // For entryAnalysis, check if this specific entry was already analyzed
      // Allow forceReanalyze to bypass this check for failed entries
      if (type === "analyzeEntry" && entryId) {
        const { forceReanalyze } = requestBody;
        const entryCheckStart = Date.now();
        const { count: entryCount, error: entryError } = await supabaseClient
          .from("ai_usage_stats")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("analysis_type", "entryAnalysis")
          .eq("entry_id", entryId);
        const entryCheckTime = Date.now() - entryCheckStart;

        if (entryError) {
          console.error("[ERROR] Error checking entry usage:", entryError, "- Query time:", entryCheckTime, "ms");
        } else if (entryCount !== null && entryCount > 0 && !forceReanalyze) {
          return new Response(
            JSON.stringify({
              error: "This entry has already been analyzed. Edit the entry to analyze it again.",
              alreadyAnalyzed: true,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    const limitCheckTime = Date.now() - functionStartTime;

    // Validate AI provider configuration
    if (AI_PROVIDER === "google") {
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
      if (!GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY not configured. Set AI_PROVIDER=openai to use OpenAI instead.");
      }
    } else {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY not configured. Set AI_PROVIDER=google to use Google AI instead.");
      }
    }

    // Handle different analysis types
    let analysisPrompt = "";
    let analysisType = type || "entry";
    let systemPrompt = "You are a helpful AI assistant that analyzes journal entries. Always respond with valid JSON.";

    if (type === "analyzeEntry") {
      // New: Analyze entry and return metadata
      if (!entryId || !content || !createdAt) {
        return new Response(JSON.stringify({ error: "Missing required fields: entryId, content, createdAt" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate basic metadata
      const wordCount = content.trim().split(/\s+/).length;
      const lengthCategory = wordCount < 100 ? "short" : wordCount < 400 ? "medium" : "long";

      const hour = new Date(createdAt).getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";

      systemPrompt = `You are an expert journal entry analyzer. Extract structured metadata from journal entries.

LANGUAGE AND TONE RULES:
- Output MUST be in the same language as the journal entry.
- If the entry is in Japanese, use polite language (丁寧語/ですます調) in all text fields like "shortSummary".
  - Example: "〜を感じていたようです" NOT "〜を感じていた"
  - Example: "〜について書かれています" NOT "〜について書かれている"
- For all languages, maintain a warm, respectful, and supportive tone.`;
      analysisPrompt = `Analyze this journal entry and extract structured metadata.

Journal entry:
${content}

${tags && tags.length > 0 ? `Tags: ${tags.join(", ")}` : ""}
${mood ? `User-set mood: ${mood}` : ""}

Extract the following fields. Be concise, emotionally aware, and reflect the true content of the entry.

TONE GUIDELINES:
- For Japanese entries: Always use polite language (丁寧語/ですます調) in shortSummary and other text fields.
- For all languages: Be warm, respectful, and supportive in tone.

Respond ONLY in valid JSON in the SAME language as the entry:

{
  "sentimentScore": <number from -1 to 1 (internal use only, do NOT explain the scale)>,
  "dominantEmotion": "<primary emotion>",
  "emotions": ["<3–5 emotions present>"],
  "topics": ["<3–5 topics/themes>"],
  "keywords": ["<5–8 significant words/phrases>"],
  "peopleMentioned": ["<names or none>"],
  "shortSummary": "<2–3 sentence summary using polite language for Japanese>",
  "mainStressors": ["<0–3 things that created stress, frustration, worry, or difficulty>"],
  "mainSupports": ["<0–3 things that helped, comforted, or improved mood>"],
  "selfTalkTone": "<one of: 'self-critical', 'balanced', 'self-compassionate', 'unclear'>"
}

NOTES:
- "mainStressors" are the internal/external factors that made the writer feel anxious, tired, pressured, or low.
- "mainSupports" are the positive, supportive, or replenishing elements (family moments, hobbies, rest, etc.).
- "selfTalkTone" describes how the writer talks to themselves.
- Never add advice, interpretations, or commentary — only extract metadata.`;
    } else if (type === "analyzeTrends") {
      // Analyze trends using aggregated metadata (individual entries or time buckets)
      if (!aggregates || (!entryMetadata && !timeBuckets)) {
        return new Response(JSON.stringify({ error: "Missing aggregates or entryMetadata/timeBuckets" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      systemPrompt = `You are a warm, emotionally intelligent journaling coach who helps users understand their patterns with kindness and insight. 

ABSOLUTE LANGUAGE RULE: You MUST output EVERYTHING in ${targetLanguage} ONLY. This is non-negotiable.
- If ${targetLanguage} is English, your ENTIRE output must be in English. NO Japanese, Chinese, Spanish or any other language words are allowed.
- If ${targetLanguage} is Japanese, your ENTIRE output must be in Japanese.
- If ${targetLanguage} is Spanish, your ENTIRE output must be in Spanish.
ANY violation of this rule is a critical error.`;

      const agg = aggregates;
      const topEmotions = agg.topEmotions
        .slice(0, 5)
        .map((e: any) => `${e.emotion} (${e.count})`)
        .join(", ");
      const topTopics = agg.topTopics
        .slice(0, 5)
        .map((t: any) => `${t.topic} (${t.count})`)
        .join(", ");

      // Build context section based on data format (individual entries vs time buckets)
      let temporalContext = "";
      let dataFormatDescription = "";
      
      if (timeBuckets && timeBuckets.length > 0) {
        // Long period: Use time buckets for temporal analysis
        const bucketType = timeBuckets.length > 52 ? "months" : "weeks";
        dataFormatDescription = `This is a long-term analysis spanning ${timeBuckets.length} ${bucketType}.`;
        
        temporalContext = `
Temporal Analysis (${timeBuckets.length} ${bucketType}):
${timeBuckets.map((b: any) => 
  `${b.periodLabel}: ${b.entryCount} entries, avg sentiment=${b.avgSentiment.toFixed(2)}, trend=${b.sentimentTrend}
   Emotions: ${b.dominantEmotions.join(", ")} | Topics: ${b.dominantTopics.join(", ")}
   Range: ${b.sentimentRange.min.toFixed(2)} to ${b.sentimentRange.max.toFixed(2)}
   Typical entry: ${b.medianEntry.emotion} (${b.medianEntry.sentiment.toFixed(2)}) | Peak/Valley: ${b.extremeEntry.emotion} (${b.extremeEntry.sentiment.toFixed(2)})`
).join("\n\n")}`;
      } else if (entryMetadata && entryMetadata.length > 0) {
        // Short period: Use individual entry metadata
        dataFormatDescription = `This is a detailed analysis of ${entryMetadata.length} individual entries.`;
        
        temporalContext = `
Entry-level data (${entryMetadata.length} entries):
${entryMetadata.slice(0, 90).map((m: any, i: number) => 
  `${i + 1}. Sentiment: ${m.sentimentScore.toFixed(2)}, Emotion: ${m.dominantEmotion}, Topics: ${m.topics.join(", ")}, Time: ${m.timeOfDay}`
).join("\n")}`;
      }

      // Add long-period guidance when using time buckets
      const longPeriodGuidance = timeBuckets ? `
LONG-TERM ANALYSIS FOCUS:
- Identify long-term emotional arcs and seasonal patterns
- Look for life phase transitions and evolution of themes over time
- Compare the beginning of the period to the end
- Identify turning points based on sentiment trends between periods
- Focus on sustained patterns rather than individual fluctuations
` : "";

      analysisPrompt = `Analyze the following aggregated journaling data and provide a warm, supportive trend analysis.

Period: ${period?.start || "Unknown"} to ${period?.end || "Unknown"}
${dataFormatDescription}
Total entries: ${agg.entryCount}
Average sentiment: ${agg.avgSentiment.toFixed(2)} (internal use only, do not mention numeric scales)
Top emotions: ${topEmotions}
Top topics: ${topTopics}
Time of day distribution: ${JSON.stringify(agg.timeOfDayDistribution)}
Length distribution: ${JSON.stringify(agg.lengthDistribution)}
${temporalContext}
${longPeriodGuidance}
YOUR TASK:
Write a trend analysis that feels warm, human, and emotionally intelligent — like a kind journaling coach (NOT a clinician or therapist).  

##############################################################################
# CRITICAL LANGUAGE ENFORCEMENT - READ CAREFULLY
##############################################################################

You MUST output your ENTIRE response in ${targetLanguage} ONLY.

STRICT RULES:
1. EVERY word in your JSON output MUST be in ${targetLanguage}.
2. If the source data contains words in Japanese (e.g., 喜び, 達成感, 家族), Chinese, or any other non-${targetLanguage} language, you MUST TRANSLATE them to ${targetLanguage}.
3. Do NOT copy-paste any non-${targetLanguage} words from the input data.
4. Do NOT mix languages. Zero tolerance for language mixing.

TRANSLATION EXAMPLES (if target is English):
- 喜び → "joy" (NOT "喜び")
- 達成感 → "sense of accomplishment" (NOT "達成感")
- 家族 → "family" (NOT "家族")
- 仕事 → "work" (NOT "仕事")
- 疲労 → "fatigue" (NOT "疲労")

TRANSLATION EXAMPLES (if target is Spanish):
- 喜び → "alegría" (NOT "喜び")
- 達成感 → "sentido de logro" (NOT "達成感")

If you include ANY word that is not in ${targetLanguage}, your response will be rejected.

##############################################################################

GUIDELINES:
- Use friendly, conversational language.
- Do NOT include numeric values like "-0.80" or "6/13". Translate numbers into words like "a noticeable dip" or "several entries".
- Avoid clinical or diagnostic language. Do not give medical or mental-health advice.
- Focus on patterns: what lifts the user's mood, what drains them, what repeats, what shifts.
- Highlight positive developments and things the user is doing well.
- Provide gentle, non-prescriptive focus areas ("you might find it helpful to…", "you could explore…").
- The closing reflection must be purely reflective and validating — no advice, suggestions, or "you might try…" language.

REFLECTION GUIDELINES for "closingReflection":
Write a warm, gentle, emotionally aware paragraph that avoids any form of advice-giving or behavioral suggestions.

Tone:
- Reflective, not directive.
- Observational, not prescriptive.
- Kind and validating, but never telling the user what they should do.
- Emphasize recognition, understanding, and empathy.
- Focus on acknowledging their presence, effort, growth, and humanity.
- No suggestions, no instructions, no strategies, no "you might try…"
- No coaching voice. More like a caring narrator or gentle companion.

What to include:
- Notice patterns in how they show up (e.g., "you've been showing up with steadiness even on tiring days")
- Acknowledge their emotional resilience or honesty.
- Validate the effort they're putting into their days.
- Recognize small moments of meaning or connection.
- Convey a sense of ongoing support without telling them what to do.

Examples of acceptable tone:
- "You've been showing up with honesty and care, even when days felt demanding."
- "There's a quiet strength in how you move through your routines."
- "Your reflections carry a mix of effort, tenderness, and presence."

AVOID in the reflection:
- "Try doing…"
- "Consider focusing on…"
- "You should…"
- Anything that sounds like coaching, instruction, optimization, productivity guidance, or psychological advice.

The reflection should feel like a gentle acknowledgement of the user's lived experience during this period.

##############################################################################
# CRITICAL JSON STRUCTURE REQUIREMENTS
##############################################################################

You MUST respond in valid JSON with EXACTLY these English field names (keys):
- "periodSummary"
- "moodTrend"  
- "insights"
- "focusAreas"
- "closingReflection"

CRITICAL RULES FOR JSON OUTPUT:
1. The JSON **keys** (field names) MUST ALWAYS be in English exactly as shown above.
2. Only the **values** (the content within quotes after the colons) should be in ${targetLanguage}.
3. Do NOT translate the JSON keys to ${targetLanguage}.

CORRECT format example:
{
  "periodSummary": "<${targetLanguage} content here>",
  "moodTrend": "<${targetLanguage} content here>",
  "insights": ["<${targetLanguage} insight 1>", "<${targetLanguage} insight 2>"],
  "focusAreas": ["<${targetLanguage} focus 1>"],
  "closingReflection": "<${targetLanguage} content here>"
}

INCORRECT format (DO NOT DO THIS - keys must stay English):
{
  "期間のまとめ": "...",      // ❌ WRONG - key translated to Japanese
  "気分の流れ": "...",        // ❌ WRONG - key translated to Japanese
  "resumenDelPeríodo": "..." // ❌ WRONG - key translated to Spanish
}

Respond ONLY in valid JSON:

{
  "periodSummary": "<2–3 sentence overview of the period in ${targetLanguage}>",
  "moodTrend": "<description of mood shifts in natural language in ${targetLanguage}>",
  "insights": [
    "<3–5 clear pattern insights in ${targetLanguage} (sources of stress, sources of support, recurring themes, emotional loops)>"
  ],
  "focusAreas": [
    "<3–5 gentle suggestions in ${targetLanguage} for what the user may want to pay attention to or reflect on>"
  ],
  "closingReflection": "<See REFLECTION GUIDELINES above: a warm, gentle, emotionally aware paragraph in ${targetLanguage} acknowledging their lived experience — no advice or suggestions>"
}`;
    } else if (type === "title") {
      // Enhanced title generation - 10 titles in one call for cost optimization
      if (!content) {
        return new Response(JSON.stringify({ error: "Missing content" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contextInfo = [];
      if (tags && tags.length > 0) contextInfo.push(`Tags: ${tags.join(", ")}`);
      if (mood) contextInfo.push(`Mood: ${mood}`);
      const context = contextInfo.length > 0 ? `\n\nContext:\n${contextInfo.join("\n")}` : "";

      systemPrompt =
        "You are a thoughtful journaling assistant. Create natural, conversational titles that sound like something a person would actually name their journal entry.";
      analysisPrompt = `Generate exactly 20 natural, everyday titles for this journal entry. Each title should be 4-8 words and feel personal and authentic.

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 20 unique titles
2. Vary the style: some poetic, some straightforward, some emotional, some analytical
3. Respond in the SAME LANGUAGE as the journal entry (Japanese entries get Japanese titles, etc.)
4. Each title must be unique and approach the entry from a different angle
5. Titles should capture the essence of the entry - emotions, events, themes, or reflections${context}

Journal entry:
${content}

Use the provided function to return exactly 20 titles.`;
    } else if (type === "tags") {
      // Enhanced tag generation - 10 sets of 1-5 tags per call
      if (!content) {
        return new Response(JSON.stringify({ error: "Missing content" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build existing tags context
      let existingTagsContext = "";
      if (existingTags && Array.isArray(existingTags) && existingTags.length > 0) {
        existingTagsContext = `\n\nEXISTING TAGS IN USER'S JOURNAL (up to 200):\n${existingTags.join(", ")}\n\nIMPORTANT: Prioritize suggesting these existing tags if they are appropriate for this entry. Only suggest new tags if they are significantly better or capture aspects not covered by existing tags. This helps maintain consistency and prevents tag proliferation.`;
      }

      // Build predefined activities context
      let activitiesContext = "";
      if (predefinedActivities && Array.isArray(predefinedActivities) && predefinedActivities.length > 0) {
        const alreadySelected = Array.isArray(existingActivities) && existingActivities.length > 0
          ? `\n\nThe user has ALREADY selected these activities (do NOT suggest them again): ${existingActivities.join(", ")}`
          : "";
        activitiesContext = `\n\n##############################################################################
# ACTIVITY SUGGESTIONS — IN ADDITION TO TAGS
##############################################################################

You must ALSO suggest activities that match the entry. Activities are PREDEFINED and represent what the user was doing.

PREDEFINED ACTIVITIES (you MUST only choose from this exact list):
${predefinedActivities.join(", ")}

RULES for activities:
1. Return an "activities" array containing ONLY keys from the predefined list above. NEVER invent new activity keys.
2. Only include an activity if the entry CLEARLY mentions or implies it. If unsure, do NOT include it.
3. Return between 0 and 5 activities. It is perfectly fine to return an empty array if no activities are clearly indicated.
4. Activities are about what the user was DOING (exercise, work, reading, social interaction, etc.), not topics or feelings.
5. Do NOT translate activity keys — return them in English exactly as listed.${alreadySelected}`;
      }

      systemPrompt =
        "You are an expert tagging assistant for personal journals. Your PRIMARY goal is to maintain tag consistency by REUSING existing tags whenever possible. Only create new tags when absolutely necessary.";
      analysisPrompt = `Generate exactly 20 different sets of tags for this journal entry.

##############################################################################
# MULTI-TOPIC COVERAGE - CRITICAL
##############################################################################

When an entry covers MULTIPLE topics (e.g., work + family + health), each tag set MUST:
1. First, identify ALL distinct topics/themes in the entry
2. Include tags from MULTIPLE different topics within the SAME set
3. Capture the BREADTH of the entry, not just one narrow aspect

BAD example (too narrow - DO NOT DO THIS):
Entry about: work meeting + family dinner + feeling grateful
Set: ["meeting", "work", "productivity"] ❌ (only covers work topic)

GOOD example (balanced coverage - DO THIS):
Entry about: work meeting + family dinner + feeling grateful  
Set: ["work", "family", "gratitude"] ✓ (covers multiple topics from the entry)

If an entry mentions work stress AND a relaxing evening walk, a single tag set should include tags for BOTH, like: ["work", "stress", "evening walk", "relaxation"]

##############################################################################
# CRITICAL REQUIREMENTS
##############################################################################

1. Generate EXACTLY 20 unique tag sets
2. Each set should have 2-4 tags (prefer 2-3 tags per set, only use 1 or 5 when truly necessary)
3. Tags should be lowercase, short phrases or single words
4. Each set should combine DIFFERENT topics from the entry (not focus on just one theme)
5. Avoid repeating the same tag combinations across sets - make each set unique

##############################################################################
# TAG REUSE POLICY - HIGHEST PRIORITY
##############################################################################

You MUST follow these rules strictly:

1. EXAMINE the "EXISTING TAGS" list below FIRST before suggesting any tags
2. If an existing tag is even PARTIALLY relevant, USE IT instead of creating a new one
3. Only create a NEW tag if:
   - No existing tag covers the concept AT ALL
   - The concept is critically important to the entry
4. When in doubt, USE AN EXISTING TAG

Examples of tag reuse (when existing tags include "family", "work", "reflection"):
- Instead of "family time" → use "family"
- Instead of "work stress" → use "work" 
- Instead of "self-analysis" → use "reflection"

##############################################################################
# ABSOLUTE LANGUAGE RULE - NON-NEGOTIABLE
##############################################################################

- Detect the DOMINANT language of the journal entry
- ALL tags MUST be in that SINGLE language ONLY
- NEVER mix languages within a tag
- NEVER add translations or explanations in another language
- If the entry is in Japanese, ALL tags must be 100% Japanese
- If the entry is in English, ALL tags must be 100% English  
- If the entry is in Spanish, ALL tags must be 100% Spanish
- Zero tolerance for language mixing in tags

WRONG examples (NEVER do this):
- "心の平和 Peace of Mind" ❌
- "自責の念 Self-blame" ❌
- "家庭環境 Building Better Roots" ❌
- "仕事 work" ❌

CORRECT examples for Japanese entries:
- "心の平和" ✓
- "自責" ✓
- "家庭環境" ✓
- "仕事" ✓

CORRECT examples for English entries:
- "peace of mind" ✓
- "self-blame" ✓
- "family environment" ✓
- "work" ✓

##############################################################################
${existingTagsContext}${activitiesContext}

Journal entry:
${content}

Use the provided function to return exactly 20 tag sets${predefinedActivities ? " AND a list of matching activities (0-5)" : ""}.`;
    } else {
      // Standard entry analysis
      if (!entryId || !content) {
        return new Response(JSON.stringify({ error: "Missing entryId or content" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      analysisPrompt = `Analyze this journal entry and provide:
1. A concise summary (2-3 sentences)
2. Sentiment analysis (positive, negative, neutral, or mixed)
3. 5 key phrases or topics
4. A suggested title (5-8 words)
5. 3-5 suggested tags (single words or short phrases, lowercase)

Journal entry:
${content}

Respond in JSON format:
{
  "summary": "...",
  "sentiment": "positive/negative/neutral/mixed",
  "keywords": ["phrase1", "phrase2", ...],
  "suggestedTitle": "...",
  "suggestedTags": ["tag1", "tag2", ...]
}`;
    }

    // Model selection based on type, word count, and batch context
    const getModelForType = (
      type: string,
      content?: string,
      batchContext?: { isTrendBatch: boolean; entryCount: number },
      forceModel?: string,
    ): string => {
      // Allow forcing a specific model for comparison
      if (forceModel) return forceModel;
      
      switch (type) {
        case "title":
          return "google/gemini-2.5-flash";
        case "tags":
          return "google/gemini-2.5-flash";
        case "analyzeTrends":
          return "google/gemini-3.1-pro-preview";
        case "analyzeEntry":
          // Use Gemini 3 Flash for all entry analysis (cost-effective, good quality)
          return "google/gemini-3-flash-preview";
        default:
          return "google/gemini-3-flash-preview";
      }
    };

    const modelToUse = getModelForType(type, content, batchContext);
    const wordCount = content ? content.trim().split(/\s+/).length : 0;
    const promptBuildTime = Date.now() - functionStartTime;

    // Build request body - note: GPT-5 family doesn't support temperature parameter
    const aiRequestStart = Date.now();
    let aiRequestTime = 0;
    const aiRequestBody: any = {
      model: modelToUse,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: analysisPrompt },
      ],
      // Trend analysis needs more output; title/tags use 2000 (actual usage ~300-900 tokens)
      max_completion_tokens: type === "analyzeTrends" ? 4000 : 2000,
    };

    // Add tool calling for title and tag generation to get structured output
    if (type === "title") {
      aiRequestBody.tools = [
        {
          type: "function",
          function: {
            name: "generate_titles",
            description: "Generate exactly 20 diverse and creative titles for a journal entry",
            parameters: {
              type: "object",
              properties: {
                titles: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 20,
                  maxItems: 20,
                  description: "Array of exactly 20 unique, creative titles",
                },
              },
              required: ["titles"],
              additionalProperties: false,
            },
          },
        },
      ];
      aiRequestBody.tool_choice = { type: "function", function: { name: "generate_titles" } };
    } else if (type === "tags") {
      const tagToolProperties: Record<string, unknown> = {
        tagSets: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "A set of 2-4 related tags (occasionally 1 or 5)",
          },
          minItems: 20,
          maxItems: 20,
          description: "Array of exactly 20 unique tag sets",
        },
      };
      const tagToolRequired = ["tagSets"];
      if (predefinedActivities && Array.isArray(predefinedActivities) && predefinedActivities.length > 0) {
        tagToolProperties.activities = {
          type: "array",
          items: { type: "string", enum: predefinedActivities },
          minItems: 0,
          maxItems: 5,
          description: "Up to 5 activity keys from the predefined list that the entry clearly indicates. May be empty.",
        };
        tagToolRequired.push("activities");
      }
      aiRequestBody.tools = [
        {
          type: "function",
          function: {
            name: "generate_tag_sets",
            description: "Generate exactly 20 diverse sets of tags, each containing 2-4 tags (occasionally 1 or 5), and suggest matching activities from a predefined list when applicable",
            parameters: {
              type: "object",
              properties: tagToolProperties,
              required: tagToolRequired,
              additionalProperties: false,
            },
          },
        },
      ];
      aiRequestBody.tool_choice = { type: "function", function: { name: "generate_tag_sets" } };
    } else if (type === "analyzeEntry") {
      // Tool calling for structured entry analysis output
      aiRequestBody.tools = [
        {
          type: "function",
          function: {
            name: "extract_metadata",
            description: "Extract structured metadata from a journal entry",
            parameters: {
              type: "object",
              properties: {
                sentimentScore: { type: "number", description: "Sentiment score from -1 (negative) to 1 (positive)" },
                dominantEmotion: { type: "string", description: "The primary emotion in the entry" },
                emotions: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "3-5 emotions present in the entry" 
                },
                topics: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "3-5 topics or themes discussed" 
                },
                keywords: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "5-8 significant words or phrases" 
                },
                peopleMentioned: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Names of people mentioned, or empty array" 
                },
                shortSummary: { type: "string", description: "2-3 sentence summary of the entry" },
                mainStressors: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "0-3 things that created stress or difficulty" 
                },
                mainSupports: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "0-3 things that helped or improved mood" 
                },
                selfTalkTone: { 
                  type: "string", 
                  enum: ["self-critical", "balanced", "self-compassionate", "unclear"],
                  description: "How the writer talks to themselves" 
                }
              },
              required: ["sentimentScore", "dominantEmotion", "emotions", "topics", "shortSummary"],
              additionalProperties: false,
            },
          },
        },
      ];
      aiRequestBody.tool_choice = { type: "function", function: { name: "extract_metadata" } };
    }

    // Call AI provider with automatic fallback between Google and OpenAI
    let aiData;
    let usedProvider: string;
    
    try {
      const result = await callAIWithFallback(
        modelToUse,
        aiRequestBody.messages,
        aiRequestBody.tools,
        aiRequestBody.tool_choice,
        aiRequestBody.max_completion_tokens,
        type === "title" ? { reasoningEffort: "low" } : type === "tags" ? { reasoningEffort: "none" } : undefined
      );
      aiData = result.data;
      usedProvider = result.provider;
      
      aiRequestTime = Date.now() - aiRequestStart;
      
      // Detect truncation due to token limits
      const firstChoice = aiData.choices?.[0];
      const finishReason = firstChoice?.finish_reason;
      if (finishReason === "length") {
        console.warn(`[TRUNCATION] Response was truncated (finish_reason=length) for type=${type}, model=${modelToUse}, provider=${usedProvider}. Consider increasing max_completion_tokens.`);
      }
    } catch (error) {
      aiRequestTime = Date.now() - aiRequestStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[ERROR] All AI providers failed:", errorMessage, "- Request time:", aiRequestTime, "ms");
      
      if (errorMessage.includes("RATE_LIMIT") || errorMessage.includes("429")) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (errorMessage.includes("AUTH_ERROR") || errorMessage.includes("402") || errorMessage.includes("403")) {
        return new Response(JSON.stringify({ error: "AI authentication error. Please check API key configuration." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI analysis failed: " + errorMessage);
    }

    // Parse response based on type
    let analysisData;

    if (type === "analyzeEntry") {
      // Handle metadata extraction response with tool calling
      let extracted = null;
      
      // Check for tool call response first (preferred)
      const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.name === "extract_metadata") {
        try {
          extracted = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error("[ERROR] Failed to parse tool call arguments:", e);
        }
      }
      
      // Fallback to content parsing if no tool call
      if (!extracted) {
        const aiContent = aiData.choices[0]?.message?.content;
        if (aiContent) {
          const cleanedContent = stripMarkdownCodeBlock(aiContent);
          try {
            extracted = JSON.parse(cleanedContent);
          } catch (e) {
            console.error("[ERROR] Failed to parse content response:", e);
          }
        }
      }
      
      // Same-model retry (always): one more attempt with same model before fallback or 503
      if (!extracted) {
        console.log("[RETRY] Same-model retry for analyzeEntry");
        try {
          const sameModelResult = await callAIWithFallback(
            modelToUse,
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens
          );
          const retryData = sameModelResult.data;
          const retryToolCall = retryData.choices[0]?.message?.tool_calls?.[0];
          if (retryToolCall && retryToolCall.function?.name === "extract_metadata") {
            try {
              extracted = JSON.parse(retryToolCall.function.arguments);
            } catch (e) {
              console.error("[RETRY] Failed to parse same-model tool call:", e);
            }
          }
          if (!extracted) {
            const retryContent = retryData.choices[0]?.message?.content;
            if (retryContent) {
              const cleanedRetryContent = stripMarkdownCodeBlock(retryContent);
              try {
                extracted = JSON.parse(cleanedRetryContent);
              } catch (e) {
                console.error("[RETRY] Same-model content parse failed:", e);
              }
            }
          }
        } catch (sameModelError) {
          console.error("[RETRY] Same-model retry failed:", sameModelError);
        }
      }
      
      // If parsing still failed, retry with fallback model (when ENABLE_AI_RETRY)
      if (!extracted && ENABLE_AI_RETRY) {
        try {
          const retryResult = await callAIWithFallback(
            "google/gemini-2.5-pro",
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens
          );
          const retryData = retryResult.data;
          const retryToolCall = retryData.choices[0]?.message?.tool_calls?.[0];
          if (retryToolCall && retryToolCall.function?.name === "extract_metadata") {
            try {
              extracted = JSON.parse(retryToolCall.function.arguments);
            } catch (e) {
              console.error("[RETRY] Failed to parse fallback tool call:", e);
            }
          }
          if (!extracted) {
            const retryContent = retryData.choices[0]?.message?.content;
            if (retryContent) {
              const cleanedRetryContent = stripMarkdownCodeBlock(retryContent);
              try {
                extracted = JSON.parse(cleanedRetryContent);
              } catch (e) {
                console.error("[RETRY] Fallback model also failed to parse:", e);
              }
            }
          }
        } catch (retryError) {
          console.error("[RETRY] All providers failed on retry:", retryError);
        }
      } else if (!extracted) {
        console.log("[RETRY] Retry disabled (ENABLE_AI_RETRY not set), skipping fallback-model retry");
      }
      
      // If still no result, return error instead of fallback metadata
      if (!extracted) {
        const firstChoice = aiData.choices?.[0];
        console.error("[ERROR] Analysis failed after retry, returning error");
        return new Response(JSON.stringify({ 
          error: "Could not analyze entry. The AI returned an invalid response. Please try again.",
          retryable: true,
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate additional metadata
      const wordCount = content.trim().split(/\s+/).length;
      const lengthCategory = wordCount < 100 ? "short" : wordCount < 400 ? "medium" : "long";
      const hour = new Date(createdAt).getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";

      // Construct EntryAIMetadata
      analysisData = {
        metaVersion: 1,
        analyzedAt: new Date().toISOString(),
        sentimentScore: extracted.sentimentScore ?? 0,
        dominantEmotion: extracted.dominantEmotion || "neutral",
        emotions: extracted.emotions || [],
        topics: extracted.topics || [],
        keywords: extracted.keywords || [],
        peopleMentioned: extracted.peopleMentioned || [],
        shortSummary: extracted.shortSummary || "",
        mainStressors: extracted.mainStressors || [],
        mainSupports: extracted.mainSupports || [],
        selfTalkTone: extracted.selfTalkTone || "unclear",
        wordCount,
        lengthCategory,
        timeOfDay,
      };
    } else if (type === "analyzeTrends") {
      // Handle trend analysis response
      let aiContent = aiData.choices[0]?.message?.content;
      
      // Same-model retry (always) when response is empty
      if (!aiContent || aiContent.trim() === '') {
        console.error("[ERROR] AI returned empty response for trend analysis");
        console.log("[RETRY] Same-model retry for analyzeTrends");
        try {
          const sameModelResult = await callAIWithFallback(
            modelToUse,
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens
          );
          aiContent = sameModelResult.data.choices[0]?.message?.content;
        } catch (sameModelError) {
          console.error("[RETRY] Same-model retry failed:", sameModelError);
        }
      }
      
      // If still empty, retry with fallback model (when ENABLE_AI_RETRY)
      if ((!aiContent || aiContent.trim() === '') && ENABLE_AI_RETRY) {
        try {
          const retryResult = await callAIWithFallback(
            "google/gemini-2.5-pro",
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens
          );
          const retryData = retryResult.data;
          aiContent = retryData.choices[0]?.message?.content;
        } catch (retryError) {
          console.error("[RETRY] All providers failed on retry:", retryError);
        }
      }
      
      // If still empty after retries, return error
      if (!aiContent || aiContent.trim() === '') {
        console.error("[ERROR] Trend analysis returned empty response after retries");
        return new Response(JSON.stringify({ 
          error: "The AI service returned an empty response. This may be due to high load. Please try again in a few minutes." 
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const cleanedContent = stripMarkdownCodeBlock(aiContent);
      
      try {
        let parsed = JSON.parse(cleanedContent);
        
        // Fallback: Normalize translated keys to English keys
        const keyMap: Record<string, string> = {
          // Japanese key translations
          '期間のまとめ': 'periodSummary',
          '気分の流れ': 'moodTrend',
          '気づき': 'insights',
          '洞察': 'insights',
          '注目したい点': 'focusAreas',
          'フォーカスエリア': 'focusAreas',
          '結びのふりかえり': 'closingReflection',
          '締めくくりの振り返り': 'closingReflection',
          // Spanish key translations
          'resumenDelPeríodo': 'periodSummary',
          'resumen_del_periodo': 'periodSummary',
          'tendenciaDeÁnimo': 'moodTrend',
          'tendencia_de_animo': 'moodTrend',
          'perspectivas': 'insights',
          'áreasDeFoco': 'focusAreas',
          'areas_de_foco': 'focusAreas',
          'reflexiónFinal': 'closingReflection',
          'reflexion_final': 'closingReflection',
        };
        
        // Check if any keys need normalization
        const hasTranslatedKeys = Object.keys(parsed).some(key => keyMap[key]);
        if (hasTranslatedKeys) {
          const normalized: any = {};
          for (const [key, value] of Object.entries(parsed)) {
            const normalizedKey = keyMap[key] || key;
            normalized[normalizedKey] = value;
          }
          parsed = normalized;
        }
        
        analysisData = parsed;
        
        // Validate required fields exist and are not fallback values
        if (!analysisData.periodSummary || !analysisData.moodTrend) {
          throw new Error("Missing required fields in trend analysis");
        }
        
        // Check for fallback values that indicate parsing failure
        if (analysisData.periodSummary === "Unable to analyze trends" || 
            analysisData.moodTrend === "Data unavailable") {
          throw new Error("Trend analysis returned fallback data");
        }
      } catch (e) {
        console.error("[ERROR] Failed to parse trend analysis:", e instanceof Error ? e.message : String(e));
        console.error("[ERROR] Full raw AI response:", aiContent);
        console.error("[ERROR] Cleaned content was:", cleanedContent);
        return new Response(JSON.stringify({ 
          error: "Failed to parse AI response. The AI returned an invalid format. Please try again." 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (type === "title") {
      // Handle tool calling response for titles with robust parsing and retry
      
      // Helper: pad titles to 20
      const padTitles = (titles: string[]): string[] => {
        const padded = [...titles];
        while (padded.length < 20) {
          padded.push(titles[padded.length % titles.length]);
        }
        return padded.slice(0, 20);
      };
      
      let titles: string[] | null = null;
      
      // Attempt 1: Parse from tool call arguments (robust)
      const toolCalls = aiData.choices[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const rawArgs = toolCalls[0].function?.arguments;
        if (typeof rawArgs === "string" && rawArgs.length > 0) {
          const functionArgs = parseToolCallArguments(rawArgs, "TITLES_TOOL_CALL");
          if (functionArgs) {
            titles = extractTitlesFromParsed(functionArgs);
            if (!titles) {
              console.warn("[TITLES] Tool call parsed but no titles array found. Keys:", Object.keys(functionArgs));
            }
          }
        }
      }
      
      // Attempt 2: Content fallback
      if (!titles) {
        const messageContent = aiData.choices[0]?.message?.content;
        if (messageContent) {
          console.warn("[TITLES] No tool call titles, attempting content fallback");
          try {
            const parsed = JSON.parse(stripMarkdownCodeBlock(messageContent));
            titles = extractTitlesFromParsed(parsed);
          if (titles) {
          }
          } catch {
            // Try repair on content too
            const repaired = repairTruncatedJson(stripMarkdownCodeBlock(messageContent));
            if (repaired) {
              titles = extractTitlesFromParsed(repaired);
              if (titles) {
              }
            }
          }
        }
      }
      
      // Same-model retry (always) for title
      if (!titles) {
        console.log("[RETRY] Same-model retry for title");
        try {
          const sameModelResult = await callAIWithFallback(
            modelToUse,
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens,
            { reasoningEffort: "low" }
          );
          const retryData = sameModelResult.data;
          const retryToolCalls = retryData.choices[0]?.message?.tool_calls;
          if (retryToolCalls && retryToolCalls.length > 0) {
            const retryRawArgs = retryToolCalls[0].function?.arguments;
            if (typeof retryRawArgs === "string" && retryRawArgs.length > 0) {
              const retryArgs = parseToolCallArguments(retryRawArgs, "TITLES_SAME_MODEL_RETRY");
              if (retryArgs) titles = extractTitlesFromParsed(retryArgs);
            }
          }
          if (!titles) {
            const retryContent = retryData.choices[0]?.message?.content;
            if (retryContent) {
              try {
                const parsed = JSON.parse(stripMarkdownCodeBlock(retryContent));
                titles = extractTitlesFromParsed(parsed);
              } catch {
                const repaired = repairTruncatedJson(stripMarkdownCodeBlock(retryContent));
                if (repaired) titles = extractTitlesFromParsed(repaired);
              }
            }
          }
        } catch (sameModelError) {
          console.error("[TITLES][RETRY] Same-model retry failed:", sameModelError);
        }
      }
      
      // Attempt 3: Retry with fallback model (when ENABLE_AI_RETRY)
      if (!titles && ENABLE_AI_RETRY) {
        try {
          const retryResult = await callAIWithFallback(
            "google/gemini-2.5-pro",
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens,
            { reasoningEffort: "low" }
          );
          const retryData = retryResult.data;
          const retryToolCalls = retryData.choices[0]?.message?.tool_calls;
          if (retryToolCalls && retryToolCalls.length > 0) {
            const retryRawArgs = retryToolCalls[0].function?.arguments;
            if (typeof retryRawArgs === "string" && retryRawArgs.length > 0) {
              const retryArgs = parseToolCallArguments(retryRawArgs, "TITLES_RETRY_TOOL_CALL");
              if (retryArgs) titles = extractTitlesFromParsed(retryArgs);
            }
          }
          if (!titles) {
            const retryContent = retryData.choices[0]?.message?.content;
            if (retryContent) {
              try {
                const parsed = JSON.parse(stripMarkdownCodeBlock(retryContent));
                titles = extractTitlesFromParsed(parsed);
              } catch {
                const repaired = repairTruncatedJson(stripMarkdownCodeBlock(retryContent));
                if (repaired) titles = extractTitlesFromParsed(repaired);
              }
            }
          }
        } catch (retryError) {
          console.error("[TITLES][RETRY] All providers failed on retry:", retryError);
        }
      } else if (!titles) {
        console.log("[TITLES][RETRY] Retry disabled (ENABLE_AI_RETRY not set), skipping fallback-model retry");
      }
      
      // Final result
      if (titles && titles.length > 0) {
        analysisData = { suggestedTitles: padTitles(titles) };
      } else {
        const firstChoice = aiData.choices?.[0];
        console.error("[TITLES] All parsing and retry attempts failed, returning 503");
        return new Response(JSON.stringify({ 
          error: "Could not generate titles. The AI returned an invalid response. Please try again.",
          retryable: true,
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (type === "tags") {
      // Handle tool calling response for tags with retry logic
      
      // Tag normalization helpers
      const normalizeTag = (tag: string): string => {
        return tag.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "");
      };
      const findExistingTag = (suggestedTag: string, existingTagsList: string[]): string => {
        const normalizedSuggested = normalizeTag(suggestedTag);
        for (const existingTag of existingTagsList) {
          if (normalizeTag(existingTag) === normalizedSuggested) {
            return existingTag;
          }
        }
        return suggestedTag;
      };
      
      // Helper: extract activities array from any AI response data (tool call only)
      const extractActivitiesFromResponse = (responseData: any): string[] | null => {
        const toolCalls = responseData.choices?.[0]?.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const rawArgs = toolCalls[0].function?.arguments;
          if (typeof rawArgs === "string" && rawArgs.length > 0) {
            const functionArgs = parseToolCallArguments(rawArgs, "TAGS_TOOL_CALL_ACTIVITIES");
            if (functionArgs && Array.isArray(functionArgs.activities)) {
              const validActivities = functionArgs.activities
                .filter((a: any) => typeof a === "string" && a.length > 0);
              // Filter to predefined list and dedupe
              const predefSet = new Set(predefinedActivities || []);
              const filtered = validActivities.filter((a: string) => predefSet.has(a));
              const existingSet = new Set(existingActivities || []);
              const finalList = Array.from(new Set(filtered)).filter((a: string) => !existingSet.has(a));
              return finalList;
            }
          }
        }
        return null;
      };

      // Helper: extract tagSets from any AI response data
      const extractTagSetsFromResponse = (responseData: any): string[][] | null => {
        // Try tool call first
        const toolCalls = responseData.choices[0]?.message?.tool_calls;
        
        if (toolCalls && toolCalls.length > 0) {
          const rawArgs = toolCalls[0].function?.arguments;
          if (typeof rawArgs === "string" && rawArgs.length > 0) {
            const functionArgs = parseToolCallArguments(rawArgs, "TAGS_TOOL_CALL");
          
          if (functionArgs) {
            // Try multiple possible property names
            let tagSets = functionArgs.tagSets 
              || functionArgs.tag_sets
              || functionArgs.tags;
              
            // If functionArgs is itself an array, use it directly
            if (!tagSets && Array.isArray(functionArgs)) {
              tagSets = functionArgs;
            }
            
            if (tagSets && Array.isArray(tagSets) && tagSets.length > 0) {
              // Validate nested arrays
              const validSets = tagSets.filter((s: any) => Array.isArray(s) && s.length > 0 && s.every((t: any) => typeof t === 'string'));
              if (validSets.length > 0) {
                return validSets;
              }
            }
            
            console.error("[TAGS] No valid tagSets found in:", Object.keys(functionArgs));
          }
          }
        }
        
        // Fallback: try to extract from content
        const messageContent = responseData.choices[0]?.message?.content;
        if (messageContent) {
          console.log("[TAGS] Attempting content fallback, content length:", messageContent.length);
          return extractTagSetsFromContent(messageContent);
        }
        
        return null;
      };
      
      // Helper: robustly extract tagSets from text content
      const extractTagSetsFromContent = (content: string): string[][] | null => {
        // Strategy 1: Strip markdown and parse directly
        try {
          const cleaned = stripMarkdownCodeBlock(content);
          const parsed = JSON.parse(cleaned);
          const sets = parsed.tagSets || parsed.tag_sets || parsed.tags;
          if (Array.isArray(sets) && sets.length > 0) {
            const valid = sets.filter((s: any) => Array.isArray(s) && s.length > 0);
            if (valid.length > 0) {
              return valid;
            }
          }
          // If parsed is itself an array of arrays
          if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
            return parsed;
          }
        } catch {
          // Continue to next strategy
        }
        
        // Strategy 2: Extract JSON object/array from mixed text
        try {
          // Find the first { or [ and try to parse from there
          const jsonStartObj = content.indexOf('{');
          const jsonStartArr = content.indexOf('[');
          const jsonStart = jsonStartObj >= 0 && jsonStartArr >= 0 
            ? Math.min(jsonStartObj, jsonStartArr)
            : Math.max(jsonStartObj, jsonStartArr);
          
          if (jsonStart >= 0) {
            let jsonCandidate = content.substring(jsonStart);
            // Strip trailing non-JSON text
            jsonCandidate = jsonCandidate.replace(/[^}\]]*$/, '');
            
            try {
              const parsed = JSON.parse(jsonCandidate);
              const sets = parsed.tagSets || parsed.tag_sets || parsed.tags || (Array.isArray(parsed) ? parsed : null);
              if (Array.isArray(sets) && sets.length > 0) {
                const valid = sets.filter((s: any) => Array.isArray(s) && s.length > 0);
                if (valid.length > 0) {
                  return valid;
                }
              }
            } catch {
              // Try to repair truncated JSON
              let fixedJson = jsonCandidate;
              const openBrackets = (fixedJson.match(/\[/g) || []).length;
              const closeBrackets = (fixedJson.match(/\]/g) || []).length;
              const openBraces = (fixedJson.match(/\{/g) || []).length;
              const closeBraces = (fixedJson.match(/\}/g) || []).length;
              
              // Remove trailing incomplete elements
              fixedJson = fixedJson.replace(/,\s*\["[^"]*$/, '');
              fixedJson = fixedJson.replace(/,\s*"[^"]*$/, '');
              
              // Close unclosed brackets
              const missingBrackets = openBrackets - (fixedJson.match(/\]/g) || []).length;
              for (let i = 0; i < missingBrackets; i++) {
                fixedJson += ']';
              }
              const missingBraces = openBraces - (fixedJson.match(/\}/g) || []).length;
              for (let i = 0; i < missingBraces; i++) {
                fixedJson += '}';
              }
              
              try {
                const parsed = JSON.parse(fixedJson);
                const sets = parsed.tagSets || parsed.tag_sets || parsed.tags || (Array.isArray(parsed) ? parsed : null);
                if (Array.isArray(sets) && sets.length > 0) {
                  const valid = sets.filter((s: any) => Array.isArray(s) && s.length > 0);
                  if (valid.length > 0) {
                    return valid;
                  }
                }
              } catch (e) {
                console.error("[TAGS] JSON repair also failed:", e);
              }
            }
          }
        } catch {
          // Continue
        }
        
        console.error("[TAGS] All content extraction strategies failed");
        return null;
      };
      
      // Helper: normalize and pad tag sets
      const normalizeAndPadTagSets = (tagSets: string[][]): { tagSets: string[][] } => {
        const normalized = tagSets.map((tagSet: string[]) =>
          tagSet.map((tag: string) => findExistingTag(tag, existingTags || []))
        );
        
        if (normalized.length >= 20) {
          return { tagSets: normalized.slice(0, 20) };
        }
        
        if (normalized.length > 0) {
          console.warn("[TAGS] AI returned fewer tag sets than expected:", normalized.length);
          const padded = [...normalized];
          while (padded.length < 20) {
            padded.push(normalized[padded.length % normalized.length]);
          }
          return { tagSets: padded.slice(0, 20) };
        }
        
        return { tagSets: [] }; // Empty - will trigger retry
      };
      
      // First attempt: parse the initial response
      let extractedSets = extractTagSetsFromResponse(aiData);
      let extractedActivities = extractActivitiesFromResponse(aiData);

      // Same-model retry (always) for tags
      if (!extractedSets || extractedSets.length === 0) {
        console.log("[RETRY] Same-model retry for tags");
        try {
          const sameModelResult = await callAIWithFallback(
            modelToUse,
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens,
            { reasoningEffort: "none" }
          );
          extractedSets = extractTagSetsFromResponse(sameModelResult.data);
          if (!extractedActivities || extractedActivities.length === 0) {
            extractedActivities = extractActivitiesFromResponse(sameModelResult.data);
          }
        } catch (sameModelError) {
          console.error("[TAGS][RETRY] Same-model retry failed:", sameModelError);
        }
      }

      // Activities-only retry: if tags came back fine but activities are
      // empty/missing while predefined activities were requested, give the
      // model one more chance. Observed failure: Gemini/GPT handling Japanese
      // or mixed-language entries sometimes emits the tagSets tool call
      // without populating the activities field, or returns an empty array
      // even when the entry clearly implies predefined activities.
      if (
        extractedSets && extractedSets.length > 0 &&
        predefinedActivities && Array.isArray(predefinedActivities) && predefinedActivities.length > 0 &&
        (!extractedActivities || extractedActivities.length === 0)
      ) {
        console.log("[RETRY] Same-model retry for activities");
        try {
          const activitiesRetryResult = await callAIWithFallback(
            modelToUse,
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens,
            { reasoningEffort: "none" }
          );
          const retriedActivities = extractActivitiesFromResponse(activitiesRetryResult.data);
          if (retriedActivities && retriedActivities.length > 0) {
            extractedActivities = retriedActivities;
          }
        } catch (activitiesRetryError) {
          console.error("[ACTIVITIES][RETRY] Same-model retry failed:", activitiesRetryError);
        }
      }

      if (extractedSets && extractedSets.length > 0) {
        analysisData = normalizeAndPadTagSets(extractedSets);
        analysisData.activities = (extractedActivities && extractedActivities.length > 0) ? extractedActivities : [];
      } else if (ENABLE_AI_RETRY) {
        // Retry with gemini-2.5-pro (only when retry is enabled)
        try {
          const retryResult = await callAIWithFallback(
            "google/gemini-2.5-pro",
            aiRequestBody.messages,
            aiRequestBody.tools,
            aiRequestBody.tool_choice,
            aiRequestBody.max_completion_tokens,
            { reasoningEffort: "none" }
          );
          const retryData = retryResult.data;
          const retryExtracted = extractTagSetsFromResponse(retryData);
          const retryActivities = extractActivitiesFromResponse(retryData);

          if (retryExtracted && retryExtracted.length > 0) {
            analysisData = normalizeAndPadTagSets(retryExtracted);
            analysisData.activities = (retryActivities && retryActivities.length > 0) ? retryActivities : [];
          } else {
            console.error("[TAGS][RETRY] Fallback retry also produced no valid tag sets");
            return new Response(JSON.stringify({ 
              error: "Could not generate tags. The AI returned an invalid response. Please try again.",
              retryable: true
            }), {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (retryError) {
          console.error("[TAGS][RETRY] All providers failed on retry:", retryError);
          return new Response(JSON.stringify({ 
            error: "Could not generate tags. The AI service is temporarily unavailable. Please try again.",
            retryable: true
          }), {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        console.log("[TAGS][RETRY] No valid tag sets after same-model retry; ENABLE_AI_RETRY not set");
        return new Response(JSON.stringify({ 
          error: "Could not generate tags. The AI returned an invalid response. Please try again.",
          retryable: true
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Handle non-title/tag requests (existing logic)
      const aiContent = aiData.choices?.[0]?.message?.content ?? null;
      if (aiContent == null) {
        analysisData = {
          summary: "Could not analyze entry",
          sentiment: "neutral",
          keywords: [],
          suggestedTitle: "Journal Entry",
          suggestedTags: [],
        };
      } else {
        try {
          analysisData = JSON.parse(aiContent);
        } catch {
          analysisData = {
            summary: aiContent.substring(0, 200),
            sentiment: "neutral",
            keywords: [],
            suggestedTitle: "Journal Entry",
            suggestedTags: [],
          };
        }
      }
    }

    const parseTime = Date.now() - (aiRequestStart + aiRequestTime);

    // Record usage after successful analysis
    const usageType = type === "analyzeEntry" ? "entryAnalysis" : type === "analyzeTrends" ? "trendAnalysis" : type;
    let usageInsertTime = 0;

    if (["title", "tags", "entryAnalysis", "trendAnalysis"].includes(usageType)) {
      // Extract token usage from AI response
      const tokenUsage = aiData?.usage;

      const usageRecord: any = {
        user_id: user.id,
        analysis_type: usageType,
        created_at: new Date().toISOString(),
        input_tokens: tokenUsage?.prompt_tokens ?? null,
        output_tokens: tokenUsage?.completion_tokens ?? null,
        model_used: modelToUse,
      };

      // Add entry_id for entry analysis
      if (usageType === "entryAnalysis" && entryId) {
        usageRecord.entry_id = entryId;
      }

      // Fire-and-forget: don't block response on usage insert
      Promise.resolve(
        supabaseClient.from("ai_usage_stats").insert(usageRecord)
      ).then(({ error: usageError }) => {
        if (usageError) console.error("[ERROR] Error recording usage:", usageError);
      }).catch((err) => console.error("[ERROR] Error recording usage:", err));
    }

    // NO DATABASE STORAGE - results returned directly to client for local caching
    // This ensures zero backend persistence of journal content derivatives

    const totalExecutionTime = Date.now() - functionStartTime;
    console.log(`[PERF_SUMMARY] type=${type} provider=${usedProvider} model=${modelToUse} total=${totalExecutionTime}ms | auth=${authTime}ms | usageQuery=${usageQueryTime}ms | limitCheck=${limitCheckTime}ms | promptBuild=${promptBuildTime}ms | aiCall=${aiRequestTime}ms | parsing=${parseTime}ms | usageInsert=${usageInsertTime}ms`);

    return new Response(JSON.stringify(analysisData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const totalExecutionTime = Date.now() - functionStartTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[ERROR] Error in ai-analyze function:", error, "- Total time:", totalExecutionTime, "ms");
    return new Response(JSON.stringify({ 
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
