import { Badge, type BadgeVariant } from '~/components/Badge';
import { useLanguage } from '~/providers/LanguageProvider';
import type { DataQualitySeverity } from '~/types';
import type { TranslationKey } from '~/utils/translations';

const SEVERITY_VARIANT: Record<DataQualitySeverity, BadgeVariant> = {
  high: 'danger',
  medium: 'warning',
  low: 'muted',
};

/** Left accent + tint for list items (e.g. notification dropdown). */
export const SEVERITY_ITEM_ACCENT: Record<DataQualitySeverity, string> = {
  high: 'border-l-[3px] border-l-danger bg-danger/[0.07]',
  medium: 'border-l-[3px] border-l-warning bg-warning/[0.07]',
  low: 'border-l-[3px] border-l-muted bg-muted/[0.07]',
};

export const SEVERITY_ITEM_HOVER: Record<DataQualitySeverity, string> = {
  high: 'hover:bg-danger/12',
  medium: 'hover:bg-warning/12',
  low: 'hover:bg-muted/12',
};

const SEVERITY_LABEL_KEYS = {
  high: 'reports.severityHigh',
  medium: 'reports.severityMedium',
  low: 'reports.severityLow',
} as const satisfies Record<DataQualitySeverity, TranslationKey>;

export function SeverityBadge({ severity }: { severity: DataQualitySeverity }) {
  const { t } = useLanguage();
  return <Badge variant={SEVERITY_VARIANT[severity]}>{t(SEVERITY_LABEL_KEYS[severity])}</Badge>;
}
