import type { MetaDescriptor } from 'react-router';
import type { Language } from '~/types';
import { translations, type TranslationKey } from '~/utils/translations';

export const PAGE_TITLE_BRAND = 'Ninjasset';

/** Browser tab title: `Ninjasset | Section` (brand only when section is empty). */
export function formatPageTitle(section?: string): string {
  const trimmed = section?.trim();
  if (!trimmed) return PAGE_TITLE_BRAND;
  return `${PAGE_TITLE_BRAND} | ${trimmed}`;
}

export function pageTitleMeta(section?: string): MetaDescriptor[] {
  return [{ title: formatPageTitle(section) }];
}

export function pageTitleMetaFromKey(key: TranslationKey, language: Language = 'en'): MetaDescriptor[] {
  const catalog = language === 'es' ? translations.es : translations.en;
  return pageTitleMeta(catalog[key]);
}

/** Route `meta` export: `export const meta = pageMeta('dashboard.title');` */
export function pageMeta(key: TranslationKey) {
  return () => pageTitleMetaFromKey(key);
}
