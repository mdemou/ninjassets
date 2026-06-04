interface LabelWithTooltipProps {
  /** The main label text to display (e.g. "Tramo 1", "Slot 1") */
  label: string;
  /** Tooltip text shown on hover over the ? icon */
  tooltip: string;
}

/**
 * Example usage:
 *
 * ```tsx
 * import { useLanguage } from '~/providers/LanguageProvider';
 * import { LabelWithTooltip } from './LabelWithTooltip';
 *
 * function Example() {
 *   const { t } = useLanguage();
 *   return (
 *     <LabelWithTooltip
 *       label={t('budgets.priceAmount')}
 *       tooltip={t('budgets.priceAmountTooltip')}
 *     />
 *   );
 * }
 * ```
 */

/**
 * Displays a label followed by a "?" icon that shows a tooltip on hover.
 * Used in clubs (tier column) and admin slots (column headers).
 */
export function LabelWithTooltip({ label, tooltip }: LabelWithTooltipProps) {
  return (
    <span className="slot-tooltip-trigger group relative inline-flex cursor-help">
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="slot-tooltip-icon">?</span>
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden w-56 rounded px-2 py-1.5 text-xs shadow-md group-hover:block z-[100] slot-tooltip-popup whitespace-normal">
          {tooltip}
        </span>
      </span>
    </span>
  );
}
