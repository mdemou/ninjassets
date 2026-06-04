import type { AssetStatus } from '~/types';
import type { TranslationKey } from '~/utils/translations';

export type AssetDateAlertKey =
  | 'assets.warrantyExpired'
  | 'assets.warrantyExpiringSoon'
  | 'assets.returnOverdue'
  | 'assets.returnDueSoon';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** Client-side date alert chips for asset detail (mirrors server rules approximately). */
export function getAssetDateAlerts(asset: {
  status: AssetStatus;
  warrantyEndDate?: string | null;
  expectedReturnDate?: string | null;
}): AssetDateAlertKey[] {
  const today = startOfToday();
  const out: AssetDateAlertKey[] = [];

  if (asset.warrantyEndDate) {
    const end = parseDateOnly(asset.warrantyEndDate);
    const days = daysBetween(today, end);
    if (days < 0) out.push('assets.warrantyExpired');
    else if (days <= 30) out.push('assets.warrantyExpiringSoon');
  }

  if (asset.status === 'ASSIGNED' && asset.expectedReturnDate) {
    const ret = parseDateOnly(asset.expectedReturnDate);
    const days = daysBetween(today, ret);
    if (days < 0) out.push('assets.returnOverdue');
    else if (days <= 7) out.push('assets.returnDueSoon');
  }

  return out;
}

export const ALERT_BADGE_CLASS: Record<AssetDateAlertKey, string> = {
  'assets.warrantyExpired': 'bg-danger/15 text-danger',
  'assets.warrantyExpiringSoon': 'bg-warning/15 text-warning',
  'assets.returnOverdue': 'bg-danger/15 text-danger',
  'assets.returnDueSoon': 'bg-warning/15 text-warning',
};

export type { TranslationKey };
