import { useId } from 'react';
import { useLanguage } from '~/providers/LanguageProvider';
import type { Language } from '~/types';
import type { TranslationKey } from '~/utils/translations';

interface LanguageFlagSelectorProps {
  value: Language;
  onChange: (lang: Language) => void;
}

const FLAG_CLASS = 'block w-14 h-10 rounded-sm';

function FlagSpain() {
  return (
    <svg className={FLAG_CLASS} viewBox="0 0 750 500" aria-hidden>
      <rect width="750" height="500" fill="#c60b1e" />
      <rect width="750" height="250" y="125" fill="#ffc400" />
    </svg>
  );
}

function FlagUnitedKingdom() {
  const id = useId();
  const clipS = `${id}-s`;
  const clipT = `${id}-t`;

  return (
    <svg className={FLAG_CLASS} viewBox="0 0 60 30" aria-hidden>
      <clipPath id={clipS}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={clipT}>
        <path d="M30,15 h30 v15 z v-30 h-30 z h-30 v15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${clipS})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 60,30 M60,0 0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 60,30 M60,0 0,30" clipPath={`url(#${clipT})`} stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

const LANGUAGE_OPTIONS: { lang: Language; Flag: typeof FlagSpain; labelKey: TranslationKey }[] = [
  { lang: 'en', Flag: FlagUnitedKingdom, labelKey: 'settings.english' },
  { lang: 'es', Flag: FlagSpain, labelKey: 'settings.spanish' },
];

export function LanguageFlagSelector({ value, onChange }: LanguageFlagSelectorProps) {
  const { t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language')}
      className="flex gap-3"
    >
      {LANGUAGE_OPTIONS.map(({ lang, Flag, labelKey }) => {
        const selected = value === lang;
        return (
          <button
            key={lang}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => onChange(lang)}
            className={`rounded p-1 transition-colors cursor-pointer focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/15 ${
              selected
                ? 'border-2 border-primary ring-2 ring-primary/20'
                : 'border-2 border-border hover:border-muted'
            }`}
          >
            <Flag />
          </button>
        );
      })}
    </div>
  );
}
