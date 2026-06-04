import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { DocsSidebar } from '~/components/docs/DocsSidebar';
import { Wordmark } from '~/components/public-landing/Wordmark';
import { pageTitleMeta } from '~/utils/pageTitle';
import { docsSections } from '~/data/docs-pages';

export const meta = pageTitleMeta('Documentation');

const desktopSidebarClass =
  'hidden w-64 shrink-0 self-start pr-4 lg:block lg:sticky lg:top-[4.25rem] lg:max-h-[calc(100vh-4.25rem)] lg:overflow-y-auto lg:pb-12';

const mobileSidebarClass =
  'fixed left-0 top-[3.25rem] z-50 flex h-[calc(100dvh-3.25rem)] w-[min(100%,18rem)] flex-col overflow-y-auto border-r border-border bg-[var(--color-card)] px-3 py-4 shadow-xl sm:top-[3.5rem] sm:h-[calc(100dvh-3.5rem)]';

export default function DocsLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allPages = docsSections.flatMap((s) =>
    s.pages.map((p) => ({ ...p, section: s.id, sectionLabel: s.label })),
  );

  const currentIdx = allPages.findIndex(
    (p) => location.pathname === `/docs/${p.section}/${p.id}`,
  );
  const current = currentIdx >= 0 ? allPages[currentIdx] : null;
  const prev = currentIdx > 0 ? allPages[currentIdx - 1] : null;
  const next = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-full bg-card text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-6">
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface p-2 text-foreground lg:hidden"
              aria-expanded={sidebarOpen}
              aria-controls="docs-sidebar-mobile"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <span className="sr-only">{sidebarOpen ? 'Close documentation menu' : 'Open documentation menu'}</span>
              {sidebarOpen ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            <Wordmark />
            <span className="hidden text-border sm:block">/</span>
            <span className="hidden truncate text-sm font-medium text-muted sm:block">Documentation</span>
          </div>
          <nav className="flex shrink-0 items-center gap-2 text-sm text-muted sm:gap-5">
            <Link
              to="/"
              className="hidden no-underline transition-colors hover:text-foreground hover:no-underline md:inline"
            >
              Home
            </Link>
            <Link
              to="/docs/api-reference/introduction"
              className={[
                'hidden no-underline transition-colors hover:text-foreground hover:no-underline md:inline',
                location.pathname.startsWith('/docs/api-reference') ? 'font-medium text-foreground' : '',
              ].join(' ')}
            >
              API Reference
            </Link>
          </nav>
        </div>
      </header>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close documentation menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {sidebarOpen && (
        <DocsSidebar
          id="docs-sidebar-mobile"
          className={mobileSidebarClass}
          onNavigate={() => setSidebarOpen(false)}
        />
      )}

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:gap-12 lg:py-10">
        <DocsSidebar
          id="docs-sidebar-desktop"
          className={desktopSidebarClass}
        />

        <main className="min-w-0 flex-1">
          {current && (
            <p className="mb-4 text-xs text-muted lg:hidden">
              <span className="font-medium text-foreground/80">{current.sectionLabel}</span>
              <span className="mx-1.5 text-border">/</span>
              {current.label}
            </p>
          )}

          <div className="max-w-3xl min-w-0">
            <Outlet />

            {(prev || next) && (
              <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-8 sm:mt-12 sm:flex-row sm:items-stretch sm:gap-4">
                {prev ? (
                  <Link
                    to={`/docs/${prev.section}/${prev.id}`}
                    className="group flex flex-1 flex-col items-start gap-1 rounded-xl border border-border/70 bg-surface-alt/50 px-4 py-3.5 no-underline transition-all hover:border-primary/30 hover:bg-[var(--color-primary-2x-light)]/40 hover:no-underline"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M19 12H5M12 5l-7 7 7 7" />
                      </svg>
                      Previous
                    </span>
                    <span className="text-sm font-medium text-foreground group-hover:text-[var(--color-primary-dark)]">
                      {prev.label}
                    </span>
                  </Link>
                ) : (
                  <div className="hidden flex-1 sm:block" />
                )}
                {next ? (
                  <Link
                    to={`/docs/${next.section}/${next.id}`}
                    className="group flex flex-1 flex-col items-start gap-1 rounded-xl border border-border/70 bg-surface-alt/50 px-4 py-3.5 no-underline transition-all hover:border-primary/30 hover:bg-[var(--color-primary-2x-light)]/40 hover:no-underline sm:items-end"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      Next
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium text-foreground group-hover:text-[var(--color-primary-dark)] sm:text-right">
                      {next.label}
                    </span>
                  </Link>
                ) : (
                  <div className="hidden flex-1 sm:block" />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
