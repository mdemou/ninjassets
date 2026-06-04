import type { AssetStatus } from '~/types';
import type { TranslationKey } from '~/utils/translations';

/** Display order for status lists, charts, and filters. */
export const ASSET_STATUS_ORDER: AssetStatus[] = ['STOCK', 'ASSIGNED', 'MAINTENANCE', 'ARCHIVED'];

export const ASSET_STATUS_LABEL_KEYS: Record<AssetStatus, TranslationKey> = {
  STOCK: 'assets.statusStock',
  ASSIGNED: 'assets.statusAssigned',
  MAINTENANCE: 'assets.statusMaintenance',
  ARCHIVED: 'assets.statusArchived',
};

export const ASSET_STATUS_OPTIONS: { value: AssetStatus; labelKey: TranslationKey }[] =
  ASSET_STATUS_ORDER.map((value) => ({ value, labelKey: ASSET_STATUS_LABEL_KEYS[value] }));

/** Tailwind classes for status pills (tables, filters, badges). */
export const ASSET_STATUS_BADGE_CLASS: Record<AssetStatus, string> = {
  STOCK: 'bg-[var(--color-status-stock-light)] text-[var(--color-status-stock-dark)]',
  ASSIGNED: 'bg-[var(--color-primary-2x-light)] text-[var(--color-primary-dark)]',
  MAINTENANCE: 'bg-[var(--color-status-maintenance-light)] text-[var(--color-status-maintenance-dark)]',
  ARCHIVED: 'bg-[var(--color-status-archived-light)] text-[var(--color-status-archived-dark)]',
};

/** CSS color values for charts and maps. */
export const ASSET_STATUS_CHART_COLOR: Record<AssetStatus, string> = {
  STOCK: 'var(--color-status-stock)',
  ASSIGNED: 'var(--color-primary)',
  MAINTENANCE: 'var(--color-status-maintenance)',
  ARCHIVED: 'var(--color-status-archived)',
};

export function assetStatusBadgeClass(status: AssetStatus): string {
  return ASSET_STATUS_BADGE_CLASS[status];
}
