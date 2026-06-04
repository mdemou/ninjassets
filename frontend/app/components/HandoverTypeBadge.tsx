import { Badge } from '~/components/Badge';
import { useLanguage } from '~/providers/LanguageProvider';
import type { HandoverType } from '~/types';
import type { TranslationKey } from '~/utils/translations';

const HANDOVER_TYPE_LABEL_KEY: Record<
  HandoverType,
  'handover.admin.typeCheckout' | 'handover.admin.typeCheckin'
> = {
  CHECK_OUT: 'handover.admin.typeCheckout',
  CHECK_IN: 'handover.admin.typeCheckin',
};

interface HandoverTypeBadgeProps {
  type: HandoverType;
  labelKey?: TranslationKey;
}

export function HandoverTypeBadge({ type, labelKey }: HandoverTypeBadgeProps) {
  const { t } = useLanguage();

  return (
    <Badge variant={type === 'CHECK_OUT' ? 'primary' : 'secondary'}>
      {t(labelKey ?? HANDOVER_TYPE_LABEL_KEY[type])}
    </Badge>
  );
}
