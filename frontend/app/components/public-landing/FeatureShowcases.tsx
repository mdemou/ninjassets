import type { ReactNode } from 'react';
import { FeatureShowcaseSection } from '~/components/public-landing/FeatureShowcaseSection';
import { AssetsPreview } from '~/components/public-landing/previews/AssetsPreview';
import { HandoverPreview } from '~/components/public-landing/previews/HandoverPreview';
import { QrPreview } from '~/components/public-landing/previews/QrPreview';
import { SitesPreview } from '~/components/public-landing/previews/SitesPreview';
import { useLanguage } from '~/providers/LanguageProvider';
import type { TranslationKey } from '~/utils/translations';

interface ShowcaseConfig {
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  Preview: () => ReactNode;
}

const showcases: ShowcaseConfig[] = [
  {
    eyebrowKey: 'landing.showcase.assets.eyebrow',
    titleKey: 'landing.showcase.assets.title',
    descKey: 'landing.showcase.assets.desc',
    Preview: AssetsPreview,
  },
  {
    eyebrowKey: 'landing.showcase.qr.eyebrow',
    titleKey: 'landing.showcase.qr.title',
    descKey: 'landing.showcase.qr.desc',
    Preview: QrPreview,
  },
  {
    eyebrowKey: 'landing.showcase.handover.eyebrow',
    titleKey: 'landing.showcase.handover.title',
    descKey: 'landing.showcase.handover.desc',
    Preview: HandoverPreview,
  },
  {
    eyebrowKey: 'landing.showcase.sites.eyebrow',
    titleKey: 'landing.showcase.sites.title',
    descKey: 'landing.showcase.sites.desc',
    Preview: SitesPreview,
  },
];

export function FeatureShowcases() {
  const { t } = useLanguage();

  return (
    <section
      id="showcase"
      className="relative scroll-mt-20 border-b border-border/60 bg-gradient-to-b from-card via-surface-alt/20 to-card"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center animate-fade-in-up">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.showcase.title')}</h2>
          <p className="mt-4 text-lg text-muted">{t('landing.showcase.subtitle')}</p>
        </div>
        <div className="mt-20">
          {showcases.map((item, i) => (
            <FeatureShowcaseSection
              key={item.titleKey}
              reverse={i % 2 === 1}
              eyebrowKey={item.eyebrowKey}
              titleKey={item.titleKey}
              descKey={item.descKey}
              index={i}
              preview={<item.Preview />}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
