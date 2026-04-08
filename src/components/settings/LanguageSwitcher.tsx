import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'nb', name: 'Norsk' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'sv', name: 'Svenska' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português (PT)' },
  { code: 'pt-BR', name: 'Português (BR)' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'th', name: 'ไทย' },
];

const isNativeIOS = !!(window as any).Capacitor?.isNativePlatform?.() &&
  (window as any).Capacitor?.getPlatform?.() === 'ios';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Get the current language, handling regional variants like zh-TW
  const getCurrentLanguage = () => {
    const lang = i18n.language;
    // Check if it's a supported language with regional variant
    if (languages.some(l => l.code === lang)) {
      return lang;
    }
    // Fallback to base language code
    const baseLang = lang.split('-')[0];
    return languages.some(l => l.code === baseLang) ? baseLang : 'en';
  };

  const currentLanguage = getCurrentLanguage();

  // On iOS native, use a native <select> because Radix UI's portal-based
  // dropdown doesn't receive touch events in Capacitor's WKWebView.
  if (isNativeIOS) {
    return (
      <div className="flex items-center gap-2">
        <Languages className="w-4 h-4 text-muted-foreground" />
        <select
          value={currentLanguage}
          onChange={(e) => changeLanguage(e.target.value)}
          className="w-[140px] h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Languages className="w-4 h-4 text-muted-foreground" />
      <Select value={currentLanguage} onValueChange={changeLanguage}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
