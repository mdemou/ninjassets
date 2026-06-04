import type { ReactNode } from 'react';
import { UnderlineTabBar } from '~/components/UnderlineTabBar';
import { useLanguage } from '~/providers/LanguageProvider';

export type AssetDetailTabId = 'details' | 'custody' | 'documents' | 'components' | 'history';

export interface AssetDetailTabItem {
  id: AssetDetailTabId;
  labelKey: string;
  icon: ReactNode;
  count?: number;
  alert?: boolean;
}

interface AssetDetailTabBarProps {
  tabs: AssetDetailTabItem[];
  active: AssetDetailTabId;
  onChange: (id: AssetDetailTabId) => void;
}

const iconClass = 'w-4 h-4 shrink-0';

export const ASSET_DETAIL_TAB_ICONS = {
  details: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  custody: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  documents: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  components: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  history: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
} as const;

export function AssetDetailTabBar({ tabs, active, onChange }: AssetDetailTabBarProps) {
  const { t } = useLanguage();

  return (
    <UnderlineTabBar
      idPrefix="asset"
      ariaLabel={t('assets.detailTitle')}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: t(tab.labelKey),
        icon: tab.icon,
        count: tab.count,
        alert: tab.alert,
      }))}
      active={active}
      onChange={onChange}
    />
  );
}
