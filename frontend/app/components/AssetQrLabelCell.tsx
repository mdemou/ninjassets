import { AssetQr } from '~/components/AssetQr';
import type { AssetQrPrintItem } from '~/utils/qrPrint';
import { qrDisplayPx } from '~/utils/qrPrint';

interface AssetQrLabelCellProps {
  item: AssetQrPrintItem;
  labelWidthMm: number;
  showName: boolean;
  showSite: boolean;
}

export function AssetQrLabelCell({ item, labelWidthMm, showName, showSite }: AssetQrLabelCellProps) {
  const qrSize = qrDisplayPx(labelWidthMm);

  return (
    <div className="qr-print-label">
      <div className="qr-print-label__qr">
        <AssetQr
          assetId={item.id}
          name={item.name}
          size={qrSize}
          className="rounded-none"
        />
      </div>
      {showName ? <p className="qr-print-label__name">{item.name}</p> : null}
      {showSite && item.siteName ? <p className="qr-print-label__meta">{item.siteName}</p> : null}
    </div>
  );
}
