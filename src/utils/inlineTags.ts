// Inline #tag support for the entry body.
//
// A tag token starts with `#` at the beginning of a line or after whitespace,
// followed by a letter/number and up to 29 more letters/numbers/hyphens
// (spaces cannot appear in inline tags — a space ends the token). This keeps
// markdown headings (`# Title`, `## Title` — `#` followed by space or another
// `#`) and URL fragments (`…/page#section` — `#` not preceded by whitespace)
// from being picked up as tags.

// First char must be a letter/number so `#-` or bare `#` never match.
const TAG_TOKEN = /(?<=^|\s)#([\p{L}\p{N}][\p{L}\p{N}-]{0,29})/gmu;

/** Remove fenced code blocks and inline code spans so `#` inside code
 *  (comments, shell snippets) is not treated as a tag. */
const stripCode = (text: string): string =>
  text.replace(/```[\s\S]*?(```|$)/g, " ").replace(/`[^`\n]*`/g, " ");

/**
 * Extract unique inline #tags from an entry body.
 * Keeps the casing of the first occurrence; dedupes case-insensitively.
 */
export const extractInlineTags = (body: string): string[] => {
  if (!body || !body.includes("#")) return [];
  const seen = new Map<string, string>();
  for (const match of stripCode(body).matchAll(TAG_TOKEN)) {
    const tag = match[1];
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  return Array.from(seen.values());
};

/**
 * Merge inline #tags found in the body into an explicit tag list.
 * Existing tags win on case-insensitive collisions; the combined list is
 * capped at `maxTags` (the journal entry schema allows at most 20).
 */
export const mergeInlineTags = (
  tags: string[],
  body: string,
  maxTags = 20
): string[] => {
  const merged = [...tags];
  const lower = new Set(tags.map((t) => t.toLowerCase()));
  for (const tag of extractInlineTags(body)) {
    if (merged.length >= maxTags) break;
    if (lower.has(tag.toLowerCase())) continue;
    lower.add(tag.toLowerCase());
    merged.push(tag);
  }
  return merged;
};

export interface ActiveTagToken {
  /** Index of the `#` character in the text. */
  start: number;
  /** Text typed after `#` so far (may be empty). */
  query: string;
}

/**
 * If the caret is inside an inline #tag token being typed, return that token;
 * otherwise null. Used by the editor to drive autocomplete.
 */
export const getActiveTagToken = (
  text: string,
  caret: number
): ActiveTagToken | null => {
  // Walk back from the caret over tag characters to a possible `#`.
  let i = caret - 1;
  while (i >= 0 && /[\p{L}\p{N}-]/u.test(text[i])) i--;
  if (i < 0 || text[i] !== "#") return null;
  // `#` must sit at line start or after whitespace.
  if (i > 0 && !/\s/.test(text[i - 1])) return null;
  const query = text.slice(i + 1, caret);
  if (query.length > 30) return null;
  // Reject tokens whose first char is not a letter/number (e.g. `#-`).
  if (query.length > 0 && !/[\p{L}\p{N}]/u.test(query[0])) return null;
  return { start: i, query };
};
