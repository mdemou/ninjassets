import { landingIconProps } from '~/components/public-landing/icons';

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none animate-fade-in-up [animation-delay:200ms]">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-[var(--color-status-stock)]/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_24px_80px_-12px_rgb(0_0_0/0.18)]">
        <div className="flex items-center gap-2 border-b border-border/60 bg-surface-alt/80 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex h-6 w-48 items-center justify-center rounded-md bg-card text-[0.65rem] text-muted">
            app.ninjasset.io/assets
          </div>
        </div>
        <div className="flex">
          <div className="hidden w-28 shrink-0 border-r border-border/60 bg-[var(--color-sidebar-bg)] sm:block">
            <div className="px-3 py-4">
              <div className="h-2 w-16 rounded bg-primary/30" />
              <div className="mt-4 flex flex-col gap-2">
                {[0.9, 0.7, 0.5, 0.6].map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2"
                  >
                    <span className="h-4 w-4 rounded bg-primary/15" />
                    <span
                      className="h-2 rounded bg-border"
                      style={{ width: `${w * 100}%` }}
                    />
                  </div>
                ))}
                <div className="mt-2 h-2 w-full rounded bg-primary/20" />
              </div>
            </div>
          </div>
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Assets</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.625rem] font-medium text-primary">
                248 total
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                {
                  name: 'MacBook Pro 14"',
                  status: 'In use',
                  statusClass: 'bg-[var(--color-status-stock-light)] text-[var(--color-status-stock-dark)]',
                },
                {
                  name: 'Dell Monitor 27"',
                  status: 'In stock',
                  statusClass: 'bg-[var(--color-primary-2x-light)] text-[var(--color-primary-dark)]',
                },
                {
                  name: 'iPhone 15 Pro',
                  status: 'Maintenance',
                  statusClass: 'bg-[var(--color-status-maintenance-light)] text-[var(--color-status-maintenance-dark)]',
                },
              ].map((asset) => (
                <div
                  key={asset.name}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-alt/50 p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-2x-light)] text-primary">
                    <svg
                      {...landingIconProps}
                      width={18}
                      height={18}
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="M12 22V12" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{asset.name}</p>
                    <p className="text-[0.6875rem] text-muted">HQ · Assigned</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-medium ${asset.statusClass}`}
                  >
                    {asset.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-12 flex-1 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5" />
              <div className="h-12 w-12 rounded-lg bg-[var(--color-secondary-2x-light)]" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-2 top-16 w-36 animate-float rounded-xl border border-border/70 bg-card p-3 shadow-lg sm:-right-4">
        <div className="flex items-center gap-2">
          <svg
            width="32"
            height={32}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="text-primary"
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
            <path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3" />
          </svg>
          <div>
            <p className="text-[0.6875rem] font-semibold">QR scan</p>
            <p className="text-[0.625rem] text-muted">Instant lookup</p>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 bottom-8 w-40 animate-float-slow rounded-xl border border-border/70 bg-card p-3 shadow-lg sm:-left-6">
        <div className="flex items-center gap-2 text-[0.6875rem]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary-2x-light)] text-primary">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="m9 11 3 3L22 4" />
            </svg>
          </span>
          <span className="font-medium text-foreground">Handover verified</span>
        </div>
      </div>
    </div>
  );
}
