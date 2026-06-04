import { BrowserFrame } from '~/components/public-landing/BrowserFrame';
import { landingIconProps } from '~/components/public-landing/icons';

const assets = [
  {
    name: 'MacBook Pro 14"',
    meta: 'Laptops · SN-48291',
    status: 'In use',
    statusClass: 'bg-[var(--color-status-stock-light)] text-[var(--color-status-stock-dark)]',
  },
  {
    name: 'Dell UltraSharp 27"',
    meta: 'Monitors · In stock',
    status: 'In stock',
    statusClass: 'bg-[var(--color-primary-2x-light)] text-[var(--color-primary-dark)]',
  },
  {
    name: 'ThinkPad X1 Carbon',
    meta: 'Laptops · Maintenance',
    status: 'Maintenance',
    statusClass: 'bg-[var(--color-status-maintenance-light)] text-[var(--color-status-maintenance-dark)]',
  },
];

export function AssetsPreview() {
  return (
    <BrowserFrame url="app.ninjasset.io/admin/assets">
      <div className="flex">
        <div className="hidden w-24 shrink-0 border-r border-border/60 bg-[var(--color-sidebar-bg)] p-3 sm:block">
          <div className="h-2 w-14 rounded bg-primary/25" />
          <div className="mt-4 space-y-2">
            {[1, 0.85, 0.65, 0.75].map((w, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded-md px-1 py-1 ${i === 0 ? 'bg-primary/10' : ''}`}
              >
                <span className="h-3 w-3 rounded bg-primary/20" />
                <span
                  className="h-1.5 rounded bg-border"
                  style={{ width: `${w * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">All assets</span>
            <span className="rounded-lg border border-border/60 bg-surface-alt/80 px-2 py-1 text-[0.625rem] text-muted">
              Filter · Site
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {assets.map((asset) => (
              <div
                key={asset.name}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-alt/40 p-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-2x-light)] text-primary">
                  <svg
                    {...landingIconProps}
                    width={16}
                    height={16}
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.6875rem] font-medium">{asset.name}</p>
                  <p className="truncate text-[0.625rem] text-muted">{asset.meta}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.5625rem] font-medium ${asset.statusClass}`}
                >
                  {asset.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
