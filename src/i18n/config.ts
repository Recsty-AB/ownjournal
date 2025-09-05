import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';
import zhTW from './locales/zh-TW.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import hi from './locales/hi.json';
import sv from './locales/sv.json';
import da from './locales/da.json';
import nb from './locales/nb.json';
import fi from './locales/fi.json';

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ja: { translation: ja },
      ko: { translation: ko },
      zh: { translation: zh },
      'zh-TW': { translation: zhTW },
      de: { translation: de },
      fr: { translation: fr },
      pt: { translation: pt },
      it: { translation: it },
      nl: { translation: nl },
      pl: { translation: pl },
      hi: { translation: hi },
      sv: { translation: sv },
      da: { translation: da },
      nb: { translation: nb },
      fi: { translation: fi },
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
