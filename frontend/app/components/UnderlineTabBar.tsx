import type { ReactNode } from 'react';

export interface UnderlineTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  /** Numeric badge (hidden when 0 or undefined). */
  count?: number;
  /** Small dot for attention (e.g. pending action). */
  alert?: boolean;
}

interface UnderlineTabBarProps<T extends string> {
  tabs: UnderlineTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab list. */
  ariaLabel: string;
  /** Prefix for `id` / `aria-controls` (e.g. `asset` → `asset-tab-details`). */
  idPrefix?: string;
  className?: string;
}

export function UnderlineTabBar<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  idPrefix = 'tab',
  className = '',
}: UnderlineTabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-1 border-b border-border ${className}`.trim()}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const tabId = `${idPrefix}-tab-${tab.id}`;
        const panelId = `${idPrefix}-panel-${tab.id}`;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={isActive}
            aria-controls={panelId}
            onClick={() => onChange(tab.id)}
            className={[
              'relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-t-md',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {tab.icon ? (
              <span className={isActive ? 'text-primary' : 'text-muted'}>{tab.icon}</span>
            ) : null}
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.count != null && tab.count > 0 && (
              <span
                className={[
                  'min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums flex items-center justify-center',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
            {tab.alert && (
              <span
                className="absolute top-2 right-1 w-2 h-2 rounded-full bg-warning"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
