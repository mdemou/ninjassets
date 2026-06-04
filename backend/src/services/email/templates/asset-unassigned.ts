import config from '@config/config';
import { renderEmailLayout, renderPlainTextEmail } from './layout';

export interface AssetUnassignedEmailParams {
  recipientName: string;
  assetName: string;
  serialNumber: string;
}

function assetsUrl(): string {
  return `${config.frontendUrl}/assets`;
}

/** Notify a former assignee that an admin removed them from an asset. */
export function assetUnassignedEmailHtml(params: AssetUnassignedEmailParams): string {
  const url = assetsUrl();

  return renderEmailLayout({
    preheader: `You are no longer assigned to ${params.assetName}.`,
    eyebrow: 'Assignment update',
    headline: 'Asset unassigned',
    greeting: `Hi ${params.recipientName},`,
    paragraphs: [
      'Your IT team updated your asset assignments. You are <strong>no longer assigned</strong> to the asset below.',
      'If you still have physical possession of this device, return it to IT or follow your organization&apos;s offboarding process.',
    ],
    assetCard: {
      assetName: params.assetName,
      serialNumber: params.serialNumber,
      label: 'Previously assigned',
    },
    cta: { href: url, label: 'View my assets' },
    fallbackUrl: url,
    footerNote: 'If this change looks incorrect, contact your IT administrator.',
  });
}

export function assetUnassignedEmailText(params: AssetUnassignedEmailParams): string {
  const url = assetsUrl();

  return renderPlainTextEmail({
    headline: 'Asset unassigned',
    greeting: `Hi ${params.recipientName},`,
    paragraphs: [
      'You are no longer assigned to the asset below.',
      'If you still have this device, please return it to IT.',
    ],
    assetLines: [`Asset: ${params.assetName}`, `Serial: ${params.serialNumber}`],
    cta: { href: url, label: 'View my assets' },
    footerNote: 'If this looks incorrect, contact your IT administrator.',
  });
}
