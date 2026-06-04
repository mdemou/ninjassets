import type { ReactNode } from 'react';
import { LanguageToggle } from '~/components/public-landing/LanguageToggle';
import { PublicBackground } from '~/components/public-landing/PublicBackground';
import { Wordmark } from '~/components/public-landing/Wordmark';

interface PublicPageLayoutProps {
  children: ReactNode;
  /** Extra controls in the header (right side, before language toggle). */
  headerEnd?: ReactNode;
  /** Vertically center content (auth cards). Disable for full-page content like the landing. */
  centered?: boolean;
  className?: string;
}

export function PublicPageLayout({
  children,
  headerEnd,
  centered = true,
  className = '',
}: PublicPageLayoutProps) {
  return (
    <div className={`relative min-h-full bg-card text-foreground ${className}`.trim()}>
      <PublicBackground />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark />
          <div className="flex items-center gap-3">
            {headerEnd}
            <LanguageToggle />
          </div>
        </div>
      </header>
      <div
        className={
          centered
            ? 'relative mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-6xl flex-col items-center justify-center px-6 py-12'
            : 'relative'
        }
      >
        {children}
      </div>
    </div>
  );
}
