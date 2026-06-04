import type { ReactNode } from 'react';

interface BrowserFrameProps {
  url: string;
  children: ReactNode;
  className?: string;
}

export function BrowserFrame({ url, children, className = '' }: BrowserFrameProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-[var(--color-status-stock)]/10 blur-2xl sm:-inset-4" />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_20px_60px_-12px_rgb(0_0_0/0.16)]">
        <div className="flex items-center gap-2 border-b border-border/60 bg-surface-alt/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex h-5 min-w-0 max-w-[14rem] flex-1 items-center justify-center truncate rounded-md bg-card px-2 text-[0.625rem] text-muted sm:max-w-xs">
            {url}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
