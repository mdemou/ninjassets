import config from '@config/config';
import { renderEmailLayout, renderPlainTextEmail } from './layout';

interface HandoverEmailParams {
  token: string;
  recipientName: string;
  assetName: string;
  serialNumber: string;
}

function acceptUrl(token: string): string {
  return `${config.frontendUrl}/handover/accept?token=${token}`;
}

function expiryHours(): number {
  return config.tokenExpiry.handoverHours;
}

function greeting(name: string): string {
  return `Hi ${name},`;
}

function assetLines(assetName: string, serialNumber: string): string[] {
  return [`Asset: ${assetName}`, `Serial: ${serialNumber}`];
}

/** Checkout: recipient confirms receipt (verified handover). */
export function handoverCheckoutEmailHtml(params: HandoverEmailParams): string {
  const url = acceptUrl(params.token);

  return renderEmailLayout({
    preheader: `Confirm receipt of ${params.assetName} — verified handover.`,
    eyebrow: 'Verified handover',
    headline: 'Confirm you are receiving this asset',
    greeting: greeting(params.recipientName),
    paragraphs: [
      'An asset has been assigned to you. Please confirm receipt so custody is verified on both sides and your inventory record stays accurate.',
      'You will sign in with your <strong>ninjasset</strong> account before completing confirmation — the same flow as on the web app.',
    ],
    assetCard: {
      assetName: params.assetName,
      serialNumber: params.serialNumber,
      label: 'Receiving',
    },
    cta: { href: url, label: 'Confirm receipt' },
    fallbackUrl: url,
    expiryHours: expiryHours(),
    footerNote:
      'If you did not expect this handover, contact your IT team before confirming. Do not share this link.',
  });
}

export function handoverCheckoutEmailText(params: HandoverEmailParams): string {
  const url = acceptUrl(params.token);

  return renderPlainTextEmail({
    headline: 'Confirm you are receiving this asset',
    greeting: greeting(params.recipientName),
    paragraphs: [
      'An asset has been assigned to you. Please confirm receipt (sign-in required) so custody is verified:',
    ],
    assetLines: assetLines(params.assetName, params.serialNumber),
    cta: { href: url, label: 'Confirm receipt' },
    expiryHours: expiryHours(),
    footerNote: 'If you did not expect this, contact IT. Do not share this link.',
  });
}

/** Return: assignee confirms return (verified handover). */
export function handoverReturnEmailHtml(params: HandoverEmailParams): string {
  const url = acceptUrl(params.token);

  return renderEmailLayout({
    preheader: `Confirm return of ${params.assetName} — verified handover.`,
    eyebrow: 'Verified return',
    headline: 'Confirm return of this asset',
    greeting: greeting(params.recipientName),
    paragraphs: [
      'A return has been initiated for an asset currently assigned to you. Please confirm the return so it can be checked back into inventory with a verified audit trail.',
      'You will sign in with your <strong>ninjasset</strong> account before completing confirmation.',
    ],
    assetCard: {
      assetName: params.assetName,
      serialNumber: params.serialNumber,
      label: 'Returning',
    },
    cta: { href: url, label: 'Confirm return' },
    fallbackUrl: url,
    expiryHours: expiryHours(),
    footerNote:
      'If you did not expect this return request, contact your IT team before confirming. Do not share this link.',
  });
}

export function handoverReturnEmailText(params: HandoverEmailParams): string {
  const url = acceptUrl(params.token);

  return renderPlainTextEmail({
    headline: 'Confirm return of this asset',
    greeting: greeting(params.recipientName),
    paragraphs: [
      'Please confirm the return of the asset below (sign-in required):',
    ],
    assetLines: assetLines(params.assetName, params.serialNumber),
    cta: { href: url, label: 'Confirm return' },
    expiryHours: expiryHours(),
    footerNote: 'If you did not expect this, contact IT. Do not share this link.',
  });
}
