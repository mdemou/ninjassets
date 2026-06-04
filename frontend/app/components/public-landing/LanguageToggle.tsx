import { useLanguage } from '~/providers/LanguageProvider';
import type { Language } from '~/types';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const langs: Language[] = ['en', 'es'];

  return (
    <div className="flex items-center rounded-full border border-border/80 bg-card/60 p-0.5 text-xs font-medium shadow-sm backdrop-blur-sm">
      {langs.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={`px-2.5 py-1 rounded-full uppercase tracking-wide transition-all duration-200 cursor-pointer ${
            language === lang
              ? 'bg-primary text-white shadow-[0_2px_8px_rgb(16_148_97/0.35)]'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
