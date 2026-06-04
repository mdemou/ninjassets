import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { AssetQr } from '~/components/AssetQr';
import { Button } from '~/components/Button';
import { useLanguage } from '~/providers/LanguageProvider';
import { api } from '~/utils/api';
import { assetToPrintItem, writePrintItems } from '~/utils/qrPrint';

interface AssetQrPanelProps {
  assetId: string;
  assetName: string;
  siteName?: string | null;
  detailUrl: string;
  /** Tighter layout for side-by-side use on the asset detail page. */
  compact?: boolean;
}

export function AssetQrPanel({
  assetId,
  assetName,
  siteName = null,
  detailUrl,
  compact = false,
}: AssetQrPanelProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const qrPath = `/api/p/assets/${assetId}/qr`;
      const objectUrl = await api.fetchObjectUrl(qrPath);
      if (!objectUrl) return;
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${assetId}.png`;
      anchor.click();
      api.releaseObjectUrl(qrPath);
    } finally {
      setDownloading(false);
    }
  }, [assetId]);

  const handlePrint = useCallback(() => {
    writePrintItems([
      assetToPrintItem({ id: assetId, name: assetName, siteName }),
    ]);
    void navigate('/admin/assets/print-qr');
  }, [assetId, assetName, siteName, navigate]);

  return (
    <div className="flex gap-4 items-start min-w-0">
      <AssetQr
        assetId={assetId}
        name={assetName}
        size={compact ? 112 : 200}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-1">{t('assets.qr')}</p>
        {!compact && <p className="text-sm text-muted mb-2">{t('assets.qrHint')}</p>}
        <p className={`text-muted break-all font-mono ${compact ? 'text-xs mb-2 line-clamp-2' : 'text-xs mb-3'}`}>
          {detailUrl}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? t('common.loading') : t('assets.qrDownload')}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            onClick={handlePrint}
          >
            {t('assets.qrPrintOne')}
          </Button>
        </div>
      </div>
    </div>
  );
}
