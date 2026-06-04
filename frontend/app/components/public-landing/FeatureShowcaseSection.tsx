import type { ReactNode } from 'react';
import { useLanguage } from '~/providers/LanguageProvider';
import type { TranslationKey } from '~/utils/translations';

interface FeatureShowcaseSectionProps {
  reverse?: boolean;
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  preview: ReactNode;
  index: number;
}

export function FeatureShowcaseSection({
  reverse = false,
  eyebrowKey,
  titleKey,
  descKey,
  preview,
  index,
}: FeatureShowcaseSectionProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${index > 0 ? 'mt-28 first:mt-0' : ''}`}
    >
      <div
        className={`animate-fade-in-up ${reverse ? 'lg:order-2' : ''}`}
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {preview}
      </div>
      <div
        className={`text-center lg:text-left animate-fade-in-up ${reverse ? 'lg:order-1' : ''}`}
        style={{ animationDelay: `${index * 80 + 60}ms` }}
      >
        <span className="inline-flex items-center rounded-full border border-[var(--color-primary-pale)] bg-[var(--color-primary-2x-light)]/70 px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--color-primary-x-dark)]">
          {t(eyebrowKey)}
        </span>
        <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{t(titleKey)}</h3>
        <p className="mx-auto mt-4 max-w-lg text-[1.0625rem] leading-relaxed text-muted lg:mx-0">
          {t(descKey)}
        </p>
      </div>
    </div>
  );
}
