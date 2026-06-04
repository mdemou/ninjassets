import type { ReactNode } from 'react';

interface HoverTooltipProps {
  /** Tooltip body (supports line breaks). */
  content: string;
  children: ReactNode;
  className?: string;
}

/** Shows `content` above the trigger on hover. Reuses slot-tooltip popup styles. */
export function HoverTooltip({ content, children, className = '' }: HoverTooltipProps) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 bottom-full z-[100] mb-1 hidden w-56 -translate-x-1/2 rounded px-2 py-1.5 text-xs shadow-md group-hover:block slot-tooltip-popup whitespace-pre-line"
      >
        {content}
      </span>
    </span>
  );
}
