import {
  enUS, ja, es, ko, zhCN, zhTW, de, fr, pt, it, nl, pl, hi, sv, da, nb, fi
} from 'date-fns/locale';
import type { Locale } from 'date-fns';

/**
 * Maps app language codes to date-fns Locale objects.
 * Supports all 17 languages the app is localized in.
 */
const localeMap: Record<string, Locale> = {
  en: enUS,
  ja: ja,
  es: es,
  ko: ko,
  zh: zhCN,
  'zh-TW': zhTW,
  de: de,
  fr: fr,
  pt: pt,
  it: it,
  nl: nl,
  pl: pl,
  hi: hi,
  sv: sv,
  da: da,
  nb: nb,
  fi: fi,
};

/**
 * Get date-fns locale based on app language code.
 * Falls back to base language (e.g., "zh-TW" -> "zh") then to enUS.
 */
export const getDateLocale = (language: string): Locale => {
  return localeMap[language] || localeMap[language.split('-')[0]] || enUS;
};
