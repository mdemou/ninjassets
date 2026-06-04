import { BrowserFrame } from '~/components/public-landing/BrowserFrame';

export function HandoverPreview() {
  return (
    <div className="relative">
      <BrowserFrame url="app.ninjasset.io/handover/confirm">
        <div className="p-5">
          <div className="mx-auto max-w-xs text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-2x-light)] text-primary">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m9 11 3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </span>
            <p className="mt-3 text-xs font-semibold">Confirm custody</p>
            <p className="mt-1 text-[0.6875rem] text-muted">You are receiving this asset</p>
          </div>
          <div className="mt-4 rounded-xl border border-border/60 bg-surface-alt/50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-primary-2x-light)] text-primary">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[0.75rem] font-medium">MacBook Pro 14&quot;</p>
                <p className="text-[0.625rem] text-muted">SN-48291 · From IT stock</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex-1 rounded-lg border border-border/60 py-2 text-center text-[0.6875rem] text-muted">
              Decline
            </div>
            <div className="flex-1 rounded-lg bg-primary py-2 text-center text-[0.6875rem] font-medium text-white shadow-[0_4px_12px_rgb(16_148_97/0.3)]">
              Confirm receipt
            </div>
          </div>
          <p className="mt-3 text-center text-[0.625rem] text-muted">Link expires in 47h</p>
        </div>
      </BrowserFrame>
      <div className="absolute -left-2 bottom-6 w-36 animate-float-slow rounded-xl border border-border/70 bg-card p-2.5 shadow-lg sm:-left-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <div>
            <p className="text-[0.625rem] font-semibold">Audit logged</p>
            <p className="text-[0.5625rem] text-muted">Checkout verified</p>
          </div>
        </div>
      </div>
    </div>
  );
}
