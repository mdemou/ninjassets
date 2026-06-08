import { BrowserFrame } from '~/components/public-landing/BrowserFrame';

export function AiAssistantPreview() {
  return (
    <div className="relative">
      <BrowserFrame url="app.ninjasset.io/admin/ai">
        <div className="flex h-56">
          <div className="hidden w-28 shrink-0 border-r border-border/60 bg-[var(--color-sidebar-bg)] p-2 sm:block">
            <div className="rounded-lg bg-primary/10 px-2 py-1.5 text-[0.5625rem] font-medium text-primary">
              New chat
            </div>
            <div className="mt-2 space-y-1">
              <div className="truncate rounded-lg bg-surface-alt px-2 py-1.5 text-[0.5625rem] font-medium text-foreground">
                API keys setup
              </div>
              <div className="truncate rounded-lg px-2 py-1.5 text-[0.5625rem] text-muted">Import assets</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-hidden p-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-primary px-3 py-2 text-[0.6875rem] text-white">
                  How do I create an API key?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-border/60 bg-surface-alt/80 px-3 py-2 text-[0.6875rem] text-foreground">
                  API keys are created in Settings → API keys, and the secret is shown once.
                  <div className="mt-2 border-t border-border/60 pt-1.5 text-[0.5625rem] font-medium text-muted">
                    Sources (1) · spec-api-automation.md
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-border/60 p-2">
              <div className="flex items-center gap-2">
                <div className="h-7 flex-1 rounded-lg border border-border/60 bg-card px-2 text-[0.5625rem] text-muted">
                  Ask about features, workflows, or the API…
                </div>
                <div className="rounded-lg bg-primary px-2.5 py-1 text-[0.5625rem] font-medium text-white">Send</div>
              </div>
            </div>
          </div>
        </div>
      </BrowserFrame>
      <div className="absolute -right-2 bottom-8 w-32 animate-float-slow rounded-xl border border-border/70 bg-card p-2.5 shadow-lg sm:-right-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary-2x-light)] text-primary">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 3v2m0 14v2M5 12H3m18 0h-2M7.05 7.05 5.64 5.64m12.72 12.72-1.41-1.41M7.05 16.95l-1.41 1.41M16.95 7.05l1.41-1.41" />
              <circle
                cx="12"
                cy="12"
                r="4"
              />
            </svg>
          </span>
          <div>
            <p className="text-[0.625rem] font-semibold">RAG grounded</p>
            <p className="text-[0.5625rem] text-muted">Docs + OpenAPI</p>
          </div>
        </div>
      </div>
    </div>
  );
}
