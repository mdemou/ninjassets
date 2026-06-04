import { BrowserFrame } from '~/components/public-landing/BrowserFrame';

const sites = [
  { name: 'HQ — Madrid', count: 142, active: true },
  { name: 'Warehouse B', count: 58, active: false },
  { name: 'Remote — Berlin', count: 31, active: false },
];

export function SitesPreview() {
  return (
    <div className="relative">
      <BrowserFrame url="app.ninjasset.io/admin/sites">
        <div className="flex flex-col sm:flex-row">
          <div className="border-b border-border/60 p-3 sm:w-36 sm:border-b-0 sm:border-r">
            <p className="text-[0.6875rem] font-semibold">Sites</p>
            <ul className="mt-2 space-y-1.5">
              {sites.map((site) => (
                <li
                  key={site.name}
                  className={`rounded-lg px-2 py-1.5 text-[0.625rem] ${site.active ? 'bg-primary/10 font-medium text-primary' : 'text-muted'}`}
                >
                  {site.name}
                  <span className="ml-1 opacity-70">({site.count})</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative min-h-[140px] flex-1 bg-gradient-to-br from-[var(--color-primary-2x-light)]/30 to-surface-alt/80 p-3">
            <div
              className="absolute inset-2 rounded-lg opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
              aria-hidden
            />
            <svg
              className="relative h-full w-full"
              viewBox="0 0 200 120"
              aria-hidden
            >
              <path
                d="M0 80 Q50 60 100 70 T200 65 L200 120 L0 120 Z"
                fill="var(--color-primary-pale)"
                opacity="0.5"
              />
              <path
                d="M0 95 Q80 75 160 85 L200 82 L200 120 L0 120 Z"
                fill="var(--color-primary-2x-light)"
                opacity="0.6"
              />
              <circle
                cx="110"
                cy="52"
                r="14"
                fill="var(--color-primary)"
                opacity="0.9"
              />
              <circle
                cx="110"
                cy="52"
                r="22"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                opacity="0.35"
              />
              <circle
                cx="48"
                cy="68"
                r="6"
                fill="var(--color-status-stock)"
              />
              <circle
                cx="165"
                cy="78"
                r="5"
                fill="var(--color-secondary)"
                opacity="0.8"
              />
            </svg>
            <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-border/60 bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur-sm">
              <p className="text-[0.625rem] font-medium">HQ — Madrid</p>
              <p className="text-[0.5625rem] text-muted">142 assets · 40.4168° N, 3.7038° W</p>
            </div>
          </div>
        </div>
      </BrowserFrame>
      <div className="absolute -right-2 top-10 w-28 animate-float rounded-xl border border-border/70 bg-card p-2 shadow-lg sm:-right-4">
        <p className="text-[0.625rem] font-semibold">Inherited</p>
        <p className="text-[0.5625rem] text-muted">Coords from site</p>
      </div>
    </div>
  );
}
