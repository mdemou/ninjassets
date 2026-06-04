import { BrowserFrame } from '~/components/public-landing/BrowserFrame';

export function QrPreview() {
  return (
    <div className="relative">
      <BrowserFrame url="app.ninjasset.io/assets/scan">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">iPhone 15 Pro</p>
              <p className="mt-0.5 text-[0.6875rem] text-muted">SN · IP15-0092 · HQ</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.625rem] font-medium text-primary">
              In use
            </span>
          </div>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-[var(--color-primary-2x-light)]/50 p-2">
              <svg
                viewBox="0 0 80 80"
                className="h-full w-full text-foreground"
                aria-hidden
              >
                <rect
                  x="4"
                  y="4"
                  width="24"
                  height="24"
                  rx="2"
                  fill="currentColor"
                  opacity="0.9"
                />
                <rect
                  x="52"
                  y="4"
                  width="24"
                  height="24"
                  rx="2"
                  fill="currentColor"
                  opacity="0.9"
                />
                <rect
                  x="4"
                  y="52"
                  width="24"
                  height="24"
                  rx="2"
                  fill="currentColor"
                  opacity="0.9"
                />
                <rect
                  x="36"
                  y="36"
                  width="8"
                  height="8"
                  fill="currentColor"
                />
                <rect
                  x="48"
                  y="48"
                  width="6"
                  height="6"
                  fill="currentColor"
                />
                <rect
                  x="60"
                  y="36"
                  width="16"
                  height="16"
                  rx="1"
                  fill="currentColor"
                  opacity="0.7"
                />
                <rect
                  x="36"
                  y="56"
                  width="10"
                  height="10"
                  fill="currentColor"
                  opacity="0.5"
                />
              </svg>
              <span className="absolute -bottom-2 rounded-full bg-primary px-2 py-0.5 text-[0.5625rem] font-semibold text-white shadow-md">
                Scan
              </span>
            </div>
            <div className="flex-1 space-y-2 text-[0.6875rem]">
              <div className="rounded-lg border border-border/60 bg-surface-alt/50 p-2.5">
                <p className="font-medium">Assigned to</p>
                <p className="mt-0.5 text-muted">Alex Rivera · Engineering</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-alt/50 p-2.5">
                <p className="font-medium">Warranty</p>
                <p className="mt-0.5 text-muted">Valid until Mar 2027</p>
              </div>
              <button
                type="button"
                className="w-full rounded-lg bg-primary py-2 text-[0.6875rem] font-medium text-white"
              >
                Print label
              </button>
            </div>
          </div>
        </div>
      </BrowserFrame>
      <div className="absolute -right-1 top-12 w-32 animate-float rounded-xl border border-border/70 bg-card p-2.5 shadow-lg sm:-right-3">
        <p className="text-[0.625rem] font-semibold text-primary">Scanned</p>
        <p className="text-[0.5625rem] text-muted">Asset opened in 0.4s</p>
      </div>
    </div>
  );
}
