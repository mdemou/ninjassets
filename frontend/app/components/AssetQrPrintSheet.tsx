import type { CSSProperties } from 'react';
import { AssetQrLabelCell } from '~/components/AssetQrLabelCell';
import type { AssetQrPrintItem, QrLabelSizePreset, QrPaperSize } from '~/utils/qrPrint';
import { QR_LABEL_PRESETS, QR_PAPER_SIZES } from '~/utils/qrPrint';

interface AssetQrPrintSheetProps {
  items: AssetQrPrintItem[];
  labelPreset: QrLabelSizePreset;
  paper: QrPaperSize;
  showName: boolean;
  showSite: boolean;
}

export function AssetQrPrintSheet({ items, labelPreset, paper, showName, showSite }: AssetQrPrintSheetProps) {
  const preset = QR_LABEL_PRESETS[labelPreset];
  const paperConfig = QR_PAPER_SIZES[paper];
  const labelHeightMm = preset.labelWidthMm + preset.textBandMm;

  const style: CSSProperties = {
    '--label-width': `${preset.labelWidthMm}mm`,
    '--label-height': `${labelHeightMm}mm`,
    '--sheet-max-width': `${paperConfig.maxWidthMm}mm`,
  } as CSSProperties;

  return (
    <div
      className="qr-print-sheet"
      style={style}
      data-paper={paper}
    >
      {items.map((item) => (
        <AssetQrLabelCell
          key={item.id}
          item={item}
          labelWidthMm={preset.labelWidthMm}
          showName={showName}
          showSite={showSite}
        />
      ))}
    </div>
  );
}
