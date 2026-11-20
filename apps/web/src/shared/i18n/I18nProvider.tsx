import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { LANGUAGE_STORAGE_KEY, readLanguage, translate, type Language } from './translate';

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readLanguage());
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Language selection remains active for this session if storage is unavailable.
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    const isLoginPage = window.location.pathname.replace(/\/+$/, '') === '/login';
    if (!isLoginPage) {
      document.title = 'iMap';
    }
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) {
      description.content = translate(
        language,
        'Bản đồ Việt Nam với tìm kiếm địa điểm và công cụ lập hành trình.',
      );
    }
  }, [language]);
  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (message, values) => translate(language, message, values) }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}
