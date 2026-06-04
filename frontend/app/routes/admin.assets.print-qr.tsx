import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AssetQrPrintSheet } from '~/components/AssetQrPrintSheet';
import { Button } from '~/components/Button';
import { FormInput } from '~/components/FormInput';
import { PageContent } from '~/components/PageContent';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import '~/styles/asset-qr-print.css';
import { readPrintItems, type AssetQrPrintItem, type QrLabelSizePreset, type QrPaperSize } from '~/utils/qrPrint';
import type { TranslationKey } from '~/utils/translations';

const LABEL_SIZE_OPTIONS: { value: QrLabelSizePreset; labelKey: TranslationKey }[] = [
  { value: 'S', labelKey: 'assets.qrLabelSizeSmall' },
  { value: 'M', labelKey: 'assets.qrLabelSizeMedium' },
  { value: 'L', labelKey: 'assets.qrLabelSizeLarge' },
  { value: 'XL', labelKey: 'assets.qrLabelSizeXlarge' },
  { value: 'XXL', labelKey: 'assets.qrLabelSizeXxl' },
];

const PAPER_OPTIONS: { value: QrPaperSize; labelKey: TranslationKey }[] = [
  { value: 'a4', labelKey: 'assets.qrPaperA4' },
  { value: 'letter', labelKey: 'assets.qrPaperLetter' },
];

export const meta = pageMeta('assets.qrPrintTitle');

export default function AdminAssetsPrintQr() {
  usePageTitle('assets.qrPrintTitle');
  const navigate = useNavigate();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';

  const [items, setItems] = useState<AssetQrPrintItem[]>([]);
  const [labelPreset, setLabelPreset] = useState<QrLabelSizePreset>('L');
  const [paper, setPaper] = useState<QrPaperSize>('a4');
  const [showName, setShowName] = useState(true);
  const [showSite, setShowSite] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setItems(readPrintItems());
  }, [isAdmin]);

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/dashboard', { replace: true });
    }
  }, [userLoading, user, navigate]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!isAuthReady || userLoading) return null;

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <div className="qr-print-page">
        <div className="qr-print-toolbar mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h1 className="text-3xl font-semibold">{t('assets.qrPrintTitle')}</h1>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="tertiary"
                onClick={() => void navigate('/admin/assets')}
              >
                {t('assets.qrPrintBack')}
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                disabled={items.length === 0}
              >
                {t('assets.qrPrint')}
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-muted">{t('assets.qrPrintEmpty')}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-4 mb-6 p-4 rounded-lg border border-border bg-surface">
              <FormInput
                label={t('assets.qrLabelSize')}
                name="labelPreset"
                type="select"
                value={labelPreset}
                onChange={(e) => setLabelPreset(e.target.value as QrLabelSizePreset)}
                options={LABEL_SIZE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.labelKey),
                }))}
              />
              <FormInput
                label={t('assets.qrPaperSize')}
                name="paper"
                type="select"
                value={paper}
                onChange={(e) => setPaper(e.target.value as QrPaperSize)}
                options={PAPER_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.labelKey),
                }))}
              />
              <FormInput
                label={t('assets.qrShowName')}
                name="showName"
                type="checkbox"
                value={showName}
                onChange={(e) => {
                  if (e.target instanceof HTMLInputElement) setShowName(e.target.checked);
                }}
                className="mb-0!"
              />
              <FormInput
                label={t('assets.qrShowSite')}
                name="showSite"
                type="checkbox"
                value={showSite}
                onChange={(e) => {
                  if (e.target instanceof HTMLInputElement) setShowSite(e.target.checked);
                }}
                className="mb-0!"
              />
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <AssetQrPrintSheet
            items={items}
            labelPreset={labelPreset}
            paper={paper}
            showName={showName}
            showSite={showSite}
          />
        ) : (
          <Link
            to="/admin/assets"
            className="text-primary hover:underline"
          >
            {t('assets.qrPrintBack')}
          </Link>
        )}
      </div>
    </PageContent>
  );
}
