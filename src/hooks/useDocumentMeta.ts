import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const BASE_TITLE = 'OwnJournal';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const resolved = title ? `${title} · ${BASE_TITLE}` : `${BASE_TITLE} - Secure & Encrypted`;
    document.title = resolved;
  }, [title]);
}

export function useDocumentLangSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.lang = lng;
    };
    apply(i18n.language);
    i18n.on('languageChanged', apply);
    return () => {
      i18n.off('languageChanged', apply);
    };
  }, [i18n]);
}
