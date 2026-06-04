import config from '@config/config';
import path from 'path';
import QRCode from 'qrcode';
import sharp from 'sharp';

/** Default center mark until per-tenant company logos are wired in. */
const QR_CENTER_LOGO_PATH = path.join(process.cwd(), 'assets', 'ninjasset.png');

/** Logo graphic as a fraction of the QR edge (keep ≤ ~0.22 with level H). */
const CENTER_LOGO_RATIO = 0.2;
/** White quiet zone around the logo as a fraction of the QR edge. */
const CENTER_LOGO_PAD_RATIO = 0.26;

export function buildAssetDetailUrl(assetId: string): string {
  const base = config.frontendUrl.replace(/\/$/, '');
  return `${base}/admin/assets/${assetId}`;
}

export async function generateAssetQrPng(url: string, size = config.uploads.qrPngSize): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H',
  });

  return compositeQrCenterLogo(qrBuffer, size);
}

async function compositeQrCenterLogo(qrPng: Buffer, size: number): Promise<Buffer> {
  const padSize = Math.round(size * CENTER_LOGO_PAD_RATIO);
  const logoSize = Math.round(size * CENTER_LOGO_RATIO);
  const inset = Math.round((size - padSize) / 2);

  const logo = await sharp(QR_CENTER_LOGO_PATH)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  const whitePad = await sharp({
    create: {
      width: padSize,
      height: padSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();

  const centerMark = await sharp(whitePad)
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();

  return sharp(qrPng)
    .composite([{ input: centerMark, left: inset, top: inset }])
    .png()
    .toBuffer();
}
