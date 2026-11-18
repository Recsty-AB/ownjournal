/**
 * gemini-3.5-transcribe has no Mandarin-in-Traditional-script locale, so
 * Mandarin audio comes back in Simplified characters. For users whose UI is
 * Traditional Chinese (zh-TW), convert to Taiwan Traditional with Taiwan
 * phrasing (OpenCC s2twp, e.g. 软件 → 軟體). Non-Chinese text passes through
 * unchanged, so this is safe even when a zh-TW user dictates in English.
 *
 * The converter (~1 MB of dictionaries) is loaded lazily so cold starts for
 * every other locale don't pay for it.
 */

const OPENCC_URL = "https://esm.sh/opencc-js@1.4.2/cn2t";

type Converter = (text: string) => string;
let converterPromise: Promise<Converter> | null = null;

export function needsTraditionalChinese(language: string | null | undefined): boolean {
  if (!language) return false;
  const tag = language.toLowerCase();
  return tag === "zh-tw" || tag.startsWith("zh-hant");
}

async function getConverter(): Promise<Converter> {
  if (!converterPromise) {
    converterPromise = import(OPENCC_URL)
      .then((mod) => mod.default.Converter({ from: "cn", to: "twp" }) as Converter)
      .catch((error) => {
        converterPromise = null;
        throw error;
      });
  }
  return converterPromise;
}

export async function toTraditionalChinese(text: string): Promise<string> {
  const convert = await getConverter();
  return convert(text);
}
