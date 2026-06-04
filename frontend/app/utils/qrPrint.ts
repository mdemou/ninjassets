import type { AssetStatus } from '~/types';

export type AssetQrPrintItem = {
  id: string;
  name: string;
  siteName: string | null;
};

/**
 * Row data kept by the assets-list selection. A superset of {@link AssetQrPrintItem}
 * (so QR print can reuse it directly) plus the fields the bulk-assign wizard needs to
 * decide checkout/return eligibility without re-fetching each asset.
 */
export type AssetSelectionItem = {
  id: string;
  name: string;
  serialNumber: string;
  status: AssetStatus;
  assignedUserId: string | null;
  assignedUserName: string | null;
  siteName: string | null;
};

export function assetToSelectionItem(asset: {
  id: string;
  name: string;
  serialNumber: string;
  status: AssetStatus;
  assignedUserId: string | null;
  assignedUserName?: string | null;
  siteName?: string | null;
}): AssetSelectionItem {
  return {
    id: asset.id,
    name: asset.name,
    serialNumber: asset.serialNumber,
    status: asset.status,
    assignedUserId: asset.assignedUserId,
    assignedUserName: asset.assignedUserName ?? null,
    siteName: asset.siteName ?? null,
  };
}

export const QR_PRINT_STORAGE_KEY = 'ninjasset:qr-print';

export type QrLabelSizePreset = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export type QrPaperSize = 'a4' | 'letter';

export const QR_LABEL_PRESETS: Record<QrLabelSizePreset, { labelWidthMm: number; textBandMm: number }> = {
  S: { labelWidthMm: 25, textBandMm: 10 },
  M: { labelWidthMm: 30, textBandMm: 12 },
  L: { labelWidthMm: 40, textBandMm: 14 },
  XL: { labelWidthMm: 50, textBandMm: 16 },
  XXL: { labelWidthMm: 60, textBandMm: 18 },
};

export const QR_PAPER_SIZES: Record<QrPaperSize, { pageSize: string; maxWidthMm: number }> = {
  a4: { pageSize: 'A4', maxWidthMm: 190 },
  letter: { pageSize: 'letter', maxWidthMm: 190 },
};

export function assetToPrintItem(asset: { id: string; name: string; siteName?: string | null }): AssetQrPrintItem {
  return {
    id: asset.id,
    name: asset.name,
    siteName: asset.siteName ?? null,
  };
}

export function writePrintItems(items: AssetQrPrintItem[]): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(QR_PRINT_STORAGE_KEY, JSON.stringify(items));
}

/** Approximate QR image size in CSS pixels for a given label width. */
export function qrDisplayPx(labelWidthMm: number): number {
  return Math.round(labelWidthMm * 2.8);
}

export function readPrintItems(): AssetQrPrintItem[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(QR_PRINT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AssetQrPrintItem =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as AssetQrPrintItem).id === 'string' &&
        typeof (item as AssetQrPrintItem).name === 'string',
    );
  } catch {
    return [];
  }
}
