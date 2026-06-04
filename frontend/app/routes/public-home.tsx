import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FeatureShowcases } from '~/components/public-landing/FeatureShowcases';
import { landingIconProps } from '~/components/public-landing/icons';
import { LanguageToggle } from '~/components/public-landing/LanguageToggle';
import { ProductPreview } from '~/components/public-landing/ProductPreview';
import { PublicBackground } from '~/components/public-landing/PublicBackground';
import { Wordmark } from '~/components/public-landing/Wordmark';
import { useLanguage } from '~/providers/LanguageProvider';
import { pageTitleMeta } from '~/utils/pageTitle';
import type { TranslationKey } from '~/utils/translations';

export const meta = pageTitleMeta();

interface Feature {
  icon: ReactNode;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  accent: string;
}

const features: Feature[] = [
  {
    titleKey: 'landing.features.assets.title',
    descKey: 'landing.features.assets.desc',
    accent: 'from-[var(--color-primary-dark)] to-primary',
    icon: (
      <svg {...landingIconProps}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    titleKey: 'landing.features.sites.title',
    descKey: 'landing.features.sites.desc',
    accent: 'from-[var(--color-status-stock-dark)] to-[var(--color-status-stock)]',
    icon: (
      <svg {...landingIconProps}>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle
          cx="12"
          cy="10"
          r="3"
        />
      </svg>
    ),
  },
  {
    titleKey: 'landing.features.qr.title',
    descKey: 'landing.features.qr.desc',
    accent: 'from-[var(--color-secondary-light)] to-[var(--color-secondary-x-light)]',
    icon: (
      <svg {...landingIconProps}>
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1"
        />
        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1"
        />
        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1"
        />
        <path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3" />
      </svg>
    ),
  },
  {
    titleKey: 'landing.features.handover.title',
    descKey: 'landing.features.handover.desc',
    accent: 'from-[var(--color-success)] to-[var(--color-primary-light)]',
    icon: (
      <svg {...landingIconProps}>
        <path d="m9 11 3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    titleKey: 'landing.features.alerts.title',
    descKey: 'landing.features.alerts.desc',
    accent: 'from-[var(--color-status-maintenance)] to-[var(--color-warning)]',
    icon: (
      <svg {...landingIconProps}>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      </svg>
    ),
  },
  {
    titleKey: 'landing.features.api.title',
    descKey: 'landing.features.api.desc',
    accent: 'from-[var(--color-user-role-admin-dark)] to-[var(--color-user-role-admin)]',
    icon: (
      <svg {...landingIconProps}>
        <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
      </svg>
    ),
  },
];

const stepIcons = [
  <svg
    key="1"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="M12 22V12" />
  </svg>,
  <svg
    key="2"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <rect
      x="3"
      y="3"
      width="7"
      height="7"
      rx="1"
    />
    <rect
      x="14"
      y="3"
      width="7"
      height="7"
      rx="1"
    />
    <rect
      x="3"
      y="14"
      width="7"
      height="7"
      rx="1"
    />
    <path d="M14 14h3v3" />
  </svg>,
  <svg
    key="3"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden
  >
    <path d="M3 3v18h18" />
    <path d="M7 16l4-4 4 4 6-6" />
  </svg>,
];

const steps: { titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { titleKey: 'landing.how.step1.title', descKey: 'landing.how.step1.desc' },
  { titleKey: 'landing.how.step2.title', descKey: 'landing.how.step2.desc' },
  { titleKey: 'landing.how.step3.title', descKey: 'landing.how.step3.desc' },
];

const highlights: TranslationKey[] = [
  'landing.features.assets.title',
  'landing.features.handover.title',
  'landing.features.qr.title',
  'landing.features.api.title',
];

export default function PublicHome() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-full bg-card text-foreground">
      <PublicBackground />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark />
          <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
            <a
              href="#showcase"
              className="no-underline transition-colors hover:text-foreground hover:no-underline"
            >
              {t('landing.nav.features')}
            </a>
            <a
              href="#how"
              className="no-underline transition-colors hover:text-foreground hover:no-underline"
            >
              {t('landing.nav.how')}
            </a>
            <Link
              to="/docs/getting-started/introduction"
              className="no-underline transition-colors hover:text-foreground hover:no-underline"
            >
              Docs
            </Link>
          </nav>
          <LanguageToggle />
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="text-center lg:text-left animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-pale)] bg-[var(--color-primary-2x-light)]/80 px-3.5 py-1.5 text-[0.8125rem] font-medium text-[var(--color-primary-x-dark)] shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {t('landing.hero.badge')}
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              {t('landing.hero.title')}
              <br />
              <span className="bg-gradient-to-r from-[var(--color-primary-dark)] via-primary to-[var(--color-primary-light)] bg-clip-text text-transparent">
                {t('landing.hero.titleAccent')}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
              {t('landing.hero.subtitle')}
            </p>
            <p className="mt-9 text-sm text-muted">{t('landing.hero.note')}</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface-alt/50 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6">
          {highlights.map((key) => (
            <div
              key={key}
              className="flex items-center gap-2.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-sm font-medium text-foreground/80">{t(key)}</span>
            </div>
          ))}
        </div>
      </section>

      <FeatureShowcases />

      <section
        id="features"
        className="relative scroll-mt-20"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center animate-fade-in-up">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.features.title')}</h2>
            <p className="mt-4 text-lg text-muted">{t('landing.features.subtitle')}</p>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.titleKey}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_50px_rgb(0_0_0/0.08)] animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.04]`}
                />
                <div
                  className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-lg`}
                >
                  {f.icon}
                </div>
                <h3 className="relative mt-5 text-lg font-semibold">{t(f.titleKey)}</h3>
                <p className="relative mt-2 text-[0.9375rem] leading-relaxed text-muted">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how"
        className="relative scroll-mt-20 border-t border-border/60 bg-gradient-to-b from-card to-surface-alt/30"
      >
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.how.title')}</h2>
          <div className="relative mt-16 grid gap-12 sm:grid-cols-3">
            <div
              aria-hidden
              className="absolute top-12 hidden h-0.5 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent sm:block"
            />
            {steps.map((s, i) => (
              <div
                key={s.titleKey}
                className="relative text-center animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--color-primary-dark)] text-white shadow-[0_8px_24px_rgb(16_148_97/0.35)]">
                  {stepIcons[i]}
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-bold text-primary shadow-md ring-2 ring-primary/20">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold">{t(s.titleKey)}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--color-secondary)] text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-pulse-glow"
        />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.cta.title')}</h2>
          <p className="mt-4 text-lg text-white/70">{t('landing.cta.subtitle')}</p>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Wordmark />
            <span className="text-sm text-muted">{t('landing.footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted">
            <Link
              to="/docs/getting-started/introduction"
              className="no-underline transition-colors hover:text-foreground hover:no-underline"
            >
              Docs
            </Link>
            <Link
              to="/docs/api-reference/introduction"
              className="no-underline transition-colors hover:text-foreground hover:no-underline"
            >
              API
            </Link>
          </div>
          <span className="text-sm text-muted">
            © {year} Ninjasset. {t('landing.footer.rights')}
          </span>
        </div>
      </footer>
    </div>
  );
}
