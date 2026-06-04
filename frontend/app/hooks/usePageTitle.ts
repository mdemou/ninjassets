import { useEffect } from 'react';
import { useLanguage } from '~/providers/LanguageProvider';
import { formatPageTitle } from '~/utils/pageTitle';
import type { TranslationKey } from '~/utils/translations';

/** Sets `document.title` from a translation key; updates when locale changes. */
export function usePageTitle(key: TranslationKey): void {
  const { t, language } = useLanguage();

  useEffect(() => {
    document.title = formatPageTitle(t(key));
  }, [key, language, t]);
}

/** Sets `document.title` from a plain section string (e.g. dynamic detail pages). */
export function usePageTitleSection(section: string): void {
  useEffect(() => {
    document.title = formatPageTitle(section);
  }, [section]);
}
